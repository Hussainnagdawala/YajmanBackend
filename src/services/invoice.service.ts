import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../config/s3";
import { env } from "../config/env";
import { pool } from "../config/database";
import { logger } from "../config/logger";
import {
  countInvoicesThisYear,
  findInvoiceByOrderId,
  createInvoice,
  updateInvoicePdfUrl,
  replaceInvoice,
} from "../queries/invoice.queries";
import { findBookingDetail } from "../queries/booking.queries";
import { getSettingsByKeys } from "../queries/settings.queries";
import { getSignedDownloadUrl, extractSpacesKey, spacesObjectExists } from "../utils/spaces";
import { categoryRequiresBookingTime } from "../utils/booking-time";
import { renderInvoicePdf } from "./invoice-pdf.renderer";
import { INVOICE_COMPANY } from "../constants/invoice-company";
import type { InvoiceBranding, InvoiceData } from "./invoice.types";

export type { InvoiceData, InvoiceBranding } from "./invoice.types";

const BRANDING_KEYS = [
  "general.app_name",
  "general.app_tagline",
  "general.company_address",
  "general.website_url",
  "support_email",
  "support_phone",
] as const;

const DEFAULT_BRANDING: InvoiceBranding = {
  appName: "Yajman",
  tagline: "Book pandits for every occasion",
  companyAddress: "",
  websiteUrl: "https://yajmanapp.in",
  supportEmail: "contact@yajmanapp.in",
  supportPhone: "+91 8109181057",
};

export const loadInvoiceBranding = async (): Promise<InvoiceBranding> => {
  const result = await pool.query<{ key: string; value: string }>(getSettingsByKeys, [[...BRANDING_KEYS]]);
  const values = Object.fromEntries(result.rows.map((row) => [row.key, row.value]));

  return {
    appName: values["general.app_name"] || DEFAULT_BRANDING.appName,
    tagline: values["general.app_tagline"] || DEFAULT_BRANDING.tagline,
    companyAddress: values["general.company_address"] || DEFAULT_BRANDING.companyAddress,
    websiteUrl: values["general.website_url"] || DEFAULT_BRANDING.websiteUrl,
    supportEmail: values.support_email || DEFAULT_BRANDING.supportEmail,
    supportPhone: values.support_phone || DEFAULT_BRANDING.supportPhone,
  };
};

/** Today in India as YYYY-MM-DD (process TZ is UTC). */
const istDate = (): string => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** e.g. YJM0920260057 — prefix + MM + YYYY + yearly sequence. */
export const generateInvoiceNumber = async (): Promise<string> => {
  const result = await pool.query<{ count: number }>(countInvoicesThisYear);
  const seq = result.rows[0].count + 1;
  const [year, month] = istDate().split("-");
  return `${INVOICE_COMPANY.invoicePrefix}${month}${year}${String(seq).padStart(4, "0")}`;
};

export const generateInvoicePdf = async (data: Omit<InvoiceData, "branding" | "issued_date">): Promise<Buffer> => {
  const branding = await loadInvoiceBranding();
  const issued_date = istDate();
  return renderInvoicePdf({ ...data, branding, issued_date });
};

/** Canonical Spaces key for an invoice PDF — no leading slash, parent folder optional. */
export const invoiceKey = (invoiceNumber: string): string =>
  [env.DO_PARENT_FOLDER, "invoices", `${invoiceNumber}.pdf`].filter(Boolean).join("/");

const spacesUrlForKey = (key: string): string => {
  const domain = env.DO_SPACES_ENDPOINT.replace(/^https?:\/\//, "");
  return `https://${env.DO_SPACES_BUCKET}.${domain}/${key}`;
};

export const uploadInvoicePdf = async (buffer: Buffer, invoiceNumber: string): Promise<string> => {
  const key = invoiceKey(invoiceNumber);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.DO_SPACES_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
      ACL: "public-read",
    })
  );

  return spacesUrlForKey(key);
};

