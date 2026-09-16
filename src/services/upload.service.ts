import fs from "fs/promises";
import path from "path";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../config/s3";
import { env } from "../config/env";
import { logger } from "../config/logger";

// ── LOCAL DISK DELETE (disabled) ─────────────────────────────
/* export const deleteFromS3 = async (url: string): Promise<void> => {
  try {
    const pathname = new URL(url).pathname; // e.g. /uploads/services/169...-photo.jpg
    const filePath = path.join(process.cwd(), pathname.replace(/^\/+/, ""));
    await fs.unlink(filePath);
  } catch (err) {
    logger.error("Failed to delete local uploaded file", { url, err });
  }
}; */

// ── S3 DELETE (active) ────────────────────────────────────────
export const deleteFromS3 = async (url: string): Promise<void> => {
  try {
    const key = new URL(url).pathname.replace(/^\/+/, "");
    await s3Client.send(new DeleteObjectCommand({ Bucket: env.DO_SPACES_BUCKET, Key: key }));
  } catch (err) {
    logger.error("Failed to delete S3 object", { url, err });
  }
};
