export const createGeneralContactEntry = `
  INSERT INTO contact_form_entries (form_type, name, email, phone, city, message)
  VALUES ('general', $1, $2, $3, $4, $5)
  RETURNING *
`;

export const createServiceInquiryEntry = `
  INSERT INTO contact_form_entries (form_type, name, email, phone, message, service_id, service_name, category_id, category_name)
  VALUES ('service', $1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING *
`;

export const createAayojanContactEntry = `
  INSERT INTO contact_form_entries (form_type, name, email, phone, city, event_name, number_of_people, preferred_date)
  VALUES ('aayojan', $1, $2, $3, $4, $5, $6, $7)
  RETURNING *
`;

export const findContactEntryById = `SELECT * FROM contact_form_entries WHERE id = $1`;

export const listContactEntriesAdmin = (whereClauses: string[], limitIdx: number, offsetIdx: number) => `
  SELECT * FROM contact_form_entries
  ${whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""}
  ORDER BY created_at DESC
  LIMIT $${limitIdx} OFFSET $${offsetIdx}
`;

export const countContactEntriesAdmin = (whereClauses: string[]) => `
  SELECT COUNT(*)::int AS count FROM contact_form_entries
  ${whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""}
`;

export const updateContactEntry = (fields: string[]) => `
  UPDATE contact_form_entries SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}, updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;
