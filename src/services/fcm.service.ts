import { pool } from "../config/database";
import { env } from "../config/env";
import { getMessaging, isFirebaseReady, initFirebase } from "../config/firebase";
import { logger } from "../config/logger";
import { deactivateTokensByValues } from "../queries/notification.queries";
import {
  listActiveTokensForUsers,
  listActiveAppTokensForUsers,
  listActiveWebTokensForUsers,
} from "../queries/device.queries";

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

const frontendOrigin = (): string | undefined => {
  const raw = (env.FRONTEND_URL || "").trim();
  const candidates = [raw, raw.replace(/^(https?)\s+/i, "$1://")];
  for (const candidate of candidates) {
    try {
      return new URL(candidate).origin;
    } catch {
      /* try next */
    }
  }
  return undefined;
};

const resolveWebClickLink = (deepLink?: string): string | undefined => {
  if (deepLink && /^https?:\/\//i.test(deepLink)) return deepLink;
  const origin = frontendOrigin();
  if (!origin) return undefined;
  if (deepLink?.startsWith("/")) return `${origin}${deepLink}`;
  return `${origin}/profile/notifications`;
};

type PushChannel = "app" | "web";

export const sendPushToTokens = async (
  tokens: string[],
  payload: PushPayload,
  channel: PushChannel = "app"
): Promise<PushSendResult> => {
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [], skipped: false };
  }

  initFirebase();
  const messaging = getMessaging();
  if (!messaging || !isFirebaseReady()) {
    logger.warn("NOTIFICATION FCM skipped — Firebase not configured", { tokenCount: tokens.length });
    return { successCount: 0, failureCount: 0, invalidTokens: [], skipped: true };
  }

  let successCount = 0;
  let failureCount = 0;
  const invalidTokens: string[] = [];
  const data = toStringData({
    title: payload.title,
    body: payload.body,
    ...payload.data,
  });
  const webLink = resolveWebClickLink(payload.data?.deep_link);

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    try {
      // App: notification payload so Android/iOS show the system banner.
      // Web: data-only so the site service worker can showNotification.
      // Chrome often does not auto-display FCM `notification`/`webpush.notification`
      // while a tab is open, and a relative icon URL can also suppress the popup.
      const response = await messaging.sendEachForMulticast(
        channel === "web"
          ? {
              tokens: batch,
              data,
              webpush: {
                headers: { Urgency: "high" },
                ...(webLink ? { fcmOptions: { link: webLink } } : {}),
              },
            }
          : {
              tokens: batch,
              notification: {
                title: payload.title,
                body: payload.body,
                ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
              },
              data,
            }
      );

      successCount += response.successCount;
      failureCount += response.failureCount;

      response.responses.forEach((res: { success: boolean; error?: { code?: string; message?: string } }, idx: number) => {
        if (res.success) return;
        const code = res.error?.code ?? "";
        logger.debug("NOTIFICATION FCM token failed", {
          code,
          message: res.error?.message,
        });
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
      logger.info("NOTIFICATION deactivated invalid FCM tokens", { count: invalidTokens.length });
    } catch (err) {
      logger.error("Failed to deactivate invalid FCM tokens", { err });
    }
  }

  logger.info("NOTIFICATION push sent", {
    channel,
    successCount,
    failureCount,
    invalidCount: invalidTokens.length,
  });

  return { successCount, failureCount, invalidTokens, skipped: false };
};

export const sendPushToUsers = async (
  userIds: string[],
  payload: PushPayload
): Promise<PushSendResult> => {
  if (userIds.length === 0) {
    logger.warn("NOTIFICATION no recipients");
    return { successCount: 0, failureCount: 0, invalidTokens: [], skipped: false };
  }

  const [allTokens, appTokens, webTokens] = await Promise.all([
    pool.query(listActiveTokensForUsers, [userIds]),
    pool.query(listActiveAppTokensForUsers, [userIds]),
    pool.query(listActiveWebTokensForUsers, [userIds]),
  ]);

  const tokens = allTokens.rows.map((row: { token: string }) => row.token);
  logger.info("NOTIFICATION device tokens", {
    recipientCount: userIds.length,
    totalTokens: tokens.length,
    appTokens: appTokens.rows.length,
    webTokens: webTokens.rows.length,
  });

  if (tokens.length === 0) {
    logger.warn("NOTIFICATION no active device tokens for recipients — website/app must register device_token after login");
    return { successCount: 0, failureCount: 0, invalidTokens: [], skipped: false };
  }

  if (webTokens.rows.length === 0) {
    logger.warn("NOTIFICATION no active web tokens — browser popup will not appear");
  }

  const appTokenList = appTokens.rows.map((row: { token: string }) => row.token);
  const webTokenList = webTokens.rows.map((row: { token: string }) => row.token);

  const [appResult, webResult] = await Promise.all([
    sendPushToTokens(appTokenList, payload, "app"),
    sendPushToTokens(webTokenList, payload, "web"),
  ]);

  return {
    successCount: appResult.successCount + webResult.successCount,
    failureCount: appResult.failureCount + webResult.failureCount,
    invalidTokens: [...appResult.invalidTokens, ...webResult.invalidTokens],
    skipped:
      (appTokenList.length > 0 && appResult.skipped) ||
      (webTokenList.length > 0 && webResult.skipped),
  };
};
