import { z } from "zod";
import {
  PLACEMENT_PAGES,
  PLACEMENT_SECTIONS,
  PAGE_SECTIONS,
  isValidPageSection,
  type PlacementPage,
  type PlacementSection,
} from "../constants/service-placements.catalog";

const blankToNullDate = z.preprocess(
  (val) => (val === "" || val === null || val === undefined ? null : val),
  z.coerce.date().nullable().optional()
);

const pageSectionRefine = (data: { page?: PlacementPage; section?: PlacementSection }, ctx: z.RefinementCtx) => {
  if (data.page && data.section && !isValidPageSection(data.page, data.section)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["section"],
      message: `Section "${data.section}" is not allowed on page "${data.page}"`,
    });
  }
};

const scheduleRefine = (
  data: { starts_at?: Date | null; ends_at?: Date | null },
  ctx: z.RefinementCtx
) => {
  if (data.starts_at && data.ends_at && data.ends_at <= data.starts_at) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ends_at"],
      message: "End date must be after the start date",
    });
  }
};

export const createServicePlacementSchema = z
  .object({
    service_id: z.string().uuid("Service must be a valid ID"),
    page: z.enum(PLACEMENT_PAGES),
    section: z.enum(PLACEMENT_SECTIONS),
    display_order: z.coerce
      .number({ invalid_type_error: "Display order must be a valid number" })
      .int("Display order must be a whole number")
      .nonnegative("Display order cannot be negative"),
    label: z.string().trim().max(100).optional(),
    cta_text: z.string().trim().max(50).optional(),
    starts_at: blankToNullDate,
    ends_at: blankToNullDate,
  })
  .superRefine((data, ctx) => {
    pageSectionRefine(data, ctx);
    scheduleRefine(data, ctx);
  });

export const updateServicePlacementSchema = z
  .object({
    service_id: z.string().uuid().optional(),
    page: z.enum(PLACEMENT_PAGES).optional(),
    section: z.enum(PLACEMENT_SECTIONS).optional(),
    display_order: z.coerce.number().int().nonnegative().optional(),
    label: z.string().trim().max(100).nullable().optional(),
    cta_text: z.string().trim().max(50).nullable().optional(),
    starts_at: blankToNullDate,
    ends_at: blankToNullDate,
    is_active: z.coerce.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    scheduleRefine(data, ctx);
  });

export const listServicePlacementsQuerySchema = z.object({
  page: z.enum(PLACEMENT_PAGES),
  section: z.enum(PLACEMENT_SECTIONS),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export const listServicePlacementsAdminQuerySchema = z.object({
  page: z.enum(PLACEMENT_PAGES).optional(),
  section: z.enum(PLACEMENT_SECTIONS).optional(),
});

export const placementCatalogResponse = () => ({
  pages: PLACEMENT_PAGES.map((page) => ({
    page,
    sections: [...PAGE_SECTIONS[page]],
  })),
  sections: PLACEMENT_SECTIONS,
});
