import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { findServiceById } from "../queries/service.queries";
import {
  listActiveServicePlacements,
  listAllServicePlacements,
  listServicePlacementsFiltered,
  findServicePlacementById,
  findServicePlacementByDisplayOrder,
  countActiveServicePlacements,
  createServicePlacement as createServicePlacementQuery,
  updateServicePlacement as updateServicePlacementQuery,
  softDeleteServicePlacement,
  hardDeleteServicePlacement,
} from "../queries/service-placement.queries";
import {
  getSectionLimit,
  isValidPageSection,
  type PlacementPage,
  type PlacementSection,
} from "../constants/service-placements.catalog";
import { placementCatalogResponse } from "../validators/service-placement.schema";

const fetchDetail = async (id: string) => {
  const result = await pool.query(findServicePlacementById, [id]);
  return result.rows[0];
};

const assertServiceExists = async (serviceId: string): Promise<void> => {
  const result = await pool.query(findServiceById, [serviceId]);
  if (!result.rows[0]) {
    throw new AppError("NOT_FOUND", "Service not found", 404, [
      { field: "service_id", message: "The selected service does not exist" },
    ]);
  }
};

const assertUniqueDisplayOrder = async (
  page: string,
  section: string,
  displayOrder: number,
  excludeId?: string
): Promise<void> => {
  const result = await pool.query<{ id: string; service_title: string }>(findServicePlacementByDisplayOrder, [
    page,
    section,
    displayOrder,
    excludeId ?? null,
  ]);
  if (result.rows[0]) {
    throw new AppError("CONFLICT", "This display order is already used in this section", 409, [
      {
        field: "display_order",
        message: `Display order ${displayOrder} is already used by "${result.rows[0].service_title}" on ${page}/${section}`,
      },
    ]);
  }
};

const assertSectionCapacity = async (
  page: string,
  section: string,
  excludeId?: string
): Promise<void> => {
  const limit = getSectionLimit(section as PlacementSection);
  if (!limit) return;

  const result = await pool.query<{ count: number }>(countActiveServicePlacements, [
    page,
    section,
    excludeId ?? null,
  ]);
  if (result.rows[0].count >= limit) {
    throw new AppError("CONFLICT", `Maximum ${limit} active placements allowed for ${section}`, 409, [
      { field: "section", message: `This section already has ${limit} active services. Deactivate or remove one first.` },
    ]);
  }
};

const assertPageSection = (page: string, section: string): void => {
  if (!isValidPageSection(page as PlacementPage, section as PlacementSection)) {
    throw new AppError("VALIDATION_ERROR", `Section "${section}" is not allowed on page "${page}"`, 400, [
      { field: "section", message: `Section "${section}" is not allowed on page "${page}"` },
    ]);
  }
};

const assertSchedule = (startsAt?: Date | null, endsAt?: Date | null): void => {
  if (startsAt && endsAt && endsAt <= startsAt) {
    throw new AppError("VALIDATION_ERROR", "End date must be after start date", 400, [
      { field: "ends_at", message: "End date must be after the start date" },
    ]);
  }
};

const resolveEffectiveLimit = (section: PlacementSection, requested?: number): number => {
  const sectionCap = getSectionLimit(section) ?? 20;
  const limit = requested ?? sectionCap;
  return Math.min(limit, sectionCap);
};

// ─── Public ──────────────────────────────────────────────────

export const listServicePlacementsPublic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, section, limit } = req.query as unknown as {
      page: PlacementPage;
      section: PlacementSection;
      limit?: number;
    };

    assertPageSection(page, section);
    const safeLimit = resolveEffectiveLimit(section, limit);

    const result = await pool.query(listActiveServicePlacements, [page, section, safeLimit]);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

// ─── Admin ───────────────────────────────────────────────────

export const getPlacementCatalog = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return success(res, placementCatalogResponse());
  } catch (err) {
    next(err);
  }
};

