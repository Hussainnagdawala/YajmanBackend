import { Router, Request, Response, NextFunction } from "express";
import { uploadPdfSingle } from "../../middleware/upload";
import { validate } from "../../middleware/validate";
import { sendWhatsAppDocumentSchema } from "../../validators/whatsapp-document.schema";
import * as whatsappDocumentController from "../../controllers/admin/whatsapp-document.controller";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "whatsapp-documents";
  next();
};

/**
 * @openapi
 * /admin/whatsapp/send-document:
 *   post:
 *     tags: [Admin: WhatsApp]
 *     summary: Send a PDF document to a WhatsApp number
 *     description: >
 *       Uploads the PDF, then sends Utility template booking_invoice (en_US)
 *       through NXC create-message-json. The PDF is the document header.
 *       The body has no variables. No Authorization header is required.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [phone_number, attachment]
 *             properties:
 *               phone_number:
 *                 type: string
 *                 example: "919876543210"
 *                 description: WhatsApp number with country code, digits only (no +). A 10-digit Indian mobile is also accepted and prefixed with 91.
 *               attachment:
 *                 type: string
 *                 format: binary
 *                 description: PDF file, up to 10 MB
 *     responses:
 *       200:
 *         description: PDF sent on WhatsApp
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         phone_number: { type: string, example: "919876543210" }
 *                         file_name: { type: string, example: "invoice.pdf" }
 *                         task_id: { type: string, nullable: true }
 *                         delivery_status: { type: string, example: sent }
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 *       502:
 *         description: WhatsApp rejected the send, or accepted it and then failed delivery (for example Meta 131049)
 *       503:
 *         description: WhatsApp delivery is not configured
 */
router.post(
  "/send-document",
  setUploadFolder,
  uploadPdfSingle("attachment"),
  validate(sendWhatsAppDocumentSchema),
  whatsappDocumentController.sendWhatsAppDocument
);

export default router;
