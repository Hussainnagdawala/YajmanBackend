import { Response } from "express";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export const success = <T>(
  res: Response,
  data: T,
  message = "Success",
  status = 200,
  pagination?: PaginationMeta
) => {
  return res.status(status).json({
    success: true,
    message,
    data,
    ...(pagination && { pagination }),
  });
};

export const error = (res: Response, message: string, status = 400, code?: string) => {
  return res.status(status).json({
    success: false,
    error: { message, status, code },
  });
};
