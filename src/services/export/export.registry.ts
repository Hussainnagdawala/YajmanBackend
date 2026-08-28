import { z } from "zod";
import { pool } from "../../config/database";
import { listOrdersAdminQuerySchema } from "../../validators/order.schema";
import { listUsersQuerySchema } from "../../validators/profile.schema";
import { listPanditsAdminQuerySchema, listAdminAssignmentsQuerySchema } from "../../validators/pandit.schema";
import { listServicesAdminQuerySchema } from "../../validators/service.schema";
import { listContactEntriesQuerySchema } from "../../validators/contact.schema";
import { listInvoicesQuerySchema } from "../../validators/booking.schema";
import {
  buildOrderFilters,
  buildUserFilters,
  buildPanditFilters,
  buildAssignmentFilters,
  buildServiceFilters,
  serviceOrderBy,
  buildContactFilters,
  buildInvoiceFilters,
  emptyFilters,
} from "./export.filters";
import type { ExportResourceConfig } from "./export.types";
import {
  exportOrdersAdmin,
  exportUsers,
  exportPanditsAdmin,
  exportAssignmentsAdmin,
  exportServicesAdmin,
  exportCategories,
  exportCoupons,
  exportContactEntries,
  exportInvoicesAdmin,
  exportAayojanContent,
  exportAayojanEvents,
  exportAayojanBanners,
  exportAayojanGallery,
} from "../../queries/export.queries";
import { countOrdersAdmin } from "../../queries/order.queries";
import { countUsers } from "../../queries/user.queries";
import { countPanditsAdmin, countAssignmentsAdmin } from "../../queries/pandit.queries";
import { countServices } from "../../queries/service.queries";
import { countContactEntriesAdmin } from "../../queries/contact.queries";
import { countInvoicesAdmin } from "../../queries/invoice.queries";

const omitPagination = <T extends z.ZodObject<z.ZodRawShape>>(schema: T) =>
  schema.omit({ page: true, limit: true });

const noFiltersSchema = z.object({}).strict();

const DEFAULT_MAX = 50_000;

const fetchLimited = async (
  sql: string,
  values: unknown[],
  maxRows: number
): Promise<Record<string, unknown>[]> => {
  const result = await pool.query(sql, [...values, maxRows]);
  return result.rows as Record<string, unknown>[];
};

const countWith = async (countSql: string, values: unknown[]): Promise<number> => {
  const result = await pool.query<{ count: number }>(countSql, values);
  return result.rows[0]?.count ?? 0;
};

import { type ExportResource } from "./export.constants";

