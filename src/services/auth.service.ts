import jwt from "jsonwebtoken";
import { pool } from "../config/database";
import { env } from "../config/env";
import { AppError } from "../utils/errors";
import { generateToken } from "../utils/crypto";
import { AuthUser } from "../types/models";

const EXPIRY_UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export const expiryToMs = (expiry: string): number => {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid expiry format: ${expiry}`);
  return Number(match[1]) * EXPIRY_UNIT_MS[match[2]];
};

export const signAccessToken = (user: Pick<AuthUser, "id" | "role">): string =>
  jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions["expiresIn"] });

export const issueRefreshToken = async (userId: string, deviceInfo?: Record<string, unknown>): Promise<string> => {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + expiryToMs(env.JWT_REFRESH_EXPIRY));

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token, device_info, expires_at) VALUES ($1, $2, $3, $4)`,
    [userId, token, deviceInfo ?? null, expiresAt]
  );

  return token;
};

export const rotateRefreshToken = async (oldToken: string) => {
  const result = await pool.query<{ id: string; user_id: string; expires_at: string }>(
    `SELECT id, user_id, expires_at FROM refresh_tokens WHERE token = $1`,
    [oldToken]
  );
  const record = result.rows[0];
  if (!record) throw new AppError("UNAUTHORIZED", "Invalid refresh token", 401);
  if (new Date(record.expires_at) <= new Date()) {
    await pool.query(`DELETE FROM refresh_tokens WHERE id = $1`, [record.id]);
    throw new AppError("UNAUTHORIZED", "Refresh token expired", 401);
  }

  const userResult = await pool.query<AuthUser>(
    `SELECT id, phone, role, status FROM users WHERE id = $1`,
    [record.user_id]
  );
  const user = userResult.rows[0];
  if (!user || user.status !== "active") {
    throw new AppError("UNAUTHORIZED", "Account not active", 401);
  }

  await pool.query(`DELETE FROM refresh_tokens WHERE id = $1`, [record.id]);
  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);

  return { accessToken, refreshToken, user };
};

export const revokeRefreshToken = async (token: string): Promise<void> => {
  await pool.query(`DELETE FROM refresh_tokens WHERE token = $1`, [token]);
};