export const resolveInvoicePdfUrl = async (storedUrl: string | null | undefined): Promise<string | null> => {
  if (!storedUrl) return null;
  return getSignedDownloadUrl(storedUrl);
};

/**
 * Returns a working signed download URL for an existing invoice. If the stored
 * object is missing (e.g. rows created while DO_PARENT_FOLDER was empty, which
 * wrote a leading-slash key), re-renders the PDF from the stored invoice_data
 * and re-uploads it to the canonical key.
 *
 * `correctedUrl` is set when the stored pdf_url was stale and the caller should
 * persist the new value.
 */
export const ensureInvoicePdfUrl = async (
  storedUrl: string,
  invoiceNumber: string,
  invoiceData: Omit<InvoiceData, "branding" | "issued_date">
): Promise<{ pdfUrl: string; correctedUrl?: string }> => {
  if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(storedUrl)) {
    return { pdfUrl: storedUrl };
  }

  let storedKey: string | null = null;
  try {
    storedKey = extractSpacesKey(storedUrl);
  } catch {
    storedKey = null;
  }

  let objectMissing = false;
  try {
    objectMissing = !storedKey || !(await spacesObjectExists(storedKey));
  } catch (err) {
    // HEAD failed for a reason other than 404/403 (network, throttling). Don't
    // block the download — fall through to signing the stored URL.
    logger.warn("Invoice object HEAD check failed", { err, invoiceNumber });
    objectMissing = false;
  }

  if (!objectMissing) {
    return { pdfUrl: await getSignedDownloadUrl(storedUrl) };
  }

  // Object is gone — try to rebuild it from the stored invoice snapshot.
  try {
    if (!invoiceData || typeof invoiceData !== "object") {
      throw new Error("invoice_data missing on invoice row");
    }
    const buffer = await generateInvoicePdf(invoiceData);
    const freshUrl = await uploadInvoicePdf(buffer, invoiceNumber);
    return { pdfUrl: (await getSignedDownloadUrl(freshUrl)) ?? freshUrl, correctedUrl: freshUrl };
  } catch (err) {
    logger.error("Invoice PDF regeneration failed", { err, invoiceNumber });
    // Last resort: hand back a signed URL for the stored key so the caller
    // gets a 200 with a link (even if that link 404s) rather than a 500.
    return { pdfUrl: await getSignedDownloadUrl(storedUrl) };
  }
};

// Booking-detail row from findBookingDetail (members/addons/payment joined).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BookingInvoiceOrder = any;

const buildInvoiceSnapshot = (
  order: BookingInvoiceOrder,
  invoiceNumber: string
): Omit<InvoiceData, "branding" | "issued_date"> => ({
  invoice_number: invoiceNumber,
  order: {
    order_number: order.order_number,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    customer_whatsapp: order.customer_whatsapp ?? null,
    customer_email: order.customer_email ?? null,
    booking_date: order.booking_date,
    booking_time: order.booking_time,
    address: order.address ?? null,
    city: order.city ?? null,
    state: order.state ?? null,
    pincode: order.pincode ?? null,
  },
  service_title: order.service_title,
  requires_booking_time: categoryRequiresBookingTime({
    requires_booking_time: order.requires_booking_time,
    slug: order.category_slug,
  }),
  members: (order.members ?? []) as string[],
  gotra: order.gotra ?? null,
  gotra_unknown: Boolean(order.gotra_unknown),
  coupon_code: order.coupon_code ?? null,
  special_instructions: order.special_instructions ?? null,
  pandit: order.pandit?.display_name
    ? { display_name: order.pandit.display_name, phone: order.pandit.phone ?? undefined }
    : null,
  addons: (order.addons ?? []).map((a: { name: string; price: number }) => ({
    name: a.name,
    price: Number(a.price),
  })),
  pricing: {
    quantity: Number(order.quantity ?? 1),
    unit_price: Number(order.unit_price ?? order.base_price),
    base_price: Number(order.base_price),
    discount_amount: Number(order.discount_amount),
    convenience_fee: Number(order.convenience_fee),
    total_amount: Number(order.total_amount),
  },
  payment: {
    status: order.payment?.status ?? "pending",
    method: order.payment?.method ?? null,
    paid_at: order.payment?.paid_at ?? null,
    amount: order.payment?.amount != null ? Number(order.payment.amount) : null,
    razorpay_payment_id: order.payment?.razorpay_payment_id ?? null,
  },
});

