-- 022_contact_inquiry_birth_details.sql
-- Service enquiry form (POST /services/:id/inquiry) now collects birth details
-- so admins can pass them to the assigned pandit ahead of a booking, same as
-- checkout already does for orders.

ALTER TABLE contact_form_entries ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE contact_form_entries ADD COLUMN IF NOT EXISTS birth_time TIME;
ALTER TABLE contact_form_entries ADD COLUMN IF NOT EXISTS birth_place VARCHAR(150);
