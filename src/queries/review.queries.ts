export const findReviewByBookingId = `SELECT * FROM reviews WHERE booking_id = $1`;

export const findPanditIdForOrder = `
  SELECT pandit_id FROM pandit_assignments
  WHERE order_id = $1 AND status IN ('accepted', 'completed')
  ORDER BY assigned_at DESC LIMIT 1
`;

export const createReview = `
  INSERT INTO reviews (service_id, user_id, booking_id, pandit_id, rating, title, comment, is_verified)
  VALUES ($1, $2, $3, $4, $5, $6, $7, true)
  RETURNING *
`;

export const insertReviewPhoto = `
  INSERT INTO review_photos (review_id, image_url) VALUES ($1, $2)
`;

export const listApprovedReviewsForService = (orderBy: string, limitIdx: number, offsetIdx: number) => `
  SELECT r.*,
    u.name AS author_name,
    COALESCE(
      (SELECT json_agg(rp.image_url) FROM review_photos rp WHERE rp.review_id = r.id), '[]'
    ) AS photos
  FROM reviews r
  JOIN users u ON u.id = r.user_id
  WHERE r.service_id = $1 AND r.is_approved = true
  ORDER BY ${orderBy}
  LIMIT $${limitIdx} OFFSET $${offsetIdx}
`;

export const countApprovedReviewsForService = `
  SELECT COUNT(*)::int AS count FROM reviews WHERE service_id = $1 AND is_approved = true
`;

export const findReviewById = `SELECT * FROM reviews WHERE id = $1`;

export const updateReview = (fields: string[]) => `
  UPDATE reviews SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}, updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

export const deleteReview = `DELETE FROM reviews WHERE id = $1 RETURNING *`;
