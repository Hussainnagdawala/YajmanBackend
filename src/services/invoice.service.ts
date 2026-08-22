import fs from "fs/promises";
import path from "path";
import PDFDocument from "pdfkit";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../config/s3";
import { env } from "../config/env";
import { pool } from "../config/database";
import { countInvoicesThisYear } from "../queries/invoice.queries";

export interface InvoiceData {
  invoice_number: string;
  order: {
    order_number: string;
    customer_name: string;
    customer_phone: string;
    customer_email: string | null;
    booking_date: string;
    booking_time: string;
    address: string | null;
    city: string | null;
    pincode: string | null;
  };
  service_title: string;
  addons: { name: string; price: number }[];
  pricing: {
    base_price: number;
    discount_amount: number;
    convenience_fee: number;
    total_amount: number;
  };
  payment: {
    status: string;
    method: string | null;
    paid_at: string | null;
  };
}

export const generateInvoiceNumber = async (): Promise<string> => {
  const result = await pool.query<{ count: number }>(countInvoicesThisYear);
  const seq = result.rows[0].count + 1;
  const year = new Date().getFullYear();
  return `INV-${year}-${String(seq).padStart(4, "0")}`;
};

export const generateInvoicePdf = (data: InvoiceData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text("Yajman", { align: "left" });
    doc.fontSize(10).text("Tax Invoice", { align: "left" });
    doc.moveDown();

    doc.fontSize(12).text(`Invoice Number: ${data.invoice_number}`);
    doc.text(`Order Number: ${data.order.order_number}`);
    doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`);
    doc.moveDown();

    doc.fontSize(13).text("Billed To", { underline: true });
    doc.fontSize(11).text(data.order.customer_name);
    doc.text(data.order.customer_phone);
    if (data.order.customer_email) doc.text(data.order.customer_email);
    if (data.order.address) doc.text(`${data.order.address}, ${data.order.city ?? ""} ${data.order.pincode ?? ""}`.trim());
    doc.moveDown();

    doc.fontSize(13).text("Service", { underline: true });
    doc.fontSize(11).text(data.service_title);
    doc.text(`Booking: ${data.order.booking_date} ${data.order.booking_time}`);
    doc.moveDown();

    doc.fontSize(13).text("Price Breakdown", { underline: true });
    doc.fontSize(11);
    doc.text(`Base Price: Rs. ${data.pricing.base_price.toFixed(2)}`);
    for (const addon of data.addons) {
      doc.text(`${addon.name}: Rs. ${addon.price.toFixed(2)}`);
    }
    doc.text(`Discount: - Rs. ${data.pricing.discount_amount.toFixed(2)}`);
    doc.text(`Convenience Fee: Rs. ${data.pricing.convenience_fee.toFixed(2)}`);
    doc.fontSize(13).text(`Total: Rs. ${data.pricing.total_amount.toFixed(2)}`, { underline: true });
    doc.moveDown();

    doc.fontSize(11).text(`Payment Status: ${data.payment.status}`);
    if (data.payment.method) doc.text(`Payment Method: ${data.payment.method}`);
    if (data.payment.paid_at) doc.text(`Paid At: ${new Date(data.payment.paid_at).toLocaleString("en-IN")}`);

    doc.end();
  });
};

// ── LOCAL DISK UPLOAD (disabled) ─────────────────────────────
/* export const uploadInvoicePdf = async (buffer: Buffer, invoiceNumber: string): Promise<string> => {
  const dir = path.join(process.cwd(), "uploads", "invoices");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${invoiceNumber}.pdf`), buffer);
  return `http://localhost:${env.PORT}/uploads/invoices/${invoiceNumber}.pdf`;
}; */

// ── S3 UPLOAD (active) ───────────────────────────────────────
export const uploadInvoicePdf = async (buffer: Buffer, invoiceNumber: string): Promise<string> => {
  const key = `${env.DO_PARENT_FOLDER}/invoices/${invoiceNumber}.pdf`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.DO_SPACES_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
    })
  );
  
  const domain = env.DO_SPACES_ENDPOINT.replace(/^https?:\/\//, "");
  return `https://${env.DO_SPACES_BUCKET}.${domain}/${key}`;
};
