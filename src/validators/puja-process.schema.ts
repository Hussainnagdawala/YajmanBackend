import { z } from "zod";

const jsonPreprocess = (val: unknown) => {
  if (typeof val === "string") {
    if (val.trim() === "") return [];
    try {
      return JSON.parse(val);
    } catch {
      return [val];
    }
  }
  return val;
};

const stepSchema = z.object({
  title: z.string().trim().min(1, "Step title is required").max(200, "Step title must be at most 200 characters"),
  description: z.string().trim().optional(),
});

export const createPujaProcessSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(150, "Name must be at most 150 characters"),
    description: z.string().trim().optional(),
    display_order: z.coerce.number().int().default(0),
    steps: z.preprocess(jsonPreprocess, z.array(stepSchema).min(1, "At least one step is required")),
  });

export const updatePujaProcessSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().optional(),
  display_order: z.coerce.number().int().optional(),
  is_active: z.coerce.boolean().optional(),
  steps: z.preprocess(jsonPreprocess, z.array(stepSchema).min(1, "At least one step is required")).optional(),
});
