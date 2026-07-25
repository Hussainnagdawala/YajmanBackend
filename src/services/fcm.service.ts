import { pool } from "../config/database";
import { getMessaging, isFirebaseReady, initFirebase } from "../config/firebase";
import { logger } from "../config/logger";
import { deactivateTokensByValues } from "../queries/notification.queries";
import { listActiveTokensForUsers } from "../queries/device.queries";

const BATCH_SIZE = 500;

const INVALID_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

export interface PushPayload {
  title: string;
  body: string;
  imageUrl?: string | null;
  data?: Record<string, string>;
}

export interface PushSendResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
  skipped: boolean;
}

const toStringData = (data?: Record<string, string>): Record<string, string> => {
  if (!data) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) out[key] = String(value);
  }
  return out;
};

export const sendPushToTokens = async (
  tokens: string[],
  payload: PushPayload
): Promise<PushSendResult> => {
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [], skipped: false };
  }

  initFirebase();
  const messaging = getMessaging();
  if (!messaging || !isFirebaseReady()) {
    logger.warn("FCM skipped — Firebase not configured", { tokenCount: tokens.length });
    return { successCount: 0, failureCount: 0, invalidTokens: [], skipped: true };
  }

  let successCount = 0;
  let failureCount = 0;
  const invalidTokens: string[] = [];
  const data = toStringData(payload.data);

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    try {
      const response = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: {
          title: payload.title,
          body: payload.body,
          ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
        },
        data,
      });

      successCount += response.successCount;
      failureCount += response.failureCount;

      response.responses.forEach((res: { success: boolean; error?: { code?: string } }, idx: number) => {
        if (res.success) return;
        const code = res.error?.code ?? "";
        if (INVALID_TOKEN_CODES.has(code)) {
          invalidTokens.push(batch[idx]);
        }
      });
    } catch (err) {
      logger.error("FCM batch send failed", { err, batchSize: batch.length });
      failureCount += batch.length;
    }
  }

  if (invalidTokens.length > 0) {
    try {
      await pool.query(deactivateTokensByValues, [invalidTokens]);
      logger.info("Deactivated invalid FCM tokens", { count: invalidTokens.length });
    } catch (err) {
      logger.error("Failed to deactivate invalid FCM tokens", { err });
    }
  }

  return { successCount, failureCount, invalidTokens, skipped: false };
};

export const sendPushToUsers = async (
  userIds: string[],
  payload: PushPayload
): Promise<PushSendResult> => {
  if (userIds.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [], skipped: false };
  }

  const tokenResult = await pool.query(listActiveTokensForUsers, [userIds]);
  const tokens = tokenResult.rows.map((row: { token: string }) => row.token);
  return sendPushToTokens(tokens, payload);
};
