import { pool } from "../config/database";

export const recalculateServiceRating = async (serviceId: string): Promise<void> => {
  await pool.query(
    `UPDATE services SET
       rating_avg = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE service_id = $1 AND is_approved = true), 0),
       total_reviews = (SELECT COUNT(*) FROM reviews WHERE service_id = $1 AND is_approved = true)
     WHERE id = $1`,
    [serviceId]
  );
};