export const exportRegistry: Record<ExportResource, ExportResourceConfig> = {
  orders: {
    resource: "orders",
    sheetName: "Orders",
    filenamePrefix: "orders",
    filterSchema: omitPagination(listOrdersAdminQuerySchema),
    buildFilters: buildOrderFilters,
    fetchRows: async (_pool, filters, maxRows) => {
      const idx = filters.values.length + 1;
      return fetchLimited(exportOrdersAdmin(filters.whereClauses, idx), filters.values, maxRows);
    },
    columns: [
      { header: "Order No", key: "order_number", width: 18 },
      { header: "Customer", key: "customer_name", width: 22 },
      { header: "Phone", key: "customer_phone", width: 14 },
      { header: "Email", key: "customer_email", width: 24 },
      { header: "Service", key: "service_title", width: 28 },
      { header: "Booking Date", key: "booking_date", width: 14, format: "date" },
      { header: "Booking Time", key: "booking_time", width: 12 },
      { header: "Base Price", key: "base_price", width: 14, format: "currency" },
      { header: "Discount", key: "discount_amount", width: 12, format: "currency" },
      { header: "Convenience Fee", key: "convenience_fee", width: 14, format: "currency" },
      { header: "Total", key: "total_amount", width: 14, format: "currency" },
      { header: "Status", key: "status", width: 14 },
      { header: "Assignment", key: "assignment_status", width: 14 },
      { header: "City", key: "city", width: 14 },
      { header: "Coupon", key: "coupon_code", width: 12 },
      { header: "Created At", key: "created_at", width: 20, format: "datetime" },
    ],
  },

  users: {
    resource: "users",
    sheetName: "Users",
    filenamePrefix: "users",
    filterSchema: omitPagination(listUsersQuerySchema),
    buildFilters: buildUserFilters,
    fetchRows: async (_pool, filters, maxRows) => {
      const idx = filters.values.length + 1;
      return fetchLimited(exportUsers(filters.whereClauses, idx), filters.values, maxRows);
    },
    columns: [
      { header: "Name", key: "name", width: 22 },
      { header: "Phone", key: "phone", width: 14 },
      { header: "Email", key: "email", width: 24 },
      { header: "Role", key: "role", width: 10 },
      { header: "Status", key: "status", width: 12 },
      { header: "Country Code", key: "country_code", width: 12 },
      { header: "Registered", key: "created_at", width: 20, format: "datetime" },
      { header: "Last Login", key: "last_login_at", width: 20, format: "datetime" },
    ],
  },

  pandits: {
    resource: "pandits",
    sheetName: "Pandits",
    filenamePrefix: "pandits",
    filterSchema: omitPagination(listPanditsAdminQuerySchema),
    buildFilters: buildPanditFilters,
    fetchRows: async (_pool, filters, maxRows) => {
      const idx = filters.values.length + 1;
      return fetchLimited(exportPanditsAdmin(filters.whereClauses, idx), filters.values, maxRows);
    },
    columns: [
      { header: "Name", key: "display_name", width: 22 },
      { header: "Phone", key: "phone", width: 14 },
      { header: "Email", key: "email", width: 24 },
      { header: "User Status", key: "user_status", width: 12 },
      { header: "Experience (yrs)", key: "experience_years", width: 14 },
      { header: "Rating", key: "rating", width: 10 },
      { header: "Available", key: "is_available", width: 10, format: "boolean" },
      { header: "Verified", key: "is_verified", width: 10, format: "boolean" },
      { header: "Service Areas", key: "service_areas", width: 20 },
      { header: "Languages", key: "languages", width: 20 },
      { header: "Specializations", key: "specializations", width: 24 },
      { header: "Created At", key: "created_at", width: 20, format: "datetime" },
    ],
  },

  "pandit-assignments": {
    resource: "pandit-assignments",
    sheetName: "Assignments",
    filenamePrefix: "pandit_assignments",
    filterSchema: omitPagination(listAdminAssignmentsQuerySchema),
    buildFilters: buildAssignmentFilters,
    fetchRows: async (_pool, filters, maxRows) => {
      const idx = filters.values.length + 1;
      return fetchLimited(exportAssignmentsAdmin(filters.whereClauses, idx), filters.values, maxRows);
    },
    columns: [
      { header: "Order No", key: "order_number", width: 18 },
      { header: "Pandit", key: "pandit_name", width: 22 },
      { header: "Pandit Phone", key: "pandit_phone", width: 14 },
      { header: "Status", key: "status", width: 12 },
      { header: "Booking Date", key: "booking_date", width: 14, format: "date" },
      { header: "Booking Time", key: "booking_time", width: 12 },
      { header: "Assigned At", key: "assigned_at", width: 20, format: "datetime" },
      { header: "Respond By", key: "respond_by", width: 20, format: "datetime" },
      { header: "Accepted At", key: "accepted_at", width: 20, format: "datetime" },
      { header: "Rejected At", key: "rejected_at", width: 20, format: "datetime" },
    ],
  },

  services: {
    resource: "services",
    sheetName: "Services",
    filenamePrefix: "services",
    filterSchema: omitPagination(listServicesAdminQuerySchema),
    buildFilters: buildServiceFilters,
    fetchRows: async (_pool, filters, maxRows, rawQuery = {}) => {
      const idx = filters.values.length + 1;
      const orderBy = serviceOrderBy(rawQuery);
      return fetchLimited(exportServicesAdmin(filters.whereClauses, orderBy, idx), filters.values, maxRows);
    },
    columns: [
      { header: "Title", key: "title", width: 30 },
      { header: "Category", key: "category_name", width: 18 },
      { header: "Price", key: "price", width: 12, format: "currency" },
      { header: "Original Price", key: "original_price", width: 14, format: "currency" },
      { header: "Status", key: "status", width: 12 },
      { header: "Active", key: "is_active", width: 10, format: "boolean" },
      { header: "Bestseller", key: "is_bestseller", width: 10, format: "boolean" },
      { header: "Featured", key: "is_featured", width: 10, format: "boolean" },
      { header: "Requires Pandit", key: "requires_pandit", width: 14, format: "boolean" },
      { header: "Requires Payment", key: "requires_payment", width: 16, format: "boolean" },
      { header: "Duration (min)", key: "duration_minutes", width: 14 },
      { header: "Created At", key: "created_at", width: 20, format: "datetime" },
    ],
  },

  categories: {
    resource: "categories",
    sheetName: "Categories",
    filenamePrefix: "categories",
    filterSchema: noFiltersSchema,
    buildFilters: emptyFilters,
    fetchRows: async (_pool, _filters, maxRows) => fetchLimited(exportCategories(1), [], maxRows),
    columns: [
      { header: "Name", key: "name", width: 22 },
      { header: "Slug", key: "slug", width: 20 },
      { header: "Display Order", key: "display_order", width: 14 },
      { header: "Active", key: "is_active", width: 10, format: "boolean" },
      { header: "Requires Pandit", key: "requires_pandit", width: 14, format: "boolean" },
      { header: "Requires Payment", key: "requires_payment", width: 16, format: "boolean" },
      { header: "Requires Time Slot", key: "requires_booking_time", width: 16, format: "boolean" },
      { header: "Created At", key: "created_at", width: 20, format: "datetime" },
    ],
  },

  coupons: {
    resource: "coupons",
    sheetName: "Coupons",
    filenamePrefix: "coupons",
    filterSchema: noFiltersSchema,
    buildFilters: emptyFilters,
    fetchRows: async (_pool, _filters, maxRows) => fetchLimited(exportCoupons(1), [], maxRows),
    columns: [
      { header: "Code", key: "code", width: 14 },
      { header: "Title", key: "title", width: 20 },
      { header: "Description", key: "description", width: 28 },
      { header: "Discount Type", key: "discount_type", width: 14 },
      { header: "Discount Value", key: "discount_value", width: 14 },
      { header: "Min Order", key: "min_order_amount", width: 12, format: "currency" },
      { header: "Max Discount", key: "max_discount_amount", width: 14, format: "currency" },
      { header: "Usage Limit", key: "usage_limit", width: 12 },
      { header: "Used Count", key: "usage_count", width: 12 },
      { header: "Active", key: "is_active", width: 10, format: "boolean" },
      { header: "Valid From", key: "valid_from", width: 14, format: "date" },
      { header: "Valid Until", key: "valid_until", width: 14, format: "date" },
      { header: "Created At", key: "created_at", width: 20, format: "datetime" },
    ],
  },

  "contact-entries": {
    resource: "contact-entries",
    sheetName: "Contact Entries",
    filenamePrefix: "contact_entries",
    filterSchema: omitPagination(listContactEntriesQuerySchema),
    buildFilters: buildContactFilters,
    fetchRows: async (_pool, filters, maxRows) => {
      const idx = filters.values.length + 1;
      return fetchLimited(exportContactEntries(filters.whereClauses, idx), filters.values, maxRows);
    },
    columns: [
      { header: "Form Type", key: "form_type", width: 12 },
      { header: "Name", key: "name", width: 20 },
      { header: "Email", key: "email", width: 24 },
      { header: "Phone", key: "phone", width: 14 },
      { header: "City", key: "city", width: 14 },
      { header: "Message", key: "message", width: 32 },
      { header: "Service", key: "service_name", width: 22 },
      { header: "Category", key: "category_name", width: 18 },
      { header: "Event", key: "event_name", width: 18 },
      { header: "People", key: "number_of_people", width: 10 },
      { header: "Preferred Date", key: "preferred_date", width: 14, format: "date" },
      { header: "Status", key: "status", width: 12 },
      { header: "Created At", key: "created_at", width: 20, format: "datetime" },
    ],
  },

  invoices: {
    resource: "invoices",
    sheetName: "Invoices",
    filenamePrefix: "invoices",
    filterSchema: omitPagination(listInvoicesQuerySchema),
    buildFilters: buildInvoiceFilters,
    fetchRows: async (_pool, filters, maxRows) => {
      const idx = filters.values.length + 1;
      return fetchLimited(exportInvoicesAdmin(filters.whereClauses, idx), filters.values, maxRows);
    },
    columns: [
      { header: "Invoice No", key: "invoice_number", width: 18 },
      { header: "Order No", key: "order_number", width: 18 },
      { header: "Customer", key: "customer_name", width: 22 },
      { header: "Amount", key: "total_amount", width: 14, format: "currency" },
      { header: "Created At", key: "created_at", width: 20, format: "datetime" },
    ],
  },

  "aayojan-content": {
    resource: "aayojan-content",
    sheetName: "Aayojan Content",
    filenamePrefix: "aayojan_content",
    filterSchema: noFiltersSchema,
    buildFilters: emptyFilters,
    fetchRows: async (_pool, _filters, maxRows) => fetchLimited(exportAayojanContent(1), [], maxRows),
    columns: [
      { header: "Section Key", key: "section_key", width: 18 },
      { header: "Title", key: "title", width: 24 },
      { header: "Subtitle", key: "subtitle", width: 24 },
      { header: "CTA Text", key: "cta_text", width: 16 },
      { header: "CTA Link", key: "cta_link", width: 24 },
      { header: "Display Order", key: "display_order", width: 14 },
      { header: "Active", key: "is_active", width: 10, format: "boolean" },
      { header: "Updated At", key: "updated_at", width: 20, format: "datetime" },
    ],
  },

  "aayojan-events": {
    resource: "aayojan-events",
    sheetName: "Aayojan Events",
    filenamePrefix: "aayojan_events",
    filterSchema: noFiltersSchema,
    buildFilters: emptyFilters,
    fetchRows: async (_pool, _filters, maxRows) => fetchLimited(exportAayojanEvents(1), [], maxRows),
    columns: [
      { header: "Title", key: "title", width: 28 },
      { header: "Slug", key: "slug", width: 20 },
      { header: "Location", key: "location", width: 22 },
      { header: "City", key: "city", width: 14 },
      { header: "Event Date", key: "event_date", width: 14, format: "date" },
      { header: "Event Time", key: "event_time", width: 12 },
      { header: "Price", key: "price", width: 12, format: "currency" },
      { header: "Original Price", key: "original_price", width: 14, format: "currency" },
      { header: "Capacity", key: "max_capacity", width: 10 },
      { header: "Status", key: "status", width: 12 },
      { header: "Active", key: "is_active", width: 10, format: "boolean" },
      { header: "Created At", key: "created_at", width: 20, format: "datetime" },
    ],
  },

  "aayojan-banners": {
    resource: "aayojan-banners",
    sheetName: "Aayojan Banners",
    filenamePrefix: "aayojan_banners",
    filterSchema: noFiltersSchema,
    buildFilters: emptyFilters,
    fetchRows: async (_pool, _filters, maxRows) => fetchLimited(exportAayojanBanners(1), [], maxRows),
    columns: [
      { header: "Title", key: "title", width: 24 },
      { header: "Link URL", key: "link_url", width: 28 },
      { header: "Display Order", key: "display_order", width: 14 },
      { header: "Active", key: "is_active", width: 10, format: "boolean" },
      { header: "Created At", key: "created_at", width: 20, format: "datetime" },
    ],
  },

  "aayojan-gallery": {
    resource: "aayojan-gallery",
    sheetName: "Aayojan Gallery",
    filenamePrefix: "aayojan_gallery",
    filterSchema: noFiltersSchema,
    buildFilters: emptyFilters,
    fetchRows: async (_pool, _filters, maxRows) => fetchLimited(exportAayojanGallery(1), [], maxRows),
    columns: [
      { header: "Image URL", key: "image_url", width: 40 },
      { header: "Display Order", key: "display_order", width: 14 },
      { header: "Active", key: "is_active", width: 10, format: "boolean" },
      { header: "Created At", key: "created_at", width: 20, format: "datetime" },
    ],
  },
};

export const countExportRowsForResource = async (
  resource: ExportResource,
  filters: { whereClauses: string[]; values: unknown[] }
): Promise<number> => {
  switch (resource) {
    case "orders":
      return countWith(countOrdersAdmin(filters.whereClauses), filters.values);
    case "users":
      return countWith(countUsers(filters.whereClauses), filters.values);
    case "pandits":
      return countWith(countPanditsAdmin(filters.whereClauses), filters.values);
    case "pandit-assignments":
      return countWith(countAssignmentsAdmin(filters.whereClauses), filters.values);
    case "services":
      return countWith(countServices(filters.whereClauses), filters.values);
    case "contact-entries":
      return countWith(countContactEntriesAdmin(filters.whereClauses), filters.values);
    case "invoices":
      return countWith(countInvoicesAdmin(filters.whereClauses), filters.values);
    default:
      return exportRegistry[resource].fetchRows(pool, filters, DEFAULT_MAX).then((r) => r.length);
  }
};

export const getExportConfig = (resource: string): ExportResourceConfig | undefined =>
  exportRegistry[resource as ExportResource];
