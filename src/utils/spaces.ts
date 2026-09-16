import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "../config/s3";
import { env } from "../config/env";

const LOCAL_UPLOAD_PREFIXES = ["http://localhost:", "http://127.0.0.1:"];

export const extractSpacesKey = (url: string): string =>
  decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ""));

/** True if an object exists at the given key in the Spaces bucket. */
export const spacesObjectExists = async (key: string): Promise<boolean> => {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: env.DO_SPACES_BUCKET, Key: key }));
    return true;
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404 || status === 403) return false;
    throw err;
  }
};

/** Temporary signed URL for private bucket objects (e.g. invoices). */
export const getSignedDownloadUrl = async (
  storedUrl: string,
  expiresInSeconds = 3600
): Promise<string> => {
  if (LOCAL_UPLOAD_PREFIXES.some((prefix) => storedUrl.startsWith(prefix))) {
    return storedUrl;
  }

  const key = extractSpacesKey(storedUrl);
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: env.DO_SPACES_BUCKET, Key: key }),
    { expiresIn: expiresInSeconds }
  );
};
