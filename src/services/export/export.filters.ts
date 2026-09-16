import type { ExportFilterResult } from "./export.types";

export const buildOrderFilters = (q: Record<string, unknown>): ExportFilterResult => {
  const values: unknown[] = [];
  const whereClauses: string[] = [];

  const status = q.status as string | undefined;
  if (status && status !== "all") {
    values.push(status);
    whereClauses.push(`o.status = $${values.length}`);
  }
  if (q.from) {
    values.push(q.from);
    whereClauses.push(`o.created_at >= $${values.length}`);
  }
  if (q.to) {
    values.push(q.to);
    whereClauses.push(`o.created_at <= $${values.length}::date + INTERVAL '1 day'`);
  }
  if (q.search) {
    values.push(`%${q.search}%`);
    whereClauses.push(
      `(o.order_number ILIKE $${values.length} OR o.customer_name ILIKE $${values.length} OR o.customer_phone ILIKE $${values.length})`
    );
  }

  return { whereClauses, values };
};

export const buildUserFilters = (q: Record<string, unknown>): ExportFilterResult => {
  const values: unknown[] = [];
  const whereClauses: string[] = [];

  if (q.role) {
    values.push(q.role);
    whereClauses.push(`role = $${values.length}`);
  }
  if (q.status) {
    values.push(q.status);
    whereClauses.push(`status = $${values.length}`);
  }
  if (q.search) {
    values.push(`%${q.search}%`);
    whereClauses.push(
      `(name ILIKE $${values.length} OR phone ILIKE $${values.length} OR email ILIKE $${values.length})`
    );
  }

  return { whereClauses, values };
};

export const buildPanditFilters = (q: Record<string, unknown>): ExportFilterResult => {
  const values: unknown[] = [];
  const whereClauses: string[] = [];

  if (q.search) {
    values.push(`%${q.search}%`);
    whereClauses.push(`(pp.display_name ILIKE $${values.length} OR u.phone ILIKE $${values.length})`);
  }
  if (q.is_available !== undefined) {
    values.push(q.is_available);
    whereClauses.push(`pp.is_available = $${values.length}`);
  }
  if (q.is_verified !== undefined) {
    values.push(q.is_verified);
    whereClauses.push(`pp.is_verified = $${values.length}`);
  }

  return { whereClauses, values };
};

export const buildAssignmentFilters = (q: Record<string, unknown>): ExportFilterResult => {
  const values: unknown[] = [];
  const whereClauses: string[] = [];

  if (q.status) {
    values.push(q.status);
    whereClauses.push(`pa.status = $${values.length}`);
  }
  if (q.expiring) {
    whereClauses.push(`pa.status = 'pending' AND pa.respond_by <= NOW() + INTERVAL '12 hours'`);
  }

  return { whereClauses, values };
};

export const buildServiceFilters = (q: Record<string, unknown>): ExportFilterResult => {
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
  if (q.requires_pandit !== undefined) {
    values.push(q.requires_pandit);
    whereClauses.push(`c.requires_pandit = $${values.length}`);
  }
  if (q.requires_payment !== undefined) {
    values.push(q.requires_payment);
    whereClauses.push(`c.requires_payment = $${values.length}`);
  }

  return { whereClauses, values };
};

export const serviceOrderBy = (q: Record<string, unknown>): string => {
  const sortMap: Record<string, string> = {
    price_asc: "s.price ASC",
    price_desc: "s.price DESC",
    newest: "s.created_at DESC",
    title: "s.title ASC",
  };
  const sort = q.sort as string | undefined;
  return sortMap[sort ?? ""] ?? "s.created_at DESC";
};

export const buildContactFilters = (q: Record<string, unknown>): ExportFilterResult => {
  const values: unknown[] = [];
  const whereClauses: string[] = [];

  if (q.form_type) {
    values.push(q.form_type);
    whereClauses.push(`form_type = $${values.length}`);
  }
  if (q.status) {
    values.push(q.status);
    whereClauses.push(`status = $${values.length}`);
  }

  return { whereClauses, values };
};

export const buildInvoiceFilters = (q: Record<string, unknown>): ExportFilterResult => {
  const values: unknown[] = [];
  const whereClauses: string[] = [];

  if (q.from) {
    values.push(q.from);
    whereClauses.push(`i.created_at >= $${values.length}`);
  }
  if (q.to) {
    values.push(q.to);
    whereClauses.push(`i.created_at <= $${values.length}::date + INTERVAL '1 day'`);
  }

  return { whereClauses, values };
};

export const emptyFilters = (): ExportFilterResult => ({ whereClauses: [], values: [] });
