import { z } from "zod";

export const createAayojanContactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email().max(150).optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  city: z.string().trim().max(100).optional(),
  event_name: z.string().trim().max(200).optional(),
  number_of_people: z.coerce.number().int().positive().optional(),
  preferred_date: z.coerce.date().optional(),
});
