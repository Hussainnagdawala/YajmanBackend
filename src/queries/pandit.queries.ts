// ─── Pandit profile ──────────────────────────────────────────

export const findPanditProfileByUserId = `SELECT * FROM pandit_profiles WHERE user_id = $1`;

export const findPanditProfileById = `SELECT * FROM pandit_profiles WHERE id = $1`;

export const createPanditProfile = `
  INSERT INTO pandit_profiles (user_id, display_name)
  VALUES ($1, $2)
  RETURNING *
`;

export const updatePanditProfile = (fields: string[]) => `
  UPDATE pandit_profiles SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}, updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

// A pandit_profiles row only otherwise gets created lazily when the pandit
// logs in and touches GET/PATCH /pandit/profile themselves — so a pandit
// created via POST /admin/users who has never logged in has no profile row
// yet. The admin listing backfills these eagerly so newly-onboarded pandits
// are immediately visible/assignable, not just after their first login.
export const findPanditUsersWithoutProfile = `
  SELECT u.id, u.name, u.phone FROM users u
  WHERE u.role = 'pandit'
    AND NOT EXISTS (SELECT 1 FROM pandit_profiles pp WHERE pp.user_id = u.id)
`;

// ─── Pandit profile: admin listing ───────────────────────────

export const listPanditsAdmin = (whereClauses: string[], limitIdx: number, offsetIdx: number) => `
  SELECT pp.*, u.phone, u.email, u.status AS user_status
  FROM pandit_profiles pp
  JOIN users u ON u.id = pp.user_id
  ${whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""}
  ORDER BY pp.created_at DESC
  LIMIT $${limitIdx} OFFSET $${offsetIdx}
`;

export const countPanditsAdmin = (whereClauses: string[]) => `
  SELECT COUNT(*)::int AS count
  FROM pandit_profiles pp
  JOIN users u ON u.id = pp.user_id
  ${whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""}
`;

export const findPanditDetailAdmin = `
  SELECT pp.*, u.phone, u.email, u.status AS user_status
  FROM pandit_profiles pp
  JOIN users u ON u.id = pp.user_id
  WHERE pp.id = $1
`;

// $1 = date, $2 = time (only when hasTime). Mirrors
// pandit-availability.service.ts's assertPanditCapacityAvailable so this list
// never shows a pandit whom the assign/accept endpoint would then refuse:
//  - hasTime (real customer-chosen slot): exact date+time collision, same as
//    isPanditDoubleBooked.
//  - !hasTime (date-only booking): pandit is "busy" once their accepted
//    date-only bookings that day reach their own daily_booking_limit.
const availablePanditsBusyClause = (hasTime: boolean) =>
  hasTime
    ? `EXISTS (
        SELECT 1 FROM pandit_assignments pa
        JOIN orders o ON o.id = pa.order_id
        WHERE pa.pandit_id = pp.id AND pa.status = 'accepted'
          AND o.booking_date = $1 AND o.booking_time = $2
      )`
    : `(
        SELECT COUNT(*) FROM pandit_assignments pa
        JOIN orders o ON o.id = pa.order_id
        WHERE pa.pandit_id = pp.id AND pa.status = 'accepted'
          AND o.booking_date = $1 AND o.booking_time IS NULL
      ) >= pp.daily_booking_limit`;

export const listAvailablePandits = (whereClauses: string[], limitIdx: number, offsetIdx: number, hasTime: boolean) => `
  SELECT pp.*, u.phone, u.email, u.status AS user_status
  FROM pandit_profiles pp
  JOIN users u ON u.id = pp.user_id
  WHERE pp.is_available = true
    AND NOT ${availablePanditsBusyClause(hasTime)}
    ${whereClauses.length ? `AND ${whereClauses.join(" AND ")}` : ""}
  ORDER BY pp.rating_avg DESC, pp.total_bookings DESC
  LIMIT $${limitIdx} OFFSET $${offsetIdx}
`;

export const countAvailablePandits = (whereClauses: string[], hasTime: boolean) => `
  SELECT COUNT(*)::int AS count
  FROM pandit_profiles pp
  JOIN users u ON u.id = pp.user_id
  WHERE pp.is_available = true
    AND NOT ${availablePanditsBusyClause(hasTime)}
    ${whereClauses.length ? `AND ${whereClauses.join(" AND ")}` : ""}
`;

// ─── Assignments: creation + lookup ──────────────────────────

export const findOrderForAssignment = `
  SELECT o.*, c.requires_pandit
  FROM orders o
  JOIN services s ON s.id = o.service_id
  JOIN categories c ON c.id = s.category_id
  WHERE o.id = $1
