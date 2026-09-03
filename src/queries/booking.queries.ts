const STATUS_GROUPS: Record<string, string> = {
  // Active bookings stay in Upcoming even after the scheduled date passes.
  // Otherwise confirmed/in-progress orders with a past booking_date fall into
  // a black hole (not upcoming, not completed, not cancelled) until an admin
  // marks them completed.
  // `pending` = order created / awaiting payment confirmation — still show it.
  upcoming:
    "o.status IN ('pending', 'confirmed', 'pandit_assigned', 'in_progress')",
  completed: "o.status = 'completed'",
  cancelled:
    "o.status IN ('cancelled', 'refunded', 'payment_failed', 'refund_failed', 'disputed')",
};

export const listBookings = (statusGroup: string | undefined, limitIdx: number, offsetIdx: number) => `
  SELECT o.*, s.title AS service_title, s.slug AS service_slug, s.feature_image_url AS service_image
  FROM orders o
  JOIN services s ON s.id = o.service_id
  WHERE o.user_id = $1 ${statusGroup ? `AND ${STATUS_GROUPS[statusGroup]}` : ""}
  ORDER BY o.booking_datetime DESC
  LIMIT $${limitIdx} OFFSET $${offsetIdx}
`;

export const countBookings = (statusGroup: string | undefined) => `
  SELECT COUNT(*)::int AS count
  FROM orders o
  WHERE o.user_id = $1 ${statusGroup ? `AND ${STATUS_GROUPS[statusGroup]}` : ""}
`;

export const findBookingDetail = `
  SELECT o.*,
    s.title AS service_title, s.slug AS service_slug, s.feature_image_url AS service_image,
    s.duration_minutes AS service_duration_minutes,
    COALESCE(
      (SELECT json_agg(om.name ORDER BY om.display_order) FROM order_members om WHERE om.order_id = o.id),
      '[]'
    ) AS members,
    COALESCE(
      (SELECT json_agg(jsonb_build_object('name', oa.name, 'price', oa.price)) FROM order_addons oa WHERE oa.order_id = o.id),
      '[]'
    ) AS addons,
    (
      SELECT jsonb_build_object(
        'id', pp.id, 'status', pa.status, 'display_name', pp.display_name,
        'phone', u.phone, 'photo_url', pp.profile_image_url
      )
      FROM pandit_assignments pa
      JOIN pandit_profiles pp ON pp.id = pa.pandit_id
      JOIN users u ON u.id = pp.user_id
      WHERE pa.order_id = o.id AND pa.status IN ('accepted', 'completed')
      ORDER BY pa.assigned_at DESC LIMIT 1
    ) AS pandit,
    (
      SELECT jsonb_build_object(
        'id', pm.id, 'status', pm.status, 'method', pm.method,
        'paid_at', pm.paid_at, 'amount', pm.amount,
        'razorpay_payment_id', pm.razorpay_payment_id
      )
      FROM payments pm WHERE pm.order_id = o.id ORDER BY pm.created_at DESC LIMIT 1
    ) AS payment,
    (
      SELECT jsonb_build_object('id', r.id, 'rating', r.rating, 'title', r.title, 'comment', r.comment)
      FROM reviews r WHERE r.booking_id = o.id LIMIT 1
    ) AS review,
    c.slug AS category_slug,
    c.requires_booking_time
  FROM orders o
  JOIN services s ON s.id = o.service_id
  JOIN categories c ON c.id = s.category_id
  WHERE o.id = $1
`;

export const findBookingById = `SELECT * FROM orders WHERE id = $1`;

// $2 is the terminal status to land on: 'cancelled' (no captured payment to
// refund), 'refunded' (refund succeeded), or 'refund_failed' (refund threw).
export const finalizeCancellation = `
  UPDATE orders SET
    status = $2,
    cancelled_at = NOW(),
    cancellation_reason = $3,
    cancelled_by = $4,
    updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

export const findLatestPaymentForOrder = `
  SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1
`;

// pandit_assignment_status has no 'cancelled' state — 'rejected' is the closest
// existing value that removes it from "active" double-booking consideration.
// Revisit if Step 12 (pandit flow) adds a dedicated status for this.
export const freePanditAssignment = `
  UPDATE pandit_assignments SET
    status = 'rejected',
    rejection_reason = 'Order cancelled',
    updated_at = NOW()
  WHERE order_id = $1 AND status IN ('pending', 'accepted')
`;

// Upcoming active bookings that are due one of their reminder windows. The cron
// decides per row which window applies and marks reminder_*_sent_at so each
// fires once. `booking_datetime > NOW()` keeps just-passed bookings out.
export const findOrdersNeedingReminder = `
  SELECT o.id, o.user_id, o.order_number, o.booking_datetime,
    o.reminder_24h_sent_at, o.reminder_2h_sent_at,
    s.title AS service_title
  FROM orders o
  JOIN services s ON s.id = o.service_id
  WHERE o.status IN ('confirmed', 'pandit_assigned', 'in_progress')
    AND o.booking_datetime > NOW()
    AND (
      (o.reminder_24h_sent_at IS NULL AND o.booking_datetime <= NOW() + INTERVAL '24 hours')
      OR
      (o.reminder_2h_sent_at IS NULL AND o.booking_datetime <= NOW() + INTERVAL '2 hours')
    )
`;

export const markReminderSent = (
  column: "reminder_24h_sent_at" | "reminder_2h_sent_at"
): string => `UPDATE orders SET ${column} = NOW() WHERE id = $1`;
