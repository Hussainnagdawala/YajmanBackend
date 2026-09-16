import { FieldError } from "./response";

export class AppError extends Error {
  code: string;
  status: number;
  details?: FieldError[];

  constructor(code: string, message: string, status = 400, details?: FieldError[]) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}