export const listServicePlacementsAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, section } = req.query as { page?: PlacementPage; section?: PlacementSection };

    if (page || section) {
      const result = await pool.query(listServicePlacementsFiltered, [page ?? null, section ?? null]);
      return success(res, result.rows);
    }

    const result = await pool.query(listAllServicePlacements);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const getServicePlacementAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await fetchDetail(req.params.id);
    if (!row) throw new AppError("NOT_FOUND", "Service placement not found", 404);
    return success(res, row);
  } catch (err) {
    next(err);
  }
};

export const createServicePlacement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { service_id, page, section, display_order, label, cta_text, starts_at, ends_at } = req.body;

    assertPageSection(page, section);
    assertSchedule(starts_at, ends_at);
    await assertServiceExists(service_id);
    await assertUniqueDisplayOrder(page, section, display_order);
    await assertSectionCapacity(page, section);

    const result = await pool.query(createServicePlacementQuery, [
      service_id,
      page,
      section,
      display_order,
      label ?? null,
      cta_text ?? null,
      starts_at ?? null,
      ends_at ?? null,
    ]);

    const detail = await fetchDetail(result.rows[0].id);
    return success(res, detail, "Service placement created", 201);
  } catch (err) {
    next(err);
  }
};

export const updateServicePlacement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await fetchDetail(req.params.id);
    if (!existing) throw new AppError("NOT_FOUND", "Service placement not found", 404);

    const effectivePage = (req.body.page ?? existing.page) as string;
    const effectiveSection = (req.body.section ?? existing.section) as string;
    const effectiveDisplayOrder =
      req.body.display_order !== undefined ? req.body.display_order : existing.display_order;
    const effectiveStartsAt = req.body.starts_at !== undefined ? req.body.starts_at : existing.starts_at;
    const effectiveEndsAt = req.body.ends_at !== undefined ? req.body.ends_at : existing.ends_at;
    const willBeActive = req.body.is_active !== undefined ? req.body.is_active : existing.is_active;

    assertPageSection(effectivePage, effectiveSection);
    assertSchedule(effectiveStartsAt, effectiveEndsAt);

    if (req.body.service_id) {
      await assertServiceExists(req.body.service_id);
    }

    if (willBeActive) {
      const orderOrSlotChanged =
        req.body.display_order !== undefined ||
        req.body.page !== undefined ||
        req.body.section !== undefined ||
        (req.body.is_active === true && !existing.is_active);

      if (orderOrSlotChanged) {
        await assertUniqueDisplayOrder(effectivePage, effectiveSection, effectiveDisplayOrder, req.params.id);
      }

      const needsCapacityCheck =
        (!existing.is_active && willBeActive) ||
        (existing.is_active &&
          ((req.body.page !== undefined && req.body.page !== existing.page) ||
            (req.body.section !== undefined && req.body.section !== existing.section)));

      if (needsCapacityCheck) {
        await assertSectionCapacity(effectivePage, effectiveSection, req.params.id);
      }
    }

    const fields = Object.keys(req.body);
    if (fields.length === 0) throw new AppError("VALIDATION_ERROR", "No fields to update", 400);

    const values = fields.map((f) => req.body[f]);
    await pool.query(updateServicePlacementQuery(fields), [req.params.id, ...values]);

    const detail = await fetchDetail(req.params.id);
    return success(res, detail, "Service placement updated");
  } catch (err) {
    next(err);
  }
};

export const deleteServicePlacement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(softDeleteServicePlacement, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Service placement not found", 404);
    return success(res, result.rows[0], "Service placement deleted");
  } catch (err) {
    next(err);
  }
};

export const deleteServicePlacementPermanently = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(hardDeleteServicePlacement, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Service placement not found", 404);
    return success(res, result.rows[0], "Service placement permanently deleted");
  } catch (err) {
    next(err);
  }
};

/** Used by blog/article controllers to fetch curated placements (empty array if none). */
export const fetchPlacementsForPage = async (
  page: PlacementPage,
  section: PlacementSection,
  limit?: number
) => {
  const safeLimit = resolveEffectiveLimit(section, limit);
  const result = await pool.query(listActiveServicePlacements, [page, section, safeLimit]);
  return result.rows;
};
