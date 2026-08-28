import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors";
import { error } from "../utils/response";
import { logger } from "../config/logger";
import { formatZodIssues, summarizeValidationErrors } from "../utils/zod-errors";

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

const serializeError = (err: unknown) => {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack, name: err.name };
  }
  return { message: String(err) };
};

const isDatabaseConnectionError = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("connect econnrefused") ||
    msg.includes("does not support ssl") ||
    msg.includes("connection terminated") ||
    msg.includes("password authentication failed") ||
    msg.includes("getaddrinfo") ||
    msg.includes("timeout") ||
    msg.includes("no pg_hba.conf entry")
  );
};

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return error(res, err.message, err.status, err.code, err.details);
  }

  if (err instanceof ZodError) {
    const details = formatZodIssues(err.issues);
    return error(res, summarizeValidationErrors(details), 422, "VALIDATION_ERROR", details);
  }

  if (isPgError(err)) {
    switch (err.code) {
      case PG_UNIQUE_VIOLATION:
        if (err.constraint === "idx_services_display_order_unique") {
          return error(
            res,
            "This display order is already used by another service. Please choose a different number.",
            409,
            "CONFLICT",
            [{ field: "display_order", message: "Each service must have a unique display order number" }]
          );
        }
        if (err.constraint === "idx_recommended_services_page_section_order") {
          return error(
            res,
            "This display order is already used in this page section.",
            409,
            "CONFLICT",
            [{ field: "display_order", message: "Each placement in a section must have a unique display order" }]
          );
        }
        if (err.constraint === "recommended_services_service_id_page_section_key") {
          return error(
            res,
            "This service is already placed in this page section.",
            409,
            "CONFLICT",
            [{ field: "service_id", message: "This service is already assigned to this page and section" }]
          );
        }
        return error(res, "A record with this value already exists. Please use a different value.", 409, "CONFLICT");
      case PG_FOREIGN_KEY_VIOLATION:
        return error(res, "The referenced item does not exist or is still in use.", 409, "CONFLICT");
      case PG_CHECK_VIOLATION:
        return error(res, "One of the values you entered is not allowed.", 400, "VALIDATION_ERROR");
      case PG_INVALID_TEXT_REPRESENTATION:
        return error(res, "One of the values has an invalid format. Please check your input.", 400, "VALIDATION_ERROR");
      case PG_STRING_DATA_RIGHT_TRUNCATION:
        return error(res, "One of the values is too long. Please shorten it and try again.", 400, "VALIDATION_ERROR");
    }
  }

  if (isDatabaseConnectionError(err)) {
    logger.error("Database connection error", { ...serializeError(err), path: req.path, method: req.method });
    return error(
      res,
      "Unable to connect to the database. Please ensure PostgreSQL is running and DATABASE_URL is correct.",
      503,
      "DATABASE_UNAVAILABLE"
    );
  }

  logger.error("Unhandled error", { ...serializeError(err), path: req.path, method: req.method });
  return error(res, "Internal server error", 500, "INTERNAL_ERROR");
};

export const notFoundHandler = (req: Request, res: Response) => {
  return error(res, `Route ${req.method} ${req.originalUrl} not found`, 404, "NOT_FOUND");
};
