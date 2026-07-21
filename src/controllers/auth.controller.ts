import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { sendOtp as sendOtpService, verifyOtp as verifyOtpService } from "../services/otp.service";
import { signAccessToken, issueRefreshToken, rotateRefreshToken, revokeRefreshToken, expiryToMs } from "../services/auth.service";
import { findUserByPhone, createUser, updateLastLogin, findUserById } from "../queries/user.queries";
import { env } from "../config/env";
import { AuthUser } from "../types/models";

export const sendOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, country_code = "+91" } = req.body;
    const result = await sendOtpService(phone, country_code);
    return success(res, result, "OTP sent");
  } catch (err) {
    next(err);
  }
};

export const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, country_code = "+91", otp, device_source } = req.body;
    await verifyOtpService(phone, otp);

    const existing = await pool.query(findUserByPhone, [phone]);
    let user = existing.rows[0];
    const isNewUser = !user;

    if (isNewUser) {
      const created = await pool.query(createUser, [phone, country_code, "customer", device_source]);
      user = created.rows[0];
    } else {
      await pool.query(updateLastLogin, [user.id]);
    }

    const accessToken = signAccessToken(user);
    const refreshToken = await issueRefreshToken(user.id, { device_source });

    return success(res, {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiryToMs(env.JWT_ACCESS_EXPIRY) / 1000,
      user: { id: user.id, phone: user.phone, role: user.role, name: user.name },
      is_new_user: isNewUser,
    });
  } catch (err) {
    next(err);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refresh_token } = req.body;
    const { accessToken, refreshToken: newRefreshToken } = await rotateRefreshToken(refresh_token);

    return success(res, {
      access_token: accessToken,
      refresh_token: newRefreshToken,
      expires_in: expiryToMs(env.JWT_ACCESS_EXPIRY) / 1000,
    });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refresh_token } = req.body;
    if (refresh_token) await revokeRefreshToken(refresh_token);
    return success(res, null, "Logged out");
  } catch (err) {
    next(err);
  }
};

export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError("UNAUTHORIZED", "No token", 401);
    const result = await pool.query<AuthUser>(findUserById, [req.user.id]);
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};
