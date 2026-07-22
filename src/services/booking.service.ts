import { pool } from "../config/database";
import { AppError } from "../utils/errors";
import { toISTDateTime, hoursUntil, isPast } from "../utils/date";
import { countOrdersToday, findDuplicateBooking } from "../queries/order.queries";

const MIN_ADVANCE_HOURS = 24;

export const computeBookingDateTime = (bookingDate: string, bookingTime: string): Date => {
  const bookingDateTime = toISTDateTime(bookingDate, bookingTime);

  if (isPast(bookingDateTime)) {
    throw new AppError("VALIDATION_ERROR", "Booking date cannot be in the past", 400);
  }
  if (hoursUntil(bookingDateTime) < MIN_ADVANCE_HOURS) {
    throw new AppError("BOOKING_TOO_CLOSE", "Booking must be at least 24 hours in advance", 400);
  }

  return bookingDateTime;
};

export const assertNoDuplicateBooking = async (
  userId: string,
  serviceId: string,
  bookingDate: string
): Promise<void> => {
  const existing = await pool.query(findDuplicateBooking, [userId, serviceId, bookingDate]);
  if (existing.rows.length > 0) {
    throw new AppError("CONFLICT", "You already have a booking for this service on this date", 409);
  }
};

export const generateOrderNumber = async (): Promise<string> => {
  const result = await pool.query<{ count: number }>(countOrdersToday);
  const seq = result.rows[0].count + 1;

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  return `YAJ${yyyy}${mm}${dd}${String(seq).padStart(2, "0")}`;
};
