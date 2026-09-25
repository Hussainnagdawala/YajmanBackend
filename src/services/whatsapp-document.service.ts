import path from "path";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { AppError } from "../utils/errors";
import { sendNxcTemplateWithPdf } from "./whatsapp.service";

export type SendUploadedPdfResult = {
  phone_number: string;
  file_name: string;
  task_id: string | number | null;
  delivery_status: string;
};

/** Display name sent as NXC `file_name` (same field Final Booking uses). */
export const pdfDisplayName = (originalName: string | undefined): string => {
  const base = path.basename(originalName || "document.pdf").replace(/[/\\]/g, "").trim() || "document.pdf";
  const withExt = base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
  return withExt.slice(0, 180);
};

/**
 * Send an already-uploaded public PDF with the Utility template `booking_invoice`
 * (en_US, DOCUMENT header, no body variables). Same NXC JSON call as Final Booking,
 * but Final Booking keeps the marketing template `complete_booking`.
 */
export const sendUploadedPdfOnWhatsApp = async (input: {
  to: string;
  fileUrl: string;
  fileName: string;
}): Promise<SendUploadedPdfResult> => {
  if (!env.NXC_DOCUMENT_TEMPLATE_ID.trim()) {
    throw new AppError("WHATSAPP_NOT_CONFIGURED", "WhatsApp document template is not configured", 503);
  }

  if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(input.fileUrl)) {
    throw new AppError(
      "DOCUMENT_UNREACHABLE",
      "The uploaded PDF is stored on a local URL, so WhatsApp cannot fetch it",
      422,
      [{ field: "attachment", message: "PDF must be stored at a public URL" }]
    );
  }

  let result: Awaited<ReturnType<typeof sendNxcTemplateWithPdf>>;
  try {
    result = await sendNxcTemplateWithPdf(
      {
        to: input.to,
        templateId: env.NXC_DOCUMENT_TEMPLATE_ID.trim(),
        language: env.NXC_DOCUMENT_LANG.trim() || "en_US",
        file: input.fileUrl,
        fileName: input.fileName,
        variables: {},
      },
      { waitForDelivery: true }
    );
  } catch (err) {
    logger.error("WhatsApp PDF send failed", { err });
    throw new AppError(
      "WHATSAPP_SEND_FAILED",
      "WhatsApp could not send the PDF. Check the number and try again.",
      502
    );
  }

  if (!result) {
    throw new AppError("WHATSAPP_NOT_CONFIGURED", "WhatsApp delivery is not configured", 503);
  }

  if (result.deliveryStatus === "failed") {
    throw new AppError(
      "WHATSAPP_NOT_DELIVERED",
      result.deliveryError || "WhatsApp did not deliver the PDF",
      502
    );
  }

  return {
    phone_number: input.to,
    file_name: input.fileName,
    task_id: result.taskId ?? null,
    delivery_status: result.deliveryStatus ?? "accepted",
  };
};
