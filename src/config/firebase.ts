import fs from "fs";
import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getMessaging as getFirebaseMessaging, Messaging } from "firebase-admin/messaging";
import { env } from "./env";
import { logger } from "./logger";

let app: App | null = null;

export const isFirebaseReady = (): boolean => app !== null;

export const initFirebase = (): boolean => {
  if (app) return true;
  if (getApps().length > 0) {
    app = getApps()[0]!;
    return true;
  }

  try {
    if (env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const raw = fs.readFileSync(env.FIREBASE_SERVICE_ACCOUNT_PATH, "utf8");
      const serviceAccount = JSON.parse(raw) as {
        project_id: string;
        client_email: string;
        private_key: string;
      };
      app = initializeApp({
        credential: cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key,
        }),
      });
      logger.info("Firebase initialized from service account file");
      return true;
    }

    if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
      const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
      app = initializeApp({
        credential: cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
      logger.info("Firebase initialized from environment credentials");
      return true;
    }

    logger.warn("Firebase credentials not configured — push notifications will no-op");
    return false;
  } catch (err) {
    logger.error("Failed to initialize Firebase", { err });
    return false;
  }
};

export const getMessaging = (): Messaging | null => {
  if (!initFirebase() || !app) return null;
  return getFirebaseMessaging(app);
};
