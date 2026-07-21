import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";
import { UserRole } from "../types/enums";

export const requireRole = (...roles: UserRole[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError("FORBIDDEN", "Insufficient permissions", 403));
  }
  next();
};