`;

// Used only for orders with a real customer-chosen time (booking_time NOT NULL) —
// a pandit can't be accepted onto two bookings at the exact same date+time.
export const isPanditDoubleBooked = `
  SELECT pa.id FROM pandit_assignments pa
  JOIN orders o ON o.id = pa.order_id
  WHERE pa.pandit_id = $1 AND pa.status = 'accepted'
    AND o.booking_date = $2 AND o.booking_time = $3
    AND pa.id != COALESCE($4, '00000000-0000-0000-0000-000000000000'::uuid)
`;

// Used for date-only orders (booking_time IS NULL) — these don't collide on an
// exact time, so instead of blocking a second same-day booking outright, count
// how many the pandit already holds and compare against their own capacity
// (pandit_profiles.daily_booking_limit) in pandit-availability.service.ts.
export const countPanditAcceptedDateOnlyBookings = `
  SELECT COUNT(*)::int AS count
  FROM pandit_assignments pa
  JOIN orders o ON o.id = pa.order_id
  WHERE pa.pandit_id = $1 AND pa.status = 'accepted'
    AND o.booking_date = $2 AND o.booking_time IS NULL
    AND pa.id != COALESCE($3, '00000000-0000-0000-0000-000000000000'::uuid)
`;

export const createAssignment = `
  INSERT INTO pandit_assignments (order_id, pandit_id, assigned_by, respond_by)
  VALUES ($1, $2, $3, $4)
  RETURNING *
`;

export const findAssignmentById = `SELECT * FROM pandit_assignments WHERE id = $1`;

export const findAssignmentForPandit = `
  SELECT pa.* FROM pandit_assignments pa
  JOIN pandit_profiles pp ON pp.id = pa.pandit_id
  WHERE pa.id = $1 AND pp.user_id = $2
`;

export const updateAssignmentAccept = `
  UPDATE pandit_assignments SET status = 'accepted', accepted_at = NOW(), pandit_notes = $2, updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

export const updateAssignmentReject = `
  UPDATE pandit_assignments SET status = 'rejected', rejected_at = NOW(), rejection_reason = $2, updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

export const reassignAssignment = `
  UPDATE pandit_assignments SET
    pandit_id = $2, status = 'pending', assigned_at = NOW(), respond_by = $3,
    accepted_at = NULL, rejected_at = NULL, rejection_reason = NULL, completed_at = NULL,
    expiry_nudge_sent_at = NULL, updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

// Nobody ever set 'expired' before — a pandit who never opens the app just left
// the assignment sitting as 'pending' forever past its 48h respond_by. Run by
// the assignment-expiry cron. Order status is deliberately left untouched
// (stays 'pandit_assigned') so /admin/pandit-assignments/:id/reassign keeps working.
export const expireStaleAssignments = `
  UPDATE pandit_assignments pa SET status = 'expired', updated_at = NOW()
  FROM orders o
  WHERE pa.order_id = o.id AND pa.status = 'pending' AND pa.respond_by < NOW()
  RETURNING pa.id, pa.order_id, pa.pandit_id, o.order_number
`;

// Pending assignments whose 48h response window closes within 12h and the
// pandit hasn't been nudged yet — a last chance to respond before
// expireStaleAssignments marks it 'expired' out from under them.
export const findAssignmentsNearingExpiry = `
  SELECT pa.id, pa.order_id, pp.user_id AS pandit_user_id, o.order_number
  FROM pandit_assignments pa
  JOIN pandit_profiles pp ON pp.id = pa.pandit_id
  JOIN orders o ON o.id = pa.order_id
  WHERE pa.status = 'pending'
    AND pa.respond_by > NOW()
    AND pa.respond_by <= NOW() + INTERVAL '12 hours'
    AND pa.expiry_nudge_sent_at IS NULL
`;

export const markAssignmentExpiryNudgeSent = `
  UPDATE pandit_assignments SET expiry_nudge_sent_at = NOW() WHERE id = $1
`;

// Run when an admin suspends/deactivates a pandit's user account — any work
// still pending/accepted on their profile needs to be freed for reassignment,
// not left assigned to someone who can no longer log in to respond.
export const freeAssignmentsForSuspendedPandit = `
  UPDATE pandit_assignments pa SET
    status = 'rejected',
    rejected_at = NOW(),
    rejection_reason = 'Pandit account suspended',
    updated_at = NOW()
  FROM pandit_profiles pp, orders o
  WHERE pa.pandit_id = pp.id AND pp.user_id = $1
    AND pa.order_id = o.id
    AND pa.status IN ('pending', 'accepted')
  RETURNING pa.id, pa.order_id, o.order_number
`;