export type EnsuredOrderInvoice = {
  invoice_number: string;
  /** Public Spaces URL — use for WhatsApp PDF header (must stay fetchable). */
  public_pdf_url: string;
  /** Signed URL for in-app download. */
  download_pdf_url: string;
  order: BookingInvoiceOrder;
  created: boolean;
};

/**
 * Idempotent: returns existing invoice or creates PDF + row.
 * Loads full booking detail (service, payment, addons) by order id.
 */
export const ensureOrderInvoice = async (orderId: string): Promise<EnsuredOrderInvoice> => {
  const orderResult = await pool.query(findBookingDetail, [orderId]);
  const order = orderResult.rows[0];
  if (!order) {
    throw new Error(`Order not found for invoice: ${orderId}`);
  }

  const existing = await pool.query(findInvoiceByOrderId, [order.id]);
  if (existing.rows[0]) {
    const invoice = existing.rows[0];
    const { pdfUrl, correctedUrl } = await ensureInvoicePdfUrl(
      invoice.pdf_url,
      invoice.invoice_number,
      invoice.invoice_data
    );
    if (correctedUrl) {
      await pool.query(updateInvoicePdfUrl, [invoice.id, correctedUrl]);
    }
    return {
      invoice_number: invoice.invoice_number,
      public_pdf_url: correctedUrl ?? invoice.pdf_url,
      download_pdf_url: pdfUrl,
      order,
      created: false,
    };
  }

  const invoiceNumber = await generateInvoiceNumber();
  const invoiceData = buildInvoiceSnapshot(order, invoiceNumber);
  const pdfBuffer = await generateInvoicePdf(invoiceData);
  const publicPdfUrl = await uploadInvoicePdf(pdfBuffer, invoiceNumber);
  await pool.query(createInvoice, [order.id, invoiceNumber, publicPdfUrl, JSON.stringify(invoiceData)]);
  const downloadPdfUrl = (await resolveInvoicePdfUrl(publicPdfUrl)) ?? publicPdfUrl;

  return {
    invoice_number: invoiceNumber,
    public_pdf_url: publicPdfUrl,
    download_pdf_url: downloadPdfUrl,
    order,
    created: true,
  };
};

/**
 * Re-issues an order's invoice with a fresh invoice number and the current PDF
 * layout. Updates the existing invoice row in place (creates one if missing).
 */
export const regenerateOrderInvoice = async (orderId: string): Promise<EnsuredOrderInvoice> => {
  const existing = await pool.query(findInvoiceByOrderId, [orderId]);
  if (!existing.rows[0]) return ensureOrderInvoice(orderId);

  const orderResult = await pool.query(findBookingDetail, [orderId]);
  const order = orderResult.rows[0];
  if (!order) {
    throw new Error(`Order not found for invoice: ${orderId}`);
  }

  const invoiceNumber = await generateInvoiceNumber();
  const invoiceData = buildInvoiceSnapshot(order, invoiceNumber);
  const pdfBuffer = await generateInvoicePdf(invoiceData);
  const publicPdfUrl = await uploadInvoicePdf(pdfBuffer, invoiceNumber);
  await pool.query(replaceInvoice, [existing.rows[0].id, invoiceNumber, publicPdfUrl, JSON.stringify(invoiceData)]);
  const downloadPdfUrl = (await resolveInvoicePdfUrl(publicPdfUrl)) ?? publicPdfUrl;

  return {
    invoice_number: invoiceNumber,
    public_pdf_url: publicPdfUrl,
    download_pdf_url: downloadPdfUrl,
    order,
    created: true,
  };
};
