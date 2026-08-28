import { pool } from "../config/database";

const SLUGGABLE_TABLES = ["categories", "types", "tags", "blogs", "services", "temples", "aayojan_events", "addons", "puja_processes"] as const;
type SluggableTable = (typeof SLUGGABLE_TABLES)[number];

export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const generateUniqueSlug = async (
  text: string,
  table: SluggableTable,
  excludeId?: string
): Promise<string> => {
  const base = slugify(text);
  let candidate = base;
  let suffix = 2;

  for (;;) {
    const query = excludeId
      ? `SELECT id FROM ${table} WHERE slug = $1 AND id != $2`
      : `SELECT id FROM ${table} WHERE slug = $1`;
    const params = excludeId ? [candidate, excludeId] : [candidate];
    const result = await pool.query(query, params);

    if (result.rows.length === 0) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
};
