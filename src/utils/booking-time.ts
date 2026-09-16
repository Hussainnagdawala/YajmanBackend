/** Category slug that supports customer-selected booking time slots. */
export const PANDITJI_AT_HOME_SLUG = "panditji-at-home";

// Date-only bookings have no real customer-chosen time, so orders.booking_time
// is left NULL for them (see resolveStoredBookingTime) — no pandit or admin
// screen should ever see a fake clock time for one of these. booking_datetime
// still needs a concrete instant for sorting/reminders/advance-notice math
// though, so DEFAULT_BOOKING_TIME anchors that calculation ONLY — it must
// never be written to the booking_time column itself.
export const DEFAULT_BOOKING_TIME = "09:00";

export interface CategoryBookingTimeFlags {
  requires_booking_time?: boolean | null;
  slug?: string | null;
}

export const categoryRequiresBookingTime = (category: CategoryBookingTimeFlags): boolean =>
  Boolean(category.requires_booking_time) || category.slug === PANDITJI_AT_HOME_SLUG;

// For booking_datetime math (isPast/advance-notice checks, sort order, reminder
// windows) — always returns a real time, defaulting to DEFAULT_BOOKING_TIME.
export const resolveBookingTime = (
  category: CategoryBookingTimeFlags,
  bookingTime?: string | null
): string => {
  if (categoryRequiresBookingTime(category)) {
    return bookingTime ?? "";
  }
  return DEFAULT_BOOKING_TIME;
};

// For the orders.booking_time COLUMN — null when the category has no real slot,
// so nothing downstream (UI, exact-time double-booking match) mistakes the
// anchor above for a customer-chosen appointment time.
export const resolveStoredBookingTime = (
  category: CategoryBookingTimeFlags,
  bookingTime?: string | null
): string | null => {
  if (categoryRequiresBookingTime(category)) {
    return bookingTime ?? "";
  }
  return null;
};
