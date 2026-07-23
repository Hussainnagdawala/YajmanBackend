import { Request, Response, NextFunction } from "express";
import DOMPurify from "isomorphic-dompurify";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { paginate } from "../utils/pagination";
import { generateUniqueSlug } from "../services/slug.service";
import { deleteFromS3 } from "../services/upload.service";
import {
  createService as createServiceQuery,
  updateService as updateServiceQuery,
  findServiceById,
  findServiceByIdDetail,
  softDeleteService,
  listServices as listServicesQuery,
  countServices,
  listBestsellers,
  findServiceBySlug,
  clearServiceTypes,
  setServiceTypes,
  clearServiceTags,
  setServiceTags,
  clearServiceTemples,
  setServiceTemples,
  clearKeyFeatures,
  insertKeyFeature,
  clearPackages,
  insertPackage,
  clearFaqs,
  insertFaq,
  insertServiceImage,
  findServiceImageById,
  deleteServiceImage as deleteServiceImageQuery,
  maxServiceImageOrder,
  listAllTemples,
  createTemple as createTempleQuery,
  updateTemple as updateTempleQuery,
  softDeleteTemple,
} from "../queries/service.queries";

type MulterS3Files = Record<string, Express.MulterS3.File[]>;

interface KeyFeatureInput {
  title: string;
  description?: string;
  icon_url?: string;
}
interface PackageInput {
  title: string;
  description?: string;
  items?: unknown[];
  price?: number;
}
interface FaqInput {
  question: string;
  answer: string;
}

interface ServiceRelations {
  type_ids?: string[];
  tag_ids?: string[];
  temple_ids?: string[];
  key_features?: KeyFeatureInput[];
  packages?: PackageInput[];
  faqs?: FaqInput[];
}

const replaceServiceRelations = async (
  client: { query: typeof pool.query },
  serviceId: string,
  relations: ServiceRelations
): Promise<void> => {
  if (relations.type_ids !== undefined) {
    await client.query(clearServiceTypes, [serviceId]);
    if (relations.type_ids.length > 0) await client.query(setServiceTypes, [serviceId, relations.type_ids]);
  }
  if (relations.tag_ids !== undefined) {
    await client.query(clearServiceTags, [serviceId]);
    if (relations.tag_ids.length > 0) await client.query(setServiceTags, [serviceId, relations.tag_ids]);
  }
  if (relations.temple_ids !== undefined) {
    await client.query(clearServiceTemples, [serviceId]);
    if (relations.temple_ids.length > 0) await client.query(setServiceTemples, [serviceId, relations.temple_ids]);
  }
  if (relations.key_features !== undefined) {
    await client.query(clearKeyFeatures, [serviceId]);
    for (const [i, kf] of relations.key_features.entries()) {
      await client.query(insertKeyFeature, [serviceId, kf.title, kf.description ?? null, kf.icon_url ?? null, i]);
    }
  }
  if (relations.packages !== undefined) {
    await client.query(clearPackages, [serviceId]);
    for (const [i, pkg] of relations.packages.entries()) {
      await client.query(insertPackage, [
        serviceId,
        pkg.title,
        pkg.description ?? null,
        JSON.stringify(pkg.items ?? []),
        pkg.price ?? null,
        i,
      ]);
    }
  }
  if (relations.faqs !== undefined) {
    await client.query(clearFaqs, [serviceId]);
    for (const [i, faq] of relations.faqs.entries()) {
      await client.query(insertFaq, [serviceId, faq.question, faq.answer, i]);
    }
  }
};

// ─── Public ──────────────────────────────────────────────────

