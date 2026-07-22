import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { paginate } from "../utils/pagination";
import { recalculateServiceRating } from "../services/stats.service";
import { findBookingById } from "../queries/booking.queries";
import {
  findReviewByBookingId,
  findPanditIdForOrder,
  createReview as createReviewQuery,
  insertReviewPhoto,
  listApprovedReviewsForService,
  countApprovedReviewsForService,
  findReviewById,
  updateReview as updateReviewQuery,
  deleteReview as deleteReviewQuery,
} from "../queries/review.queries";

type MulterS3File = Express.MulterS3.File;

const submitReviewForBooking = async (
  bookingId: string,
  userId: string,
  data: { rating: number; title?: string; comment?: string },
  photoFiles: MulterS3File[]
) => {
  const orderResult = await pool.query(findBookingById, [bookingId]);
  const order = orderResult.rows[0];
  if (!order) throw new AppError("NOT_FOUND", "Booking not found", 404);
  if (order.user_id !== userId) throw new AppError("FORBIDDEN", "You do not have access to this booking", 403);
  if (order.status !== "completed") {
    throw new AppError("VALIDATION_ERROR", "You can only review a completed booking", 400);
  }

  const existing = await pool.query(findReviewByBookingId, [bookingId]);
  if (existing.rows[0]) throw new AppError("CONFLICT", "You have already reviewed this booking", 409);

  const panditResult = await pool.query(findPanditIdForOrder, [bookingId]);
  const panditId = panditResult.rows[0]?.pandit_id ?? null;

  const review = (
    await pool.query(createReviewQuery, [
      order.service_id, userId, bookingId, panditId, data.rating, data.title ?? null, data.comment ?? null,
    ])
  ).rows[0];

  for (const file of photoFiles) {
    await pool.query(insertReviewPhoto, [review.id, file.location]);
  }

  await recalculateServiceRating(order.service_id);

  return review;
};

export const submitReviewViaBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const photoFiles = (req.files as MulterS3File[] | undefined) ?? [];
    const review = await submitReviewForBooking(req.params.id, req.user!.id, req.body, photoFiles);
    return success(res, review, "Review submitted", 201);
  } catch (err) {
    next(err);
  }
};

export const submitReviewViaService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { booking_id, rating, title, comment } = req.body;

    const orderResult = await pool.query(findBookingById, [booking_id]);
    const order = orderResult.rows[0];
    if (!order) throw new AppError("NOT_FOUND", "Booking not found", 404);
    if (order.service_id !== req.params.id) {
      throw new AppError("VALIDATION_ERROR", "This booking is not for the given service", 400);
    }

    const photoFiles = (req.files as MulterS3File[] | undefined) ?? [];
    const review = await submitReviewForBooking(booking_id, req.user!.id, { rating, title, comment }, photoFiles);
    return success(res, review, "Review submitted", 201);
  } catch (err) {
    next(err);
  }
};

export const listServiceReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as unknown as { page: number; limit: number; sort?: string };
    const { limit: safeLimit, offset, meta } = paginate(q.page, q.limit);
    const orderBy = q.sort === "rating" ? "r.rating DESC, r.created_at DESC" : "r.created_at DESC";

    const [rows, count] = await Promise.all([
      pool.query(listApprovedReviewsForService(orderBy, 2, 3), [req.params.id, safeLimit, offset]),
      pool.query<{ count: number }>(countApprovedReviewsForService, [req.params.id]),
    ]);

    return success(res, rows.rows, "Reviews fetched", 200, meta(count.rows[0].count));
  } catch (err) {
    next(err);
  }
};

export const moderateReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fields = Object.keys(req.body);
    if (fields.length === 0) throw new AppError("VALIDATION_ERROR", "No fields to update", 400);

    const values = fields.map((f) => req.body[f]);
    const result = await pool.query(updateReviewQuery(fields), [req.params.id, ...values]);
    const review = result.rows[0];
    if (!review) throw new AppError("NOT_FOUND", "Review not found", 404);

    await recalculateServiceRating(review.service_id);
    return success(res, review, "Review updated");
  } catch (err) {
    next(err);
  }
};

export const deleteReviewAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await pool.query(findReviewById, [req.params.id]);
    if (!existing.rows[0]) throw new AppError("NOT_FOUND", "Review not found", 404);

    await pool.query(deleteReviewQuery, [req.params.id]);
    await recalculateServiceRating(existing.rows[0].service_id);

    return success(res, null, "Review deleted");
  } catch (err) {
    next(err);
  }
};
