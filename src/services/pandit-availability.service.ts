// pandit-availability.service.ts
// Single place that decides whether a pandit can take on one more booking.
// Two different rules depending on whether the order has a real, customer-
// chosen time (booking_time NOT NULL) or not:
//  - Real time slot: exact date+time collision — a pandit can't be in two
//    places at once (isPanditDoubleBooked).
//  - Date-only booking (booking_time NULL, e.g. most puja categories): these
//    don't actually clash with each other, so instead of an exact-time block
//    we cap how many the pandit can hold on the same date, per their own
//    pandit_profiles.daily_booking_limit.

import { pool } from "../config/database";
import { AppError } from "../utils/errors";
import { isPanditDoubleBooked, countPanditAcceptedDateOnlyBookings } from "../queries/pandit.queries";

export interface PanditCapacityInput {
  id: string;
  daily_booking_limit: number;
}

export interface OrderScheduleInput {
  booking_date: string;
  booking_time: string | null;
}

// Throws CONFLICT (409) if assigning/accepting this order would double-book the
// pandit (real time slot) or push them over their daily cap (date-only).
// excludeAssignmentId lets a pandit's own existing assignment for this order
// (accept) or the assignment being reassigned (admin reassign) skip itself.
export const assertPanditCapacityAvailable = async (
  pandit: PanditCapacityInput,
  order: OrderScheduleInput,
  excludeAssignmentId: string | null
): Promise<void> => {
  if (order.booking_time) {
    const conflict = await pool.query(isPanditDoubleBooked, [
      pandit.id,
      order.booking_date,
      order.booking_time,
      excludeAssignmentId,
    ]);
    if (conflict.rows.length > 0) {
      throw new AppError("CONFLICT", "This pandit already has an accepted booking at this date and time", 409);
    }
    return;
  }

  const countResult = await pool.query<{ count: number }>(countPanditAcceptedDateOnlyBookings, [
    pandit.id,
    order.booking_date,
    excludeAssignmentId,
  ]);
  if (countResult.rows[0].count >= pandit.daily_booking_limit) {
    throw new AppError(
      "CONFLICT",
      `This pandit already has ${pandit.daily_booking_limit} accepted booking(s) on this date — daily limit reached`,
      409
    );
  }
};
