/** Category slug that supports customer-selected booking time slots. */
export const PANDITJI_AT_HOME_SLUG = "panditji-at-home";

/** Default time stored for date-only bookings (start of service window). */
export const DEFAULT_BOOKING_TIME = "09:00";

export interface CategoryBookingTimeFlags {
  requires_booking_time?: boolean | null;
  slug?: string | null;
}

export const categoryRequiresBookingTime = (category: CategoryBookingTimeFlags): boolean =>
  Boolean(category.requires_booking_time) || category.slug === PANDITJI_AT_HOME_SLUG;

export const resolveBookingTime = (
  category: CategoryBookingTimeFlags,
  bookingTime?: string | null
): string => {
  if (categoryRequiresBookingTime(category)) {
    return bookingTime ?? "";
  }
  return DEFAULT_BOOKING_TIME;
};
