export const createAayojanContactEntry = `
  INSERT INTO contact_form_entries (form_type, name, email, phone, city, event_name, number_of_people, preferred_date)
  VALUES ('aayojan', $1, $2, $3, $4, $5, $6, $7)
  RETURNING *
`;