export const listServicesPublic = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as unknown as {
      page: number;
      limit: number;
      search?: string;
      category?: string;
      type?: string;
      tag?: string;
      min_price?: number;
      max_price?: number;
      rating?: number;
      sort?: string;
      is_featured?: boolean;
      is_bestseller?: boolean;
      city?: string;
    };

    const { limit: safeLimit, offset, meta } = paginate(q.page, q.limit);
    const values: unknown[] = [];
    const whereClauses: string[] = ["s.is_active = true", "s.status = 'published'"];
    const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

    if (q.category) {
      values.push(q.category);
      whereClauses.push(isUuid(q.category) ? `s.category_id = $${values.length}` : `c.slug = $${values.length}`);
    }
    if (q.type) {
      const typeSlugsOrIds = q.type.split(",").map((t) => t.trim());
      values.push(typeSlugsOrIds);
      whereClauses.push(
        isUuid(typeSlugsOrIds[0])
          ? `EXISTS (SELECT 1 FROM service_types st WHERE st.service_id = s.id AND st.type_id = ANY($${values.length}::uuid[]))`
          : `EXISTS (SELECT 1 FROM service_types st JOIN types t ON t.id = st.type_id WHERE st.service_id = s.id AND t.slug = ANY($${values.length}))`
      );
    }
    if (q.tag) {
      values.push(q.tag);
      whereClauses.push(
        `EXISTS (SELECT 1 FROM service_tags stg JOIN tags tg ON tg.id = stg.tag_id WHERE stg.service_id = s.id AND tg.slug = $${values.length})`
      );
    }
    if (q.search) {
      values.push(`%${q.search}%`);
      whereClauses.push(`s.title ILIKE $${values.length}`);
    }
    if (q.min_price !== undefined) {
      values.push(q.min_price);
      whereClauses.push(`s.price >= $${values.length}`);
    }
    if (q.max_price !== undefined) {
      values.push(q.max_price);
      whereClauses.push(`s.price <= $${values.length}`);
    }
    if (q.rating !== undefined) {
      values.push(q.rating);
      whereClauses.push(`s.rating_avg >= $${values.length}`);
    }
    if (q.is_featured !== undefined) {
      values.push(q.is_featured);
      whereClauses.push(`s.is_featured = $${values.length}`);
    }
    if (q.is_bestseller !== undefined) {
      values.push(q.is_bestseller);
      whereClauses.push(`s.is_bestseller = $${values.length}`);
    }
    if (q.city) {
      values.push(q.city);
      whereClauses.push(`s.city = $${values.length}`);
    }

    const sortMap: Record<string, string> = {
      price_asc: "s.price ASC",
      price_desc: "s.price DESC",
      rating: "s.rating_avg DESC",
      newest: "s.created_at DESC",
      title: "s.title ASC",
    };
    const orderBy = sortMap[q.sort ?? ""] ?? "s.display_order ASC, s.created_at DESC";

    const [rows, count] = await Promise.all([
      pool.query(
        listServicesQuery(whereClauses, orderBy, values.length + 1, values.length + 2),
        [...values, safeLimit, offset]
      ),
      pool.query<{ count: number }>(countServices(whereClauses), values),
    ]);

    return success(res, rows.rows, "Services fetched", 200, meta(count.rows[0].count));
  } catch (err) {
    next(err);
  }
};

export const getServiceBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(findServiceBySlug, [req.params.slug]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Service not found", 404);
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

export const getBestsellers = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listBestsellers);
    const grouped = new Map<string, { category: { id: string; name: string; slug: string }; services: unknown[] }>();

    for (const row of result.rows) {
      const key = row.category_id;
      if (!grouped.has(key)) {
        grouped.set(key, {
          category: { id: row.category_id, name: row.category_name, slug: row.category_slug },
          services: [],
        });
      }
      grouped.get(key)!.services.push(row);
    }

    return success(res, Array.from(grouped.values()));
  } catch (err) {
    next(err);
  }
};

// ─── Admin: services ─────────────────────────────────────────

