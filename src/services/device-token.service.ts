import { pool } from "../config/database";
import { logger } from "../config/logger";
import { upsertDeviceToken, deactivateDeviceToken } from "../queries/device.queries";

export type NotificationChannel = "app" | "web";
export type DeviceType = "android" | "ios" | "browser";
export type FcmPlatform = "web" | "android" | "ios";
export type DeviceSource = "web" | "app" | "portal";
export type PlatformInput = NotificationChannel | FcmPlatform;

export interface StoreDeviceTokenOptions {
  deviceToken?: string | null;
  platform?: PlatformInput;
  deviceType?: DeviceType;
  browser?: string;
  deviceSource?: DeviceSource;
  deviceInfo?: Record<string, unknown> | null;
}

export const maskDeviceToken = (token: string): string =>
  token.length <= 8 ? "***" : `${token.slice(0, 4)}...${token.slice(-4)}`;

const normalizePlatform = (
  platform: PlatformInput | undefined,
  deviceType: DeviceType | undefined,
  deviceSource: DeviceSource,
): { fcmPlatform: FcmPlatform; channel: NotificationChannel; deviceType: DeviceType } => {
  if (platform === "android") {
    return { fcmPlatform: "android", channel: "app", deviceType: deviceType ?? "android" };
  }
  if (platform === "ios") {
    return { fcmPlatform: "ios", channel: "app", deviceType: deviceType ?? "ios" };
  }
  if (platform === "web") {
    return { fcmPlatform: "web", channel: "web", deviceType: deviceType ?? "browser" };
  }
  if (platform === "app") {
    const resolvedType: DeviceType = deviceType === "ios" ? "ios" : "android";
    return {
      fcmPlatform: resolvedType === "ios" ? "ios" : "android",
      channel: "app",
      deviceType: resolvedType,
    };
  }
  if (platform === "web") {
    return { fcmPlatform: "web", channel: "web", deviceType: deviceType ?? "browser" };
  }

  if (deviceSource === "app") {
    const resolvedType: DeviceType = deviceType === "ios" ? "ios" : "android";
    return {
      fcmPlatform: resolvedType === "ios" ? "ios" : "android",
      channel: "app",
      deviceType: resolvedType,
    };
  }

  return { fcmPlatform: "web", channel: "web", deviceType: deviceType ?? "browser" };
};

const buildDeviceInfo = (
  options: StoreDeviceTokenOptions,
  channel: NotificationChannel,
  deviceType: DeviceType,
): Record<string, unknown> | null => {
  const base: Record<string, unknown> = {
    ...(options.deviceInfo ?? {}),
    channel,
    device_type: deviceType,
  };

  if (options.browser) base.browser = options.browser;
  if (options.deviceSource) base.device_source = options.deviceSource;

  return Object.keys(base).length > 0 ? base : null;
};

export const storeDeviceTokenForUser = async (
  userId: string,
  options: StoreDeviceTokenOptions & { required?: boolean },
): Promise<Record<string, unknown> | null> => {
  const token = options.deviceToken?.trim();
  if (!token) return null;

  const { fcmPlatform, channel, deviceType } = normalizePlatform(
    options.platform,
    options.deviceType,
    options.deviceSource ?? "web",
  );
  const deviceInfo = buildDeviceInfo(options, channel, deviceType);

  try {
    const result = await pool.query(upsertDeviceToken, [userId, token, fcmPlatform, deviceInfo]);
    logger.info("Device token stored", {
      userId,
      channel,
      deviceType,
      fcmPlatform,
      token: maskDeviceToken(token),
    });
    return result.rows[0] ?? null;
  } catch (err) {
    logger.error("Failed to store device token", {
      userId,
      channel,
      deviceType,
      fcmPlatform,
      token: maskDeviceToken(token),
      err,
    });
    if (options.required) throw err;
    return null;
  }
};

export const deactivateDeviceTokenForUser = async (
  userId: string,
  deviceToken?: string | null,
): Promise<boolean> => {
  const token = deviceToken?.trim();
  if (!token) return false;

  try {
    const result = await pool.query(deactivateDeviceToken, [token, userId]);
    if (result.rows[0]) {
      logger.debug("Device token deactivated", { userId, token: maskDeviceToken(token) });
      return true;
    }
    return false;
  } catch (err) {
    logger.error("Failed to deactivate device token", {
      userId,
      token: maskDeviceToken(token),
      err,
    });
    return false;
  }
};
