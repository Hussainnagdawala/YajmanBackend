export const listAllSettings = `
  SELECT id, key, value, description, category, value_type, is_public, is_editable,
         updated_by, updated_at
  FROM app_settings
  ORDER BY category ASC, key ASC
`;

export const listSettingsByCategory = `
  SELECT id, key, value, description, category, value_type, is_public, is_editable,
         updated_by, updated_at
  FROM app_settings
  WHERE category = $1
  ORDER BY key ASC
`;

export const listPublicSettings = `
  SELECT key, value, category, value_type, updated_at
  FROM app_settings
  WHERE is_public = true
  ORDER BY category ASC, key ASC
`;

export const getSettingByKey = `
  SELECT id, key, value, description, category, value_type, is_public, is_editable,
         updated_by, updated_at
  FROM app_settings
  WHERE key = $1
`;

export const getSettingsByKeys = `
  SELECT key, value, category, value_type, is_public, is_editable
  FROM app_settings
  WHERE key = ANY($1::text[])
`;

export const updateSettingValue = `
  UPDATE app_settings
  SET value = $2, updated_by = $3, updated_at = NOW()
  WHERE key = $1 AND is_editable = true
  RETURNING id, key, value, description, category, value_type, is_public, is_editable,
            updated_by, updated_at
`;

export const getMaxUpdatedAt = `
  SELECT MAX(updated_at) AS max_updated_at FROM app_settings
`;

export const insertActivityLog = `
  INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_data, new_data, ip_address, user_agent)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`;
