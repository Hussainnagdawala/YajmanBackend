import { env } from "../config/env";
import { logger } from "../config/logger";
import { ensureOrderInvoice } from "./invoice.service";
import { sendNxcTemplateWithPdf, toWhatsAppRecipient } from "./whatsapp.service";

/**
 * After payment capture: generate invoice PDF (if needed) and send
 * NXC "Variable With PDF" template `complete_booking` (PDF document header).
 *
 * Best-effort — never throws into checkout. Call with `void`.
 *
 * Template `complete_booking` (en_US, APPROVED): DOCUMENT header only —
 * body has no {{n}} placeholders. Sending variables causes Meta #132000.
 */
export const sendBookingInvoiceWhatsApp = async (orderId: string): Promise<void> => {
  try {
    if (!env.NXC_INVOICE_TEMPLATE_ID.trim()) {
      logger.debug("Invoice WhatsApp skipped — NXC_INVOICE_TEMPLATE_ID empty", { orderId });
      return;
    }

    const invoice = await ensureOrderInvoice(orderId);
    const order = invoice.order;

    const to = toWhatsAppRecipient(order.customer_whatsapp || order.customer_phone);
    if (!to) {
      logger.warn("Invoice WhatsApp skipped — no valid phone", {
        orderId,
        orderNumber: order.order_number,
      });
      return;
    }

    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(invoice.public_pdf_url)) {
      logger.warn("Invoice WhatsApp skipped — PDF URL is local (WhatsApp cannot fetch it)", {
        orderId,
        invoiceNumber: invoice.invoice_number,
      });
      return;
    }

    await sendNxcTemplateWithPdf({
      to,
      templateId: env.NXC_INVOICE_TEMPLATE_ID.trim(),
      language: env.NXC_INVOICE_LANG.trim() || "en_US",
      file: invoice.public_pdf_url,
      fileName: `${invoice.invoice_number}.pdf`,
      variables: {},
    });
  } catch (err) {
    logger.error("Invoice WhatsApp failed (payment already confirmed)", { err, orderId });
  }
};
