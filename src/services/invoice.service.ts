import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../config/s3";
import { env } from "../config/env";
import { pool } from "../config/database";
import { countInvoicesThisYear } from "../queries/invoice.queries";
import { getSettingsByKeys } from "../queries/settings.queries";
import { getSignedDownloadUrl } from "../utils/spaces";
import { renderInvoicePdf } from "./invoice-pdf.renderer";
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

export const generateInvoiceNumber = async (): Promise<string> => {
  const result = await pool.query<{ count: number }>(countInvoicesThisYear);
  const seq = result.rows[0].count + 1;
  const year = new Date().getFullYear();
  return `INV-${year}-${String(seq).padStart(4, "0")}`;
};

export const generateInvoicePdf = async (data: Omit<InvoiceData, "branding" | "issued_date">): Promise<Buffer> => {
  const branding = await loadInvoiceBranding();
  const issued_date = new Date().toISOString().slice(0, 10);
  return renderInvoicePdf({ ...data, branding, issued_date });
};

export const uploadInvoicePdf = async (buffer: Buffer, invoiceNumber: string): Promise<string> => {
  const key = `${env.DO_PARENT_FOLDER}/invoices/${invoiceNumber}.pdf`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.DO_SPACES_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
      ACL: "public-read",
    })
  );

  const domain = env.DO_SPACES_ENDPOINT.replace(/^https?:\/\//, "");
  return `https://${env.DO_SPACES_BUCKET}.${domain}/${key}`;
};

export const resolveInvoicePdfUrl = async (storedUrl: string | null | undefined): Promise<string | null> => {
  if (!storedUrl) return null;
  return getSignedDownloadUrl(storedUrl);
};
