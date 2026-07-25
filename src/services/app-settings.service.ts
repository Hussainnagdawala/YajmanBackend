import { pool } from "../config/database";
import { logger } from "../config/logger";
import { AppError } from "../utils/errors";
import { SETTINGS_BY_KEY, SettingValueType } from "../constants/settings.catalog";
import {
  listAllSettings,
  listSettingsByCategory,
  listPublicSettings,
  getSettingByKey,
  updateSettingValue,
  getMaxUpdatedAt,
  insertActivityLog,
} from "../queries/settings.queries";

export interface AppSettingRow {
  id: string;
  key: string;
  value: string;
  description: string | null;
  category: string;
  value_type: SettingValueType;
  is_public: boolean;
  is_editable: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface VersionCheck {
  update_available: boolean;
  force_update: boolean;
  latest_version: string | null;
  minimum_version: string | null;
  store_url: string | null;
  message: string | null;
}

type CacheEntry = {
  rows: Array<{
    key: string;
    value: string;
    category: string;
    value_type: string;
    updated_at: string;
  }>;
  maxUpdatedAt: string | null;
  loadedAt: number;
};

const CACHE_TTL_MS = 60_000;
let publicCache: CacheEntry | null = null;

export const invalidateSettingsCache = () => {
  publicCache = null;
};

const logSettingActivity = async (
  userId: string | undefined,
  action: string,
  entityId: string,
  newData?: unknown,
  oldData?: unknown,
  meta?: { ip?: string; userAgent?: string }
) => {
  try {
    await pool.query(insertActivityLog, [
      userId ?? null,
      action,
      "app_setting",
      entityId,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
      meta?.ip ?? null,
      meta?.userAgent ?? null,
    ]);
  } catch (err) {
    logger.error("Failed to write app_setting activity log", { err, action, entityId });
  }
};

export const parseSettingValue = (raw: string, valueType: SettingValueType): unknown => {
  switch (valueType) {
    case "boolean":
      return raw === "true" || raw === "1";
    case "number": {
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    }
    case "json":
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    case "string":
    default:
      return raw;
  }
};

export const serializeSettingValue = (value: unknown, valueType: SettingValueType): string => {
  switch (valueType) {
    case "boolean": {
      if (typeof value === "boolean") return value ? "true" : "false";
      if (typeof value === "string") {
        const lower = value.trim().toLowerCase();
        if (["true", "1", "yes"].includes(lower)) return "true";
        if (["false", "0", "no"].includes(lower)) return "false";
      }
      throw new AppError("VALIDATION_ERROR", "Expected boolean value", 422);
    }
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n) || n < 0) {
        throw new AppError("VALIDATION_ERROR", "Expected a non-negative number", 422);
      }
      return String(n);
    }
    case "json": {
      if (typeof value === "string") {
        try {
          JSON.parse(value);
          return value;
        } catch {
          throw new AppError("VALIDATION_ERROR", "Expected valid JSON", 422);
        }
      }
      return JSON.stringify(value);
    }
    case "string":
    default: {
      if (value === null || value === undefined) return "";
      return String(value);
    }
  }
};

const validateUrlIfNeeded = (key: string, value: string) => {
  if (!key.endsWith("_url") && !key.includes(".store_url") && !key.includes("website_url")) return;
  if (!value.trim()) return;
  try {
    // eslint-disable-next-line no-new
    new URL(value);
  } catch {
    throw new AppError("VALIDATION_ERROR", `Invalid URL for ${key}`, 422);
  }
};

const nestedKeyName = (category: string, key: string): string => {
  const prefix = `${category}.`;
  if (key.startsWith(prefix)) return key.slice(prefix.length);
  return key;
};

export const groupSettingsForAdmin = (
  rows: AppSettingRow[]
): Record<string, Array<{
  key: string;
  value: unknown;
  raw_value: string;
  value_type: SettingValueType;
  is_public: boolean;
  is_editable: boolean;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}>> => {
  const grouped: Record<string, Array<{
    key: string;
    value: unknown;
    raw_value: string;
    value_type: SettingValueType;
    is_public: boolean;
    is_editable: boolean;
    description: string | null;
    updated_at: string;
    updated_by: string | null;
  }>> = {};

  for (const row of rows) {
    const valueType = (row.value_type || "string") as SettingValueType;
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push({
      key: row.key,
      value: parseSettingValue(row.value, valueType),
      raw_value: row.value,
      value_type: valueType,
      is_public: row.is_public,
      is_editable: row.is_editable,
      description: row.description,
      updated_at: row.updated_at,
      updated_by: row.updated_by,
    });
  }
  return grouped;
};

