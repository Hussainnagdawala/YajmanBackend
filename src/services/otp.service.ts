import { pool } from "../config/database";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { AppError } from "../utils/errors";
import { generateOtp } from "../utils/crypto";

const MAX_ATTEMPTS = 5;
const MAX_ATTEMPTS_PER_HOUR = 10;
const PURPOSE_LOGIN = "login";

const sendViaWhatsApp = async (phone: string, countryCode: string, otp: string): Promise<void> => {
  const to = `${countryCode.replace("+", "")}${phone}`;
  const url = `https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const components: unknown[] = [
    { type: "body", parameters: [{ type: "text", text: otp }] },
  ];
  if (env.WHATSAPP_OTP_HAS_BUTTON) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: otp }],
    });
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: env.WHATSAPP_OTP_TEMPLATE,
        language: { code: env.WHATSAPP_OTP_LANG },
        components,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    logger.error("WhatsApp OTP send failed", { status: res.status, body });
    throw new AppError("OTP_SEND_FAILED", "Failed to send OTP", 502);
  }
};

const sendViaProvider = async (phone: string, countryCode: string, otp: string): Promise<void> => {
  if (env.OTP_PROVIDER === "whatsapp") {
    // TEMP: WhatsApp send disabled — OTP is fixed to 123456 for now.
    // Re-enable by uncommenting the sendViaWhatsApp call below and restoring
    // the real OTP in sendOtp().
    logger.debug(`[OTP:whatsapp:disabled] ${countryCode}${phone} -> ${otp}`);
    return;
    // if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    //   logger.debug(`[OTP:whatsapp:dev] ${countryCode}${phone} -> ${otp}`);
    //   return;
    // }
    // await sendViaWhatsApp(phone, countryCode, otp);
    // return;
  }

  if (env.NODE_ENV !== "production" || !env.OTP_API_KEY) {
    logger.debug(`[OTP] ${countryCode}${phone} -> ${otp}`);
    return;
  }

  if (env.OTP_PROVIDER === "msg91") {
    const res = await fetch("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: env.OTP_API_KEY },
      body: JSON.stringify({
        template_id: env.OTP_TEMPLATE_ID,
        mobile: `${countryCode.replace("+", "")}${phone}`,
        otp,
        sender: env.OTP_SENDER_ID,
      }),
    });
    if (!res.ok) {
      logger.error("OTP provider send failed", { status: res.status });
      throw new AppError("OTP_SEND_FAILED", "Failed to send OTP", 502);
    }
  }
};

export const sendOtp = async (phone: string, countryCode: string): Promise<{ expires_in: number }> => {
  // TEMP: fixed OTP while WhatsApp send is disabled. Restore: generateOtp(6)
  const otp = "123456";
  const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

  await pool.query(
    `INSERT INTO otp_verifications (phone, country_code, otp_code, purpose, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [phone, countryCode, otp, PURPOSE_LOGIN, expiresAt]
  );

  await sendViaProvider(phone, countryCode, otp);

  return { expires_in: env.OTP_EXPIRY_MINUTES * 60 };
};

export const verifyOtp = async (phone: string, otp: string): Promise<void> => {
  const recentAttempts = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(attempts), 0) AS total FROM otp_verifications
     WHERE phone = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [phone]
  );
  if (Number(recentAttempts.rows[0].total) >= MAX_ATTEMPTS_PER_HOUR) {
    throw new AppError("TOO_MANY_ATTEMPTS", "Too many failed attempts, try again later", 429);
  }

  const result = await pool.query(
    `SELECT id, otp_code, attempts, max_attempts, expires_at, is_verified FROM otp_verifications
     WHERE phone = $1 AND purpose = $2
     ORDER BY created_at DESC LIMIT 1`,
    [phone, PURPOSE_LOGIN]
  );
  const record = result.rows[0];

  if (!record) throw new AppError("OTP_INVALID", "No OTP requested for this phone", 400);
  if (record.is_verified) throw new AppError("OTP_INVALID", "OTP already used", 400);
  if (new Date(record.expires_at) <= new Date()) throw new AppError("OTP_EXPIRED", "OTP has expired", 400);
  if (record.attempts >= record.max_attempts) {
    throw new AppError("OTP_LOCKED", "Maximum verification attempts exceeded", 400);
  }

  if (otp !== record.otp_code) {
    await pool.query(`UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1`, [record.id]);
    throw new AppError("OTP_INVALID", "Invalid OTP", 400);
  }

  await pool.query(`UPDATE otp_verifications SET is_verified = true WHERE id = $1`, [record.id]);
};
