import { logger } from "../config/logger";
import { ensureOrderInvoice } from "./invoice.service";
import { pdfDisplayName, sendPublicPdfOnWhatsApp } from "./whatsapp-document.service";
import { toWhatsAppRecipient } from "./whatsapp.service";

/**
 * After payment capture: generate invoice PDF (if needed) and send
 * the same Utility `booking_invoice` document flow used by
 * POST /admin/whatsapp/send-document.
 *
 * Best-effort — payment remains successful if WhatsApp delivery fails.
 * Call with `void`; this function absorbs and logs all errors.
 */
export const sendBookingInvoiceWhatsApp = async (orderId: string): Promise<void> => {
  try {
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

    await sendPublicPdfOnWhatsApp({
      to,
      fileUrl: invoice.public_pdf_url,
      fileName: pdfDisplayName(invoice.invoice_number),
    });
  } catch (err) {
    logger.error("Invoice WhatsApp failed (payment already confirmed)", { err, orderId });
  }
};
