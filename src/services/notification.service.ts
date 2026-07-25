import { pool } from "../config/database";
import { logger } from "../config/logger";
import { AppError } from "../utils/errors";
import { paginate } from "../utils/pagination";
import { sendPushToUsers } from "./fcm.service";
import {
  createCampaign,
  getCampaignById,
  lockCampaignForSend,
  updateCampaign,
  deleteDraftCampaign,
  cancelScheduledCampaign,
  listDueScheduledCampaigns,
  insertInboxBulk,
  insertInboxSingle,
  updateInboxDeliveryStatus,
  listCampaignRecipients,
  countCampaignRecipients,
  listActiveCustomerIds,
  listExistingUserIds,
  insertActivityLog,
  listUserInbox,
  countUserInbox,
  getUserNotificationById,
  markNotificationRead,
  markAllNotificationsRead,
  markNotificationClicked,
  softDeleteNotification,
  clearUserNotifications,
  unreadCountForUser,
} from "../queries/notification.queries";

export type NotificationType =
  | "booking_update"
  | "pandit_assigned"
  | "payment"
  | "review"
  | "promo"
  | "system"
  | "announcement";

export interface CampaignInput {
  title: string;
  message: string;
  type?: string;
  target_type: "all" | "selected";
  target_user_ids?: string[];
  deep_link?: string | null;
  action_type?: string | null;
  action_value?: string | null;
  scheduled_at?: Date | null;
  image_url?: string | null;
}

export interface ListCampaignsFilters {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  target_type?: string;
  sort: string;
  order: "asc" | "desc";
  from?: Date;
  to?: Date;
}

const ALLOWED_UPDATE_FIELDS = new Set([
  "title",
  "message",
  "type",
  "target_type",
  "target_user_ids",
  "deep_link",
  "action_type",
  "action_value",
  "scheduled_at",
  "image_url",
  "status",
]);

const SORTABLE_COLUMNS = new Set(["created_at", "sent_at", "scheduled_at", "title"]);

export const logNotificationActivity = async (
  userId: string | undefined,
  action: string,
  entityId: string,
  newData?: unknown,
  oldData?: unknown,
  meta?: { ip?: string; userAgent?: string }
): Promise<void> => {
  try {
    await pool.query(insertActivityLog, [
      userId ?? null,
      action,
      "notification_campaign",
      entityId,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
      meta?.ip ?? null,
      meta?.userAgent ?? null,
    ]);
  } catch (err) {
    logger.error("Failed to write activity log", { err, action, entityId });
  }
};

const resolveAudience = async (
  targetType: "all" | "selected" | string,
  targetUserIds?: string[] | null
): Promise<string[]> => {
  if (targetType === "all") {
    const result = await pool.query(listActiveCustomerIds);
    return result.rows.map((r: { id: string }) => r.id);
  }

  if (targetType === "selected") {
    const ids = targetUserIds ?? [];
    if (ids.length === 0) {
      throw new AppError("VALIDATION_ERROR", "No users selected for notification", 400);
    }
    const result = await pool.query(listExistingUserIds, [ids]);
    const found = result.rows.map((r: { id: string }) => r.id);
    if (found.length === 0) {
      throw new AppError("VALIDATION_ERROR", "None of the selected users exist", 400);
    }
    return found;
  }

  throw new AppError("VALIDATION_ERROR", `Unsupported target_type: ${targetType}`, 400);
};

const deriveStatus = (scheduledAt?: Date | null): "draft" | "scheduled" => {
  if (scheduledAt && scheduledAt.getTime() > Date.now()) return "scheduled";
  return "draft";
};

export const createNotificationCampaign = async (
  input: CampaignInput,
  createdBy: string,
  meta?: { ip?: string; userAgent?: string }
) => {
  const status = deriveStatus(input.scheduled_at);
  const result = await pool.query(createCampaign, [
    input.title,
    input.message,
    input.image_url ?? null,
    input.type ?? "promo",
    input.target_type,
    input.target_type === "selected" ? input.target_user_ids ?? [] : null,
    status,
    input.deep_link ?? null,
    input.action_type ?? null,
    input.action_value ?? null,
    input.scheduled_at ?? null,
    createdBy,
  ]);

  const campaign = result.rows[0];
  await logNotificationActivity(createdBy, "create_notification_campaign", campaign.id, campaign, undefined, meta);
  return campaign;
};

