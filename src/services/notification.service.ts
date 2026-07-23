import { pool } from "../config/database";
import { logger } from "../config/logger";

export type NotificationType = "booking_update" | "pandit_assigned" | "payment" | "review" | "promo";

// In-app only (writes to `notifications`, readable via a future GET /notifications).
// Push/WhatsApp delivery is not wired — see README known gaps. Fire-and-forget:
// errors are swallowed so a failed notification insert never breaks the caller's
// actual action (e.g. accepting an assignment should succeed even if notifying fails).
export const createNotification = async (
  userId: string,
  title: string,
  body: string,
  type: NotificationType,
  referenceType?: string,
  referenceId?: string
): Promise<void> => {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, title, body, type, reference_type, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, title, body, type, referenceType ?? null, referenceId ?? null]
    );
  } catch (err) {
    logger.error("Failed to create notification", { err, userId, type });
  }
};
