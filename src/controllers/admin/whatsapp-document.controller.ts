import { Request, Response, NextFunction } from "express";
import { success } from "../../utils/response";
import { AppError } from "../../utils/errors";
import { pdfDisplayName, sendUploadedPdfOnWhatsApp } from "../../services/whatsapp-document.service";

export const sendWhatsAppDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file as Express.MulterS3.File | undefined;
    if (!file) {
      throw new AppError("VALIDATION_ERROR", "PDF attachment is required", 422, [
        { field: "attachment", message: "Upload a PDF file in the attachment field" },
      ]);
    }

    const isPdf = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      throw new AppError("VALIDATION_ERROR", "Attachment must be a PDF document", 422, [
        { field: "attachment", message: "Only PDF files are accepted" },
      ]);
    }

    if (!file.size) {
      throw new AppError("VALIDATION_ERROR", "The PDF attachment is empty", 422, [
        { field: "attachment", message: "The uploaded PDF is empty" },
      ]);
    }

    if (!file.location) {
      throw new AppError("UPLOAD_FAILED", "The PDF could not be stored for WhatsApp delivery", 502, [
        { field: "attachment", message: "PDF upload did not return a public URL" },
      ]);
    }

    const { phone_number } = req.body as { phone_number: string };
    const data = await sendUploadedPdfOnWhatsApp({
      to: phone_number,
      fileUrl: file.location,
      fileName: pdfDisplayName(file.originalname),
    });

    const delivered = data.delivery_status === "sent" || data.delivery_status === "delivered" || data.delivery_status === "read";
    return success(
      res,
      data,
      delivered ? "PDF sent on WhatsApp" : "PDF queued on WhatsApp. Delivery is not confirmed yet."
    );
  } catch (err) {
    next(err);
  }
};