export const listNotificationCampaigns = async (filters: ListCampaignsFilters) => {
  const { limit, offset, meta } = paginate(filters.page, filters.limit);
  const sort = SORTABLE_COLUMNS.has(filters.sort) ? filters.sort : "created_at";
  const order = filters.order === "asc" ? "ASC" : "DESC";

  const where: string[] = [];
  const values: unknown[] = [];

  if (filters.search) {
    values.push(`%${filters.search}%`);
    where.push(`(nc.title ILIKE $${values.length} OR nc.message ILIKE $${values.length})`);
  }
  if (filters.status) {
    values.push(filters.status);
    where.push(`nc.status = $${values.length}`);
  }
  if (filters.target_type) {
    values.push(filters.target_type);
    where.push(`nc.target_type = $${values.length}`);
  }
  if (filters.from) {
    values.push(filters.from);
    where.push(`nc.created_at >= $${values.length}`);
  }
  if (filters.to) {
    values.push(filters.to);
    where.push(`nc.created_at < $${values.length}::date + INTERVAL '1 day'`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS count FROM notification_campaigns nc ${whereSql}`,
    values
  );
  const total = countResult.rows[0].count as number;

  values.push(limit, offset);
  const listResult = await pool.query(
    `SELECT nc.*,
      u.name AS created_by_name,
      (
        SELECT COUNT(*)::int FROM notifications n
        WHERE n.campaign_id = nc.id AND n.is_read = true AND n.deleted_at IS NULL
      ) AS read_count
     FROM notification_campaigns nc
     LEFT JOIN users u ON u.id = nc.created_by
     ${whereSql}
     ORDER BY nc.${sort} ${order} NULLS LAST
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return { rows: listResult.rows, pagination: meta(total) };
};

export const getNotificationCampaign = async (id: string, page = 1, limit = 20) => {
  const campaignResult = await pool.query(getCampaignById, [id]);
  if (!campaignResult.rows[0]) {
    throw new AppError("NOT_FOUND", "Notification campaign not found", 404);
  }

  const { limit: safeLimit, offset, meta } = paginate(page, limit);
  const [recipients, countResult] = await Promise.all([
    pool.query(listCampaignRecipients, [id, safeLimit, offset]),
    pool.query(countCampaignRecipients, [id]),
  ]);

  return {
    ...campaignResult.rows[0],
    recipients: recipients.rows,
    recipients_pagination: meta(countResult.rows[0].count as number),
  };
};

export const updateNotificationCampaign = async (
  id: string,
  input: Partial<CampaignInput>,
  actorId: string,
  meta?: { ip?: string; userAgent?: string }
) => {
  const existing = await pool.query(getCampaignById, [id]);
  if (!existing.rows[0]) throw new AppError("NOT_FOUND", "Notification campaign not found", 404);

  const campaign = existing.rows[0];
  if (!["draft", "scheduled"].includes(campaign.status)) {
    throw new AppError("CONFLICT", "Only draft or scheduled campaigns can be updated", 409);
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || !ALLOWED_UPDATE_FIELDS.has(key)) continue;
    fields.push(key);
    values.push(value);
  }

  const nextScheduled =
    input.scheduled_at !== undefined ? input.scheduled_at : campaign.scheduled_at;
  const nextStatus = deriveStatus(nextScheduled ? new Date(nextScheduled) : null);
  if (nextStatus !== campaign.status) {
    fields.push("status");
    values.push(nextStatus);
  }

  // Clearing schedule on a scheduled campaign should return it to draft
  if (input.scheduled_at === null && campaign.status === "scheduled") {
    const statusIdx = fields.indexOf("status");
    if (statusIdx >= 0) values[statusIdx] = "draft";
    else {
      fields.push("status");
      values.push("draft");
    }
  }

  if (fields.length === 0) {
    throw new AppError("VALIDATION_ERROR", "No fields to update", 400);
  }

  const result = await pool.query(updateCampaign(fields), [id, ...values]);
  await logNotificationActivity(actorId, "update_notification_campaign", id, result.rows[0], campaign, meta);
  return result.rows[0];
};

export const deleteNotificationCampaign = async (
  id: string,
  actorId: string,
  meta?: { ip?: string; userAgent?: string }
) => {
  const result = await pool.query(deleteDraftCampaign, [id]);
  if (!result.rows[0]) {
    throw new AppError("CONFLICT", "Only draft campaigns can be deleted", 409);
  }
  await logNotificationActivity(actorId, "delete_notification_campaign", id, undefined, result.rows[0], meta);
  return result.rows[0];
};

export const cancelNotificationCampaign = async (
  id: string,
  actorId: string,
  meta?: { ip?: string; userAgent?: string }
) => {
  const result = await pool.query(cancelScheduledCampaign, [id]);
  if (!result.rows[0]) {
    throw new AppError("CONFLICT", "Only scheduled campaigns can be cancelled", 409);
  }
  await logNotificationActivity(actorId, "cancel_notification_campaign", id, result.rows[0], undefined, meta);
  return result.rows[0];
};

export const duplicateNotificationCampaign = async (
  id: string,
  actorId: string,
  meta?: { ip?: string; userAgent?: string }
) => {
  const existing = await pool.query(getCampaignById, [id]);
  if (!existing.rows[0]) throw new AppError("NOT_FOUND", "Notification campaign not found", 404);
  const c = existing.rows[0];

  const duplicated = await createNotificationCampaign(
    {
      title: c.title,
      message: c.message,
      type: c.type,
      target_type: c.target_type,
      target_user_ids: c.target_user_ids ?? undefined,
      deep_link: c.deep_link,
      action_type: c.action_type,
      action_value: c.action_value,
      image_url: c.image_url,
      scheduled_at: null,
    },
    actorId,
    meta
  );

  await logNotificationActivity(actorId, "duplicate_notification_campaign", duplicated.id, duplicated, { source_id: id }, meta);
  return duplicated;
};

/**
 * Send (or re-run send for due scheduled) a campaign.
 * Locks the row, resolves audience, writes inbox rows, fans out FCM, updates counts.
 */
export const sendNotificationCampaign = async (
  id: string,
  actorId?: string,
  meta?: { ip?: string; userAgent?: string }
) => {
  const client = await pool.connect();
  let campaign: Record<string, unknown>;

  try {
    await client.query("BEGIN");
    const locked = await client.query(lockCampaignForSend, [id]);
    if (!locked.rows[0]) {
      throw new AppError("NOT_FOUND", "Notification campaign not found", 404);
    }
    campaign = locked.rows[0];

    if (!["draft", "scheduled"].includes(campaign.status as string)) {
      throw new AppError(
        "CONFLICT",
        `Cannot send campaign in status '${campaign.status}'`,
        409
      );
    }

    await client.query(
      `UPDATE notification_campaigns SET status = 'sending' WHERE id = $1`,
      [id]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  try {
    const userIds = await resolveAudience(
      campaign.target_type as string,
      campaign.target_user_ids as string[] | null
    );

    let inboxRows: { id: string; user_id: string }[] = [];
    if (userIds.length > 0) {
      const inboxResult = await pool.query(insertInboxBulk, [
        userIds,
        id,
        campaign.title,
        campaign.message,
        campaign.type,
        campaign.image_url,
        campaign.deep_link,
        campaign.action_type,
        campaign.action_value,
      ]);
      inboxRows = inboxResult.rows;
    }

    const pushResult = await sendPushToUsers(userIds, {
      title: campaign.title as string,
      body: campaign.message as string,
      imageUrl: campaign.image_url as string | null,
      data: {
        type: String(campaign.type ?? "promo"),
        deep_link: String(campaign.deep_link ?? ""),
        action_type: String(campaign.action_type ?? ""),
        action_value: String(campaign.action_value ?? ""),
        campaign_id: id,
      },
    });

    if (inboxRows.length > 0) {
      const ids = inboxRows.map((r) => r.id);
      const deliveryStatus =
        !pushResult.skipped && pushResult.successCount === 0 && pushResult.failureCount > 0
          ? "failed"
          : "sent";
      const failureReason =
        deliveryStatus === "failed" ? "FCM delivery failed for all tokens" : null;
      await pool.query(updateInboxDeliveryStatus, [ids, deliveryStatus, failureReason]);
    }

    const finalSuccess = inboxRows.length;
    const finalFailed = Math.max(0, userIds.length - inboxRows.length);

    const updated = await pool.query(
      `UPDATE notification_campaigns
       SET status = 'sent',
           sent_at = NOW(),
           total_users = $2,
           success_count = $3,
           failed_count = $4
       WHERE id = $1
       RETURNING *`,
      [id, userIds.length, finalSuccess, finalFailed]
    );

    await logNotificationActivity(
      actorId,
      "send_notification_campaign",
      id,
      {
        ...updated.rows[0],
        fcm: {
          successCount: pushResult.successCount,
          failureCount: pushResult.failureCount,
          skipped: pushResult.skipped,
        },
      },
      undefined,
      meta
    );

    return updated.rows[0];
  } catch (err) {
    logger.error("Failed to send notification campaign", { err, id });
    await pool.query(
      `UPDATE notification_campaigns SET status = 'failed' WHERE id = $1`,
      [id]
    );
    throw err;
  }
};

export const resendNotificationCampaign = async (
  id: string,
  actorId: string,
  meta?: { ip?: string; userAgent?: string }
) => {
  const existing = await pool.query(getCampaignById, [id]);
  if (!existing.rows[0]) throw new AppError("NOT_FOUND", "Notification campaign not found", 404);
  const c = existing.rows[0];

  if (!["sent", "failed"].includes(c.status)) {
    throw new AppError("CONFLICT", "Only sent or failed campaigns can be resent", 409);
  }

  const cloned = await createNotificationCampaign(
    {
      title: c.title,
      message: c.message,
      type: c.type,
      target_type: c.target_type,
      target_user_ids: c.target_user_ids ?? undefined,
      deep_link: c.deep_link,
      action_type: c.action_type,
      action_value: c.action_value,
      image_url: c.image_url,
      scheduled_at: null,
    },
    actorId,
    meta
  );

  const sent = await sendNotificationCampaign(cloned.id, actorId, meta);
  await logNotificationActivity(actorId, "resend_notification_campaign", sent.id, sent, { source_id: id }, meta);
  return sent;
};

export const processDueScheduledCampaigns = async (): Promise<number> => {
  const due = await pool.query(listDueScheduledCampaigns);
  let processed = 0;
  for (const row of due.rows) {
    try {
      await sendNotificationCampaign(row.id);
      processed += 1;
    } catch (err) {
      logger.error("Scheduled notification send failed", { err, campaignId: row.id });
    }
  }
  return processed;
};

// ─── Transactional in-app (+ optional push) ─────────────────

export const createNotification = async (
  userId: string,
  title: string,
  body: string,
  type: NotificationType,
  referenceType?: string,
  referenceId?: string
): Promise<void> => {
  try {
    const result = await pool.query(insertInboxSingle, [
      userId,
      title,
      body,
      type,
      referenceType ?? null,
      referenceId ?? null,
      "sent",
      null,
      null,
      null,
      null,
      null,
    ]);

    const row = result.rows[0];
    // Best-effort push — never fail the caller
    void sendPushToUsers([userId], {
      title,
      body,
      data: {
        type,
        notification_id: row?.id ?? "",
        reference_type: referenceType ?? "",
        reference_id: referenceId ?? "",
      },
    }).catch((err) => logger.error("Transactional push failed", { err, userId, type }));
  } catch (err) {
    logger.error("Failed to create notification", { err, userId, type });
  }
};

// ─── Mobile inbox ───────────────────────────────────────────

export const listInbox = async (
  userId: string,
  page: number,
  limit: number,
  unreadOnly?: boolean
) => {
  const { limit: safeLimit, offset, meta } = paginate(page, limit);
  const isReadFilter = unreadOnly === true ? false : null;
  const [rows, countResult] = await Promise.all([
    pool.query(listUserInbox, [userId, safeLimit, offset, isReadFilter]),
    pool.query(countUserInbox, [userId, isReadFilter]),
  ]);
  return { rows: rows.rows, pagination: meta(countResult.rows[0].count as number) };
};

export const getInboxItem = async (userId: string, id: string) => {
  const result = await pool.query(getUserNotificationById, [id, userId]);
  if (!result.rows[0]) throw new AppError("NOT_FOUND", "Notification not found", 404);
  return result.rows[0];
};

export const markRead = async (userId: string, id: string) => {
  const result = await pool.query(markNotificationRead, [id, userId]);
  if (!result.rows[0]) throw new AppError("NOT_FOUND", "Notification not found", 404);
  return result.rows[0];
};

export const markAllRead = async (userId: string) => {
  const result = await pool.query(markAllNotificationsRead, [userId]);
  return { updated: result.rowCount ?? 0 };
};

export const markClicked = async (userId: string, id: string) => {
  const result = await pool.query(markNotificationClicked, [id, userId]);
  if (!result.rows[0]) throw new AppError("NOT_FOUND", "Notification not found", 404);
  return result.rows[0];
};

export const deleteInboxItem = async (userId: string, id: string) => {
  const result = await pool.query(softDeleteNotification, [id, userId]);
  if (!result.rows[0]) throw new AppError("NOT_FOUND", "Notification not found", 404);
  return result.rows[0];
};

export const clearInbox = async (userId: string) => {
  const result = await pool.query(clearUserNotifications, [userId]);
  return { deleted: result.rowCount ?? 0 };
};

export const getUnreadCount = async (userId: string) => {
  const result = await pool.query(unreadCountForUser, [userId]);
  return { count: result.rows[0].count as number };
};