export const nestPublicSettings = (
  rows: Array<{ key: string; value: string; category: string; value_type: string }>
): Record<string, Record<string, unknown>> => {
  const nested: Record<string, Record<string, unknown>> = {};
  for (const row of rows) {
    const valueType = (row.value_type || "string") as SettingValueType;
    if (!nested[row.category]) nested[row.category] = {};
    nested[row.category][nestedKeyName(row.category, row.key)] = parseSettingValue(
      row.value,
      valueType
    );
  }
  return nested;
};

/** Semver-ish compare: returns -1 if a < b, 0 if equal, 1 if a > b */
export const compareVersions = (a: string, b: string): number => {
  const pa = a.replace(/^v/i, "").split(".").map((p) => parseInt(p, 10) || 0);
  const pb = b.replace(/^v/i, "").split(".").map((p) => parseInt(p, 10) || 0);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i += 1) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
};

export const buildVersionCheck = (
  nested: Record<string, Record<string, unknown>>,
  platform: "android" | "ios",
  appVersion: string
): VersionCheck => {
  const platformSettings = nested[platform] ?? {};
  const latest = String(platformSettings.latest_version ?? "");
  const minimum = String(platformSettings.minimum_supported_version ?? "");
  const forceFlag = Boolean(platformSettings.force_update);
  const storeUrl = (platformSettings.store_url as string) || null;
  const message = (platformSettings.update_message as string) || null;

  const belowMinimum = minimum ? compareVersions(appVersion, minimum) < 0 : false;
  const belowLatest = latest ? compareVersions(appVersion, latest) < 0 : false;

  if (forceFlag || belowMinimum) {
    return {
      update_available: true,
      force_update: true,
      latest_version: latest || null,
      minimum_version: minimum || null,
      store_url: storeUrl,
      message: message || "Please update the app to continue",
    };
  }

  if (belowLatest) {
    return {
      update_available: true,
      force_update: false,
      latest_version: latest || null,
      minimum_version: minimum || null,
      store_url: storeUrl,
      message: message || "A new version is available",
    };
  }

  return {
    update_available: false,
    force_update: false,
    latest_version: latest || null,
    minimum_version: minimum || null,
    store_url: storeUrl,
    message: null,
  };
};

const loadPublicCache = async (): Promise<CacheEntry> => {
  if (publicCache && Date.now() - publicCache.loadedAt < CACHE_TTL_MS) {
    return publicCache;
  }

  const [settingsResult, maxResult] = await Promise.all([
    pool.query(listPublicSettings),
    pool.query(getMaxUpdatedAt),
  ]);

  publicCache = {
    rows: settingsResult.rows,
    maxUpdatedAt: maxResult.rows[0]?.max_updated_at
      ? new Date(maxResult.rows[0].max_updated_at).toISOString()
      : null,
    loadedAt: Date.now(),
  };
  return publicCache;
};

export const getAdminSettings = async (category?: string) => {
  const result = category
    ? await pool.query(listSettingsByCategory, [category])
    : await pool.query(listAllSettings);
  return groupSettingsForAdmin(result.rows as AppSettingRow[]);
};

export const getAdminSettingByKey = async (key: string) => {
  const result = await pool.query(getSettingByKey, [key]);
  if (!result.rows[0]) {
    throw new AppError("NOT_FOUND", `Setting '${key}' not found`, 404);
  }
  const row = result.rows[0] as AppSettingRow;
  const valueType = (row.value_type || "string") as SettingValueType;
  return {
    key: row.key,
    value: parseSettingValue(row.value, valueType),
    raw_value: row.value,
    value_type: valueType,
    is_public: row.is_public,
    is_editable: row.is_editable,
    description: row.description,
    category: row.category,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  };
};

const flattenBulkInput = (input: {
  settings?: Record<string, unknown>;
  categories?: Record<string, Record<string, unknown>>;
}): Record<string, unknown> => {
  const flat: Record<string, unknown> = { ...(input.settings ?? {}) };
  if (input.categories) {
    for (const [category, values] of Object.entries(input.categories)) {
      for (const [shortKey, value] of Object.entries(values)) {
        const dotted = `${category}.${shortKey}`;
        // Prefer dotted catalog key; fall back to short/legacy key if it exists
        if (SETTINGS_BY_KEY.has(dotted)) {
          flat[dotted] = value;
        } else if (SETTINGS_BY_KEY.has(shortKey)) {
          flat[shortKey] = value;
        } else {
          flat[dotted] = value;
        }
      }
    }
  }
  return flat;
};

