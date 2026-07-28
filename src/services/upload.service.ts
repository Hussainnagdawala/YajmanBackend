import fs from "fs/promises";
import path from "path";
// import { DeleteObjectCommand } from "@aws-sdk/client-s3";
// import { s3Client } from "../config/s3";
// import { env } from "../config/env";
import { logger } from "../config/logger";

// ── LOCAL DISK DELETE (active) ───────────────────────────────
// Temporary stand-in for S3 until real AWS credentials exist — mirrors
// middleware/upload.ts's storage swap. Best-effort: a failed delete here
// should never break the caller's actual action.
export const deleteFromS3 = async (url: string): Promise<void> => {
  try {
    const pathname = new URL(url).pathname; // e.g. /uploads/services/169...-photo.jpg
    const filePath = path.join(process.cwd(), pathname.replace(/^\/+/, ""));
    await fs.unlink(filePath);
  } catch (err) {
    logger.error("Failed to delete local uploaded file", { url, err });
  }
};

// ── S3 DELETE (disabled) ──────────────────────────────────────
// To switch back: uncomment this, delete the local-disk version above, and
// restore the three commented imports at the top of this file.
// export const deleteFromS3 = async (url: string): Promise<void> => {
//   try {
//     const key = new URL(url).pathname.replace(/^\/+/, "");
//     await s3Client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
//   } catch (err) {
//     logger.error("Failed to delete S3 object", { url, err });
//   }
// };