export const listServicesAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as unknown as {
      page: number;
      limit: number;
      search?: string;
      category_id?: string;
      status?: string;
      is_active?: boolean;
      sort?: string;
    };

    const { limit: safeLimit, offset, meta } = paginate(q.page, q.limit);
    const values: unknown[] = [];
    const whereClauses: string[] = [];

    if (q.category_id) {
      values.push(q.category_id);
      whereClauses.push(`s.category_id = $${values.length}`);
    }
    if (q.status) {
      values.push(q.status);
      whereClauses.push(`s.status = $${values.length}`);
    }
    if (q.is_active !== undefined) {
      values.push(q.is_active);
      whereClauses.push(`s.is_active = $${values.length}`);
    }
    if (q.search) {
      values.push(`%${q.search}%`);
      whereClauses.push(`s.title ILIKE $${values.length}`);
    }

    const sortMap: Record<string, string> = {
      price_asc: "s.price ASC",
      price_desc: "s.price DESC",
      newest: "s.created_at DESC",
      title: "s.title ASC",
    };
    const orderBy = sortMap[q.sort ?? ""] ?? "s.created_at DESC";

    const [rows, count] = await Promise.all([
      pool.query(
        listServicesQuery(whereClauses, orderBy, values.length + 1, values.length + 2),
        [...values, safeLimit, offset]
      ),
      pool.query<{ count: number }>(countServices(whereClauses), values),
    ]);

    return success(res, rows.rows, "Services fetched", 200, meta(count.rows[0].count));
  } catch (err) {
    next(err);
  }
};

export const getServiceAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(findServiceByIdDetail, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Service not found", 404);
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

export const createService = async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const files = req.files as MulterS3Files | undefined;
    // const featureImage = files?.feature_image?.[0];
    const featureImage = { location: 'ads' }
    // if (!featureImage) throw new AppError("VALIDATION_ERROR", "feature_image file is required", 400);

    const {
      title, category_id, type_ids, tag_ids, temple_ids, price, original_price,
      short_description, about_puja, description, custom_content,
      location, city, state, pincode, latitude, longitude, video_url,
      duration_minutes, advance_booking_hours, is_featured, is_bestseller,
      display_order, meta_title, meta_description, key_features, packages, faqs,
    } = req.body;

    const slug = await generateUniqueSlug(title, "services");
    const sanitizedContent = custom_content ? DOMPurify.sanitize(custom_content) : null;
    const primaryTypeId = type_ids?.[0] ?? null;

    await client.query("BEGIN");
    const result = await client.query(createServiceQuery, [
      title, slug, category_id, primaryTypeId, price, original_price ?? null,
      short_description ?? null, about_puja ?? null, description ?? null, sanitizedContent,
      location ?? null, city ?? null, state ?? null, pincode ?? null, latitude ?? null, longitude ?? null,
      featureImage.location || null, video_url ?? null, duration_minutes ?? null, advance_booking_hours,
      is_featured, is_bestseller, display_order, meta_title ?? null, meta_description ?? null, req.user!.id,
    ]);
    const service = result.rows[0];

    await replaceServiceRelations(client, service.id, { type_ids, tag_ids, temple_ids, key_features, packages, faqs });

    if (files?.images && files.images.length > 0) {
      for (const [i, img] of files.images.entries()) {
        await client.query(insertServiceImage, [service.id, img.location, null, i]);
      }
    }

    await client.query("COMMIT");

    const detail = await pool.query(findServiceBySlug, [slug]);
    return success(res, detail.rows[0], "Service created", 201);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};

