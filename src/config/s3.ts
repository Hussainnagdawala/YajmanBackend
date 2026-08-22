import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";

export const s3Client = new S3Client({
  endpoint: env.DO_SPACES_ENDPOINT,
  region: "us-east-1", // DO Spaces fallback region
  credentials: {
    accessKeyId: env.DO_SPACES_KEY,
    secretAccessKey: env.DO_SPACES_SECRET,
  },
});
