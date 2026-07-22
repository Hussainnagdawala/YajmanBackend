export const findInvoiceByOrderId = `SELECT * FROM invoices WHERE order_id = $1`;

export const countInvoicesThisYear = `
  SELECT COUNT(*)::int AS count FROM invoices WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
`;

export const createInvoice = `
  INSERT INTO invoices (order_id, invoice_number, pdf_url, invoice_data)
  VALUES ($1, $2, $3, $4)
  RETURNING *
`;

export const listInvoicesAdmin = (whereClauses: string[], limitIdx: number, offsetIdx: number) => `
  SELECT i.*, o.order_number, o.customer_name, o.total_amount
  FROM invoices i
  JOIN orders o ON o.id = i.order_id
  ${whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""}
  ORDER BY i.created_at DESC
  LIMIT $${limitIdx} OFFSET $${offsetIdx}
`;

export const countInvoicesAdmin = (whereClauses: string[]) => `
  SELECT COUNT(*)::int AS count FROM invoices i
  ${whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""}
`;