export const updateService = async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const existing = await client.query(findServiceById, [req.params.id]);
    if (!existing.rows[0]) throw new AppError("NOT_FOUND", "Service not found", 404);

    const { type_ids, tag_ids, temple_ids, key_features, packages, faqs, custom_content, ...rest } = req.body;
    const files = req.files as MulterS3Files | undefined;

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(rest)) {
      fields.push(key);
      values.push(value);
    }
    if (custom_content !== undefined) {
      fields.push("custom_content");
      values.push(custom_content ? DOMPurify.sanitize(custom_content) : null);
    }
    if (fields.includes("title")) {
      const newSlug = await generateUniqueSlug(rest.title as string, "services", req.params.id);
      fields.push("slug");
      values.push(newSlug);
    }
    if (type_ids !== undefined) {
      fields.push("type_id");
      values.push(type_ids[0] ?? null);
    }
    if (files?.feature_image?.[0]) {
      fields.push("feature_image_url");
      values.push(files.feature_image[0].location);
    }

    await client.query("BEGIN");

    if (fields.length > 0) {
      await client.query(updateServiceQuery(fields), [req.params.id, ...values]);
    }

    await replaceServiceRelations(client, req.params.id, { type_ids, tag_ids, temple_ids, key_features, packages, faqs });

    if (files?.images && files.images.length > 0) {
      const maxOrder = await client.query<{ max_order: number }>(maxServiceImageOrder, [req.params.id]);
      let nextOrder = maxOrder.rows[0].max_order + 1;
      for (const img of files.images) {
        await client.query(insertServiceImage, [req.params.id, img.location, null, nextOrder]);
        nextOrder += 1;
      }
    }

    await client.query("COMMIT");

    const detail = await pool.query(findServiceById, [req.params.id]);
    return success(res, detail.rows[0], "Service updated", 200);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};

export const deleteService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(softDeleteService, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Service not found", 404);
    return success(res, result.rows[0], "Service deleted");
  } catch (err) {
    next(err);
  }
};

export const addServiceImages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await pool.query(findServiceById, [req.params.id]);
    if (!existing.rows[0]) throw new AppError("NOT_FOUND", "Service not found", 404);

    const files = (req.files as Express.MulterS3.File[] | undefined) ?? [];
    if (files.length === 0) throw new AppError("VALIDATION_ERROR", "At least one image file is required", 400);

    const maxOrder = await pool.query<{ max_order: number }>(maxServiceImageOrder, [req.params.id]);
    let nextOrder = maxOrder.rows[0].max_order + 1;
    const inserted = [];
    for (const file of files) {
      const result = await pool.query(insertServiceImage, [req.params.id, file.location, null, nextOrder]);
      inserted.push(result.rows[0]);
      nextOrder += 1;
    }

    return success(res, inserted, "Images uploaded", 201);
  } catch (err) {
    next(err);
  }
};

export const deleteServiceImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const image = await pool.query(findServiceImageById, [req.params.imageId, req.params.id]);
    if (!image.rows[0]) throw new AppError("NOT_FOUND", "Image not found", 404);

    await pool.query(deleteServiceImageQuery, [req.params.imageId, req.params.id]);
    await deleteFromS3(image.rows[0].image_url);

    return success(res, null, "Image deleted");
  } catch (err) {
    next(err);
  }
};

// ─── Admin: temples ──────────────────────────────────────────

export const listTemplesAdmin = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listAllTemples);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const createTemple = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, address, city, state, latitude, longitude } = req.body;
    const slug = await generateUniqueSlug(name, "temples");

    const result = await pool.query(createTempleQuery, [
      name, slug, description ?? null, address ?? null, city ?? null, state ?? null, latitude ?? null, longitude ?? null,
    ]);
    return success(res, result.rows[0], "Temple created", 201);
  } catch (err) {
    next(err);
  }
};

export const updateTemple = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(req.body)) {
      fields.push(key);
      values.push(value);
    }
    if (fields.includes("name")) {
      const newSlug = await generateUniqueSlug(req.body.name, "temples", req.params.id);
      fields.push("slug");
      values.push(newSlug);
    }
    if (fields.length === 0) throw new AppError("VALIDATION_ERROR", "No fields to update", 400);

    const result = await pool.query(updateTempleQuery(fields), [req.params.id, ...values]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Temple not found", 404);
    return success(res, result.rows[0], "Temple updated");
  } catch (err) {
    next(err);
  }
};

export const deleteTemple = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(softDeleteTemple, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Temple not found", 404);
    return success(res, result.rows[0], "Temple deleted");
  } catch (err) {
    next(err);
  }
};