export const updateSettingsBulk = async (
  input: { settings?: Record<string, unknown>; categories?: Record<string, Record<string, unknown>> },
  actorId: string,
  meta?: { ip?: string; userAgent?: string }
) => {
  const flat = flattenBulkInput(input);
  const updated: string[] = [];
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const [key, value] of Object.entries(flat)) {
      if (!SETTINGS_BY_KEY.has(key)) {
        throw new AppError("VALIDATION_ERROR", `Unknown setting key '${key}'`, 422);
      }

      const existing = await client.query(getSettingByKey, [key]);
      if (!existing.rows[0]) {
        throw new AppError("NOT_FOUND", `Setting '${key}' not found`, 404);
      }

      const row = existing.rows[0] as AppSettingRow;
      if (!row.is_editable) {
        throw new AppError("FORBIDDEN", `Setting '${key}' is not editable`, 403);
      }

      const valueType = (row.value_type || "string") as SettingValueType;
      const serialized = serializeSettingValue(value, valueType);
      validateUrlIfNeeded(key, serialized);

      const result = await client.query(updateSettingValue, [key, serialized, actorId]);
      if (!result.rows[0]) {
        throw new AppError("FORBIDDEN", `Setting '${key}' is not editable`, 403);
      }

      await logSettingActivity(
        actorId,
        "update_app_setting",
        row.id,
        { key, value: serialized },
        { key, value: row.value },
        meta
      );
      updated.push(key);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  invalidateSettingsCache();
  return { updated_keys: updated, count: updated.length };
};

export const updateSettingByKey = async (
  key: string,
  value: unknown,
  actorId: string,
  meta?: { ip?: string; userAgent?: string }
) => {
  if (!SETTINGS_BY_KEY.has(key)) {
    throw new AppError("VALIDATION_ERROR", `Unknown setting key '${key}'`, 422);
  }

  const existing = await pool.query(getSettingByKey, [key]);
  if (!existing.rows[0]) {
    throw new AppError("NOT_FOUND", `Setting '${key}' not found`, 404);
  }

  const row = existing.rows[0] as AppSettingRow;
  if (!row.is_editable) {
    throw new AppError("FORBIDDEN", `Setting '${key}' is not editable`, 403);
  }

  const valueType = (row.value_type || "string") as SettingValueType;
  const serialized = serializeSettingValue(value, valueType);
  validateUrlIfNeeded(key, serialized);

  const result = await pool.query(updateSettingValue, [key, serialized, actorId]);
  if (!result.rows[0]) {
    throw new AppError("FORBIDDEN", `Setting '${key}' is not editable`, 403);
  }

  await logSettingActivity(
    actorId,
    "update_app_setting",
    row.id,
    { key, value: serialized },
    { key, value: row.value },
    meta
  );

  invalidateSettingsCache();

  const updated = result.rows[0] as AppSettingRow;
  return {
    key: updated.key,
    value: parseSettingValue(updated.value, valueType),
    raw_value: updated.value,
    value_type: valueType,
    is_public: updated.is_public,
    is_editable: updated.is_editable,
    description: updated.description,
    category: updated.category,
    updated_at: updated.updated_at,
    updated_by: updated.updated_by,
  };
};

export const getPublicSettings = async (opts?: {
  platform?: "android" | "ios";
  app_version?: string;
}) => {
  const cache = await loadPublicCache();
  const nested = nestPublicSettings(cache.rows);

  const data: Record<string, unknown> = { ...nested };

  if (opts?.platform && opts?.app_version) {
    data.version_check = buildVersionCheck(nested, opts.platform, opts.app_version);
  }

  return {
    data,
    etag: cache.maxUpdatedAt ? `W/"settings-${cache.maxUpdatedAt}"` : undefined,
    maxUpdatedAt: cache.maxUpdatedAt,
  };
};

// Typed getters for internal use (optional thin wrappers)
export const getString = async (key: string, fallback = ""): Promise<string> => {
  const result = await pool.query(getSettingByKey, [key]);
  if (!result.rows[0]) return fallback;
  return String(result.rows[0].value ?? fallback);
};

export const getNumber = async (key: string, fallback = 0): Promise<number> => {
  const raw = await getString(key, String(fallback));
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

export const getBoolean = async (key: string, fallback = false): Promise<boolean> => {
  const raw = await getString(key, String(fallback));
  return raw === "true" || raw === "1";
};

export const getJson = async <T = unknown>(key: string, fallback: T): Promise<T> => {
  const raw = await getString(key, "");
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};
