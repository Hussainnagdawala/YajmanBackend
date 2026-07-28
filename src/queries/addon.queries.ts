export const listActiveAddons = `
  SELECT * FROM addons WHERE is_active = true ORDER BY display_order, name
`;

export const listAllAddons = `SELECT * FROM addons ORDER BY display_order, name`;

export const findAddonById = `SELECT * FROM addons WHERE id = $1`;

export const createAddon = `
  INSERT INTO addons (name, slug, image_url, price, display_order)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING *
`;

export const updateAddon = (fields: string[]) => `
  UPDATE addons SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}, updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

export const softDeleteAddon = `
  UPDATE addons SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *
`;

// ─── Service <-> addon junction (standalone — no relation to service_types/tags) ───

export const clearServiceAddons = `DELETE FROM service_addons WHERE service_id = $1`;
export const setServiceAddons = `
  INSERT INTO service_addons (service_id, addon_id)
  SELECT $1, unnest($2::uuid[])
  ON CONFLICT (service_id, addon_id) DO NOTHING
`;

// Addons actually assigned to a service — used at checkout time to validate
// that requested addon_ids are legitimate for the service being booked.
export const listAddonsForService = `
  SELECT a.* FROM addons a
  JOIN service_addons sa ON sa.addon_id = a.id
  WHERE sa.service_id = $1 AND a.is_active = true
`;
