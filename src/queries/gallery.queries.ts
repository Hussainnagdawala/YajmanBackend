export const listActiveGalleryImages = `
  SELECT id, image_url, title, display_order
  FROM gallery_images WHERE is_active = true ORDER BY display_order
`;
export const listAllGalleryImages = `SELECT * FROM gallery_images ORDER BY display_order`;

export const insertGalleryImage = `
  INSERT INTO gallery_images (image_url, display_order)
  VALUES ($1, $2)
  RETURNING *
`;
export const maxGalleryImageOrder = `
  SELECT COALESCE(MAX(display_order), -1)::int AS max_order FROM gallery_images
`;

export const updateGalleryImage = (fields: string[]) => `
  UPDATE gallery_images SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}, updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

export const softDeleteGalleryImage = `
  UPDATE gallery_images SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *
`;
export const hardDeleteGalleryImage = `DELETE FROM gallery_images WHERE id = $1 RETURNING *`;
