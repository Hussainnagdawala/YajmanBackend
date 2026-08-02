-- 011_contact_inquiry_category.sql
-- Service inquiries captured service_id/service_name (server-derived, not
-- client-sent) but not the service's category — admin had to open the
-- service to find out. Same server-derived pattern, just one more column.

ALTER TABLE contact_form_entries ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id);
ALTER TABLE contact_form_entries ADD COLUMN IF NOT EXISTS category_name VARCHAR(100);
