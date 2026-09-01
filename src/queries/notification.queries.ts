export const createCampaign = `
  INSERT INTO notification_campaigns (
    title, message, image_url, type, target_type, target_user_ids, status,
    deep_link, action_type, action_value, scheduled_at, created_by
  ) VALUES (
    $1, $2, $3, $4,
    $5::notification_target_type,
    $6::uuid[],
    $7::notification_campaign_status,
    $8, $9, $10, $11, $12
  )
  RETURNING *
`;

export const getCampaignById = `
  SELECT nc.*,
    u.name AS created_by_name,
    (
      SELECT COUNT(*)::int FROM notifications n
      WHERE n.campaign_id = nc.id AND n.is_read = true AND n.deleted_at IS NULL
    ) AS read_count,
    (
      SELECT COUNT(*)::int FROM notifications n
      WHERE n.campaign_id = nc.id AND n.clicked_at IS NOT NULL AND n.deleted_at IS NULL
    ) AS click_count
  FROM notification_campaigns nc
  LEFT JOIN users u ON u.id = nc.created_by
  WHERE nc.id = $1
`;

export const lockCampaignForSend = `
  SELECT * FROM notification_campaigns
  WHERE id = $1
  FOR UPDATE
`;

export const updateCampaign = (fields: string[]) => `
  UPDATE notification_campaigns
  SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}
  WHERE id = $1
  RETURNING *
`;

export const deleteDraftCampaign = `
  DELETE FROM notification_campaigns
  WHERE id = $1 AND status = 'draft'
  RETURNING *
`;

export const cancelScheduledCampaign = `
  UPDATE notification_campaigns
  SET status = 'cancelled'
  WHERE id = $1 AND status = 'scheduled'
  RETURNING *
`;

export const listDueScheduledCampaigns = `
  SELECT id FROM notification_campaigns
  WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= NOW()
  ORDER BY scheduled_at ASC
  LIMIT 20
`;

export const insertInboxBulk = `
  INSERT INTO notifications (
    user_id, campaign_id, title, body, type, image_url, deep_link,
    action_type, action_value, delivery_status
  )
  SELECT
    uid,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    'pending'
  FROM unnest($1::uuid[]) AS uid
  RETURNING id, user_id
`;

export const insertInboxSingle = `
  INSERT INTO notifications (
    user_id, title, body, type, reference_type, reference_id,
    delivery_status, image_url, deep_link, action_type, action_value, campaign_id
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  RETURNING *
`;

export const updateInboxDeliveryStatus = `
  UPDATE notifications
  SET delivery_status = $2::notification_delivery_status,
      failure_reason = $3,
      delivered_at = CASE WHEN $2::text IN ('delivered', 'sent') THEN COALESCE(delivered_at, NOW()) ELSE delivered_at END
  WHERE id = ANY($1::uuid[])
`;

export const listCampaignRecipients = `
  SELECT n.*,
    u.name AS user_name,
    u.phone AS user_phone,
    u.email AS user_email
  FROM notifications n
  JOIN users u ON u.id = n.user_id
  WHERE n.campaign_id = $1
  ORDER BY n.created_at DESC
  LIMIT $2 OFFSET $3
`;

export const countCampaignRecipients = `
  SELECT COUNT(*)::int AS count FROM notifications WHERE campaign_id = $1
`;

export const listActiveCustomerIds = `
  SELECT id FROM users
  WHERE role = 'customer' AND status = 'active'
`;

export const listExistingUserIds = `
  SELECT id FROM users WHERE id = ANY($1::uuid[])
`;

export const deactivateTokensByValues = `
  UPDATE device_tokens
  SET is_active = false
  WHERE token = ANY($1::text[])
  RETURNING token
`;

export const insertActivityLog = `
  INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_data, new_data, ip_address, user_agent)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING *
`;

export const listUserInbox = `
  SELECT * FROM notifications
  WHERE user_id = $1
    AND deleted_at IS NULL
    AND ($4::boolean IS NULL OR is_read = $4)
  ORDER BY created_at DESC
  LIMIT $2 OFFSET $3
`;

export const countUserInbox = `
  SELECT COUNT(*)::int AS count FROM notifications
  WHERE user_id = $1
    AND deleted_at IS NULL
    AND ($2::boolean IS NULL OR is_read = $2)
`;

export const getUserNotificationById = `
  SELECT * FROM notifications
  WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
`;

export const markNotificationRead = `
  UPDATE notifications
  SET is_read = true, read_at = COALESCE(read_at, NOW())
  WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
  RETURNING *
`;

export const markAllNotificationsRead = `
  UPDATE notifications
  SET is_read = true, read_at = COALESCE(read_at, NOW())
  WHERE user_id = $1 AND deleted_at IS NULL AND is_read = false
  RETURNING id
`;

export const markNotificationClicked = `
  UPDATE notifications
  SET clicked_at = COALESCE(clicked_at, NOW()),
      is_read = true,
      read_at = COALESCE(read_at, NOW())
  WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
  RETURNING *
`;

export const softDeleteNotification = `
  UPDATE notifications
  SET deleted_at = NOW()
  WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
  RETURNING *
`;

export const clearUserNotifications = `
  UPDATE notifications
  SET deleted_at = NOW()
  WHERE user_id = $1 AND deleted_at IS NULL
  RETURNING id
`;

export const unreadCountForUser = `
  SELECT COUNT(*)::int AS count FROM notifications
  WHERE user_id = $1 AND deleted_at IS NULL AND is_read = false
`;
