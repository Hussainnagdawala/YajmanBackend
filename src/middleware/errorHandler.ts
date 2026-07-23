import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors";
import { error } from "../utils/response";
import { logger } from "../config/logger";

interface PgError {
  code: string;
  detail?: string;
  constraint?: string;
}

const isPgError = (err: unknown): err is PgError =>
  typeof err === "object" && err !== null && typeof (err as { code?: unknown }).code === "string";

const PG_UNIQUE_VIOLATION = "23505";
const PG_FOREIGN_KEY_VIOLATION = "23503";
const PG_CHECK_VIOLATION = "23514";
const PG_INVALID_TEXT_REPRESENTATION = "22P02";
const PG_STRING_DATA_RIGHT_TRUNCATION = "22001";

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return error(res, err.message, err.status, err.code);
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join(".") || "(root)",
      message: issue.message,
    }));
    return error(res, "Validation failed", 422, "VALIDATION_ERROR", details);
  }

  if (isPgError(err)) {
    switch (err.code) {
      case PG_UNIQUE_VIOLATION:
        return error(res, "A record with this value already exists", 409, "CONFLICT");
      case PG_FOREIGN_KEY_VIOLATION:
        return error(res, "Referenced record does not exist or is still in use", 409, "CONFLICT");
      case PG_CHECK_VIOLATION:
        return error(res, "Value violates a database constraint", 400, "VALIDATION_ERROR");
      case PG_INVALID_TEXT_REPRESENTATION:
        return error(res, "Invalid value format", 400, "VALIDATION_ERROR");
      case PG_STRING_DATA_RIGHT_TRUNCATION:
        return error(res, "Value too long for field", 400, "VALIDATION_ERROR");
    }
  }

  logger.error("Unhandled error", { err, path: req.path, method: req.method });
  return error(res, "Internal server error", 500, "INTERNAL_ERROR");
};

export const notFoundHandler = (req: Request, res: Response) => {
  return error(res, `Route ${req.method} ${req.originalUrl} not found`, 404, "NOT_FOUND");
};
