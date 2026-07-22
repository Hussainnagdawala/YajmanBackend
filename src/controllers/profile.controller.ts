import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { findUserById, updateProfile as updateProfileQuery } from "../queries/user.queries";
import {
  upsertDeviceToken,
  listDeviceTokensForUser,
  deactivateDeviceToken,
} from "../queries/device.queries";

export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(findUserById, [req.user!.id]);
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fields = Object.keys(req.body);
    if (fields.length === 0) throw new AppError("VALIDATION_ERROR", "No fields to update", 400);

    const values = fields.map((f) => req.body[f]);
    const result = await pool.query(updateProfileQuery(fields), [req.user!.id, ...values]);
    return success(res, result.rows[0], "Profile updated");
  } catch (err) {
    next(err);
  }
};

export const uploadAvatar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file as Express.MulterS3.File | undefined;
    if (!file) throw new AppError("VALIDATION_ERROR", "Avatar file is required", 400);

    const result = await pool.query(updateProfileQuery(["avatar_url"]), [req.user!.id, file.location]);
    return success(res, result.rows[0], "Avatar updated");
  } catch (err) {
    next(err);
  }
};

export const registerDeviceToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, platform, device_info } = req.body;
    const result = await pool.query(upsertDeviceToken, [req.user!.id, token, platform, device_info ?? null]);
    return success(res, result.rows[0], "Device token registered", 201);
  } catch (err) {
    next(err);
  }
};

export const listDeviceTokens = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listDeviceTokensForUser, [req.user!.id]);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const removeDeviceToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(deactivateDeviceToken, [req.body.token, req.user!.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Device token not found", 404);
    return success(res, null, "Device token removed");
  } catch (err) {
    next(err);
  }
};
