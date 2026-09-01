export const upsertDeviceToken = `
  INSERT INTO device_tokens (user_id, token, platform, device_info, is_active, last_used_at)
  VALUES ($1, $2, $3, $4, true, NOW())
  ON CONFLICT (token) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    platform = EXCLUDED.platform,
    device_info = EXCLUDED.device_info,
    is_active = true,
    last_used_at = NOW()
  RETURNING *
`;

export const listDeviceTokensForUser = `
  SELECT * FROM device_tokens WHERE user_id = $1 AND is_active = true ORDER BY last_used_at DESC
`;

export const deactivateDeviceToken = `
  UPDATE device_tokens SET is_active = false WHERE token = $1 AND user_id = $2 RETURNING *
`;

export const listActiveTokensForUsers = `
  SELECT * FROM device_tokens WHERE user_id = ANY($1::uuid[]) AND is_active = true
`;

export const listActiveAppTokensForUsers = `
  SELECT * FROM device_tokens
  WHERE user_id = ANY($1::uuid[])
    AND is_active = true
    AND platform IN ('android', 'ios')
`;

export const listActiveWebTokensForUsers = `
  SELECT * FROM device_tokens
  WHERE user_id = ANY($1::uuid[])
    AND is_active = true
    AND platform = 'web'
`;
