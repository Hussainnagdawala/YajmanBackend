import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../config/s3";
import { env } from "../config/env";
import { logger } from "../config/logger";

export const deleteFromS3 = async (url: string): Promise<void> => {
  try {
    const key = new URL(url).pathname.replace(/^\/+/, "");
    await s3Client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  } catch (err) {
    logger.error("Failed to delete S3 object", { url, err });
  }
};
