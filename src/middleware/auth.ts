import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../config/database";
import { env } from "../config/env";
import { AppError } from "../utils/errors";
import { AuthUser } from "../types/models";

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return next(new AppError("UNAUTHORIZED", "No token", 401));

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };
    const result = await pool.query<AuthUser>(
      "SELECT id, phone, role, status FROM users WHERE id = $1",
      [decoded.id]
    );
    const user = result.rows[0];
    if (!user) return next(new AppError("UNAUTHORIZED", "User not found", 401));
    if (user.status !== "active") return next(new AppError("FORBIDDEN", "Account suspended", 403));

    req.user = user;
    next();
  } catch {
    next(new AppError("UNAUTHORIZED", "Invalid token", 401));
  }
};

// For public routes that still want to know WHO is visiting when they
// happen to be logged in (view-tracking is the only user today) — attaches
// req.user if a valid token is present, but never blocks the request either
// way: no token, expired token, and garbage token are all treated the same
// as "anonymous," not an error.
export const optionalAuthenticate = async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };
    const result = await pool.query<AuthUser>(
      "SELECT id, phone, role, status FROM users WHERE id = $1",
      [decoded.id]
    );
    const user = result.rows[0];
    if (user && user.status === "active") req.user = user;
  } catch {
    // ignore — this route works fine as anonymous
  }
  next();
};
