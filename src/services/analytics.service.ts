import crypto from "crypto";
import { Request } from "express";
import { pool } from "../config/database";
import { logger } from "../config/logger";
import { insertAnalyticsEvent } from "../queries/analytics.queries";

export type AnalyticsEntityType = "service" | "aayojan_event" | "blog";

const hashVisitor = (ip: string, userAgent: string): string =>
  crypto.createHash("sha256").update(`${ip}|${userAgent}`).digest("hex");

// Fire-and-forget: never awaited by callers, never throws into the request
// path. A tracking failure must not turn a page view into a 500 — same
// pattern as notification.service.ts's createNotification.
export const trackView = (req: Request, entityType: AnalyticsEntityType, entityId: string): void => {
  const userAgent = req.headers["user-agent"] ?? "";
  const visitorHash = hashVisitor(req.ip ?? "", userAgent);

  void pool
    .query(insertAnalyticsEvent, [entityType, entityId, "view", req.user?.id ?? null, visitorHash, userAgent])
    .catch((err) => logger.error("Failed to record view event", { err, entityType, entityId }));
};
