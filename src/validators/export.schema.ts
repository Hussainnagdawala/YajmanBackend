import { z } from "zod";
import { EXPORT_RESOURCES } from "../services/export/export.constants";

export const exportQuerySchema = z
  .object({
    resource: z.enum(EXPORT_RESOURCES, {
      errorMap: () => ({
        message: `Resource must be one of: ${EXPORT_RESOURCES.join(", ")}`,
      }),
    }),
    format: z.enum(["xlsx"]).default("xlsx"),
  })
  .passthrough();

export type ExportQueryInput = z.infer<typeof exportQuerySchema>;