export const findAcceptedAssignmentForPanditByOrder = `
  SELECT pa.* FROM pandit_assignments pa
  JOIN pandit_profiles pp ON pp.id = pa.pandit_id
  WHERE pa.order_id = $1 AND pp.user_id = $2 AND pa.status = 'accepted'
`;

export const completeAssignmentForOrder = `
  UPDATE pandit_assignments SET status = 'completed', completed_at = NOW(), updated_at = NOW()
  WHERE order_id = $1 AND status = 'accepted'
  RETURNING *
`;

// ─── Assignments: listing ─────────────────────────────────────

// booking_time is NULL for date-only bookings (no real customer-chosen slot) —
// requires_booking_time tells the pandit app whether to show it, and
// booking_datetime is the safe field to parse/sort by either way (it's always
// a real instant, anchored internally even when booking_time itself is null).
export const listAssignmentsForPandit = (whereClauses: string[], limitIdx: number, offsetIdx: number) => `
  SELECT pa.*, o.order_number, o.booking_date, o.booking_time, o.booking_datetime, o.customer_name, o.address, o.city,
    s.title AS service_title, s.slug AS service_slug, c.requires_booking_time
  FROM pandit_assignments pa
  JOIN orders o ON o.id = pa.order_id
  JOIN services s ON s.id = o.service_id
  JOIN categories c ON c.id = s.category_id
  WHERE pa.pandit_id = $1 ${whereClauses.length ? `AND ${whereClauses.join(" AND ")}` : ""}
  ORDER BY pa.assigned_at DESC
  LIMIT $${limitIdx} OFFSET $${offsetIdx}
`;

export const countAssignmentsForPandit = (whereClauses: string[]) => `
  SELECT COUNT(*)::int AS count FROM pandit_assignments pa
  WHERE pa.pandit_id = $1 ${whereClauses.length ? `AND ${whereClauses.join(" AND ")}` : ""}
`;

export const findAssignmentDetailForPandit = `
  SELECT pa.*, o.order_number, o.booking_date, o.booking_time, o.booking_datetime, o.customer_name, o.customer_phone,
    o.address, o.city, o.pincode, o.total_amount, s.title AS service_title, s.slug AS service_slug,
    c.requires_booking_time
  FROM pandit_assignments pa
  JOIN orders o ON o.id = pa.order_id
  JOIN services s ON s.id = o.service_id
  JOIN categories c ON c.id = s.category_id
  JOIN pandit_profiles pp ON pp.id = pa.pandit_id
  WHERE pa.id = $1 AND pp.user_id = $2
`;

export const listAssignmentsAdmin = (whereClauses: string[], limitIdx: number, offsetIdx: number) => `
  SELECT pa.*, o.order_number, o.booking_date, o.booking_time,
    pp.display_name AS pandit_name, u.phone AS pandit_phone
  FROM pandit_assignments pa
  JOIN orders o ON o.id = pa.order_id
  JOIN pandit_profiles pp ON pp.id = pa.pandit_id
  JOIN users u ON u.id = pp.user_id
  ${whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""}
  ORDER BY pa.assigned_at DESC
  LIMIT $${limitIdx} OFFSET $${offsetIdx}
`;

export const countAssignmentsAdmin = (whereClauses: string[]) => `
  SELECT COUNT(*)::int AS count FROM pandit_assignments pa
  ${whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""}
`;

// ─── Pandit bookings + dashboard ──────────────────────────────

export const listPanditBookings = (dateFilter: boolean) => `
  SELECT o.*, s.title AS service_title, s.slug AS service_slug, pa.id AS assignment_id
  FROM pandit_assignments pa
  JOIN orders o ON o.id = pa.order_id
  JOIN services s ON s.id = o.service_id
  WHERE pa.pandit_id = $1 AND pa.status = 'accepted' ${dateFilter ? "AND o.booking_date = $2" : ""}
  ORDER BY o.booking_date, o.booking_time
`;

export const countPendingAssignments = `
  SELECT COUNT(*)::int AS count FROM pandit_assignments WHERE pandit_id = $1 AND status = 'pending'
`;

export const countTodayBookings = `
  SELECT COUNT(*)::int AS count FROM pandit_assignments pa
  JOIN orders o ON o.id = pa.order_id
  WHERE pa.pandit_id = $1 AND pa.status = 'accepted' AND o.booking_date = CURRENT_DATE
`;

export const listUpcomingBookings = `
  SELECT o.id, o.order_number, o.booking_date, o.booking_time, s.title AS service_title
  FROM pandit_assignments pa
  JOIN orders o ON o.id = pa.order_id
  JOIN services s ON s.id = o.service_id
  WHERE pa.pandit_id = $1 AND pa.status = 'accepted' AND o.booking_date >= CURRENT_DATE
  ORDER BY o.booking_date, o.booking_time
  LIMIT 10
`;
