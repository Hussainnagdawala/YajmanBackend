import { z } from "zod";
import { strictBoolean } from "./common.schema";

export const updateGalleryImageSchema = z.object({
  title: z.string().trim().max(200).optional(),
  display_order: z.coerce.number().int().optional(),
  is_active: strictBoolean.optional(),
});
