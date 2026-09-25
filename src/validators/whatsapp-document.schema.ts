import { z } from "zod";
import { toWhatsAppRecipient } from "../services/whatsapp.service";

/**
 * Same recipient rules as Final Booking (`toWhatsAppRecipient`):
 * 10-digit Indian mobiles are prefixed with 91; a full number with country
 * code (919876543210) is kept as digits only.
 */
export const sendWhatsAppDocumentSchema = z.object({
  phone_number: z
    .string({
      required_error: "WhatsApp number is required",
      invalid_type_error: "WhatsApp number is required",
    })
    .trim()
    .min(1, "WhatsApp number is required")
    .superRefine((value, ctx) => {
      if (!toWhatsAppRecipient(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a WhatsApp number with country code, for example 919876543210",
        });
      }
    })
    .transform((value) => toWhatsAppRecipient(value) as string),
});
