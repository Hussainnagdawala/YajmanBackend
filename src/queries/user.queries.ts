export const findUserByPhone = `SELECT * FROM users WHERE phone = $1`;

export const findUserById = `SELECT * FROM users WHERE id = $1`;

export const createUser = `
  INSERT INTO users (phone, country_code, role, device_source)
  VALUES ($1, $2, $3, $4)
  RETURNING *
`;

export const createUserByAdmin = `
  INSERT INTO users (phone, name, email, role)
  VALUES ($1, $2, $3, $4)
  RETURNING *
`;

export const updateLastLogin = `UPDATE users SET last_login_at = NOW() WHERE id = $1`;

export const updateProfile = (fields: string[]) => `
  UPDATE users SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}, updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

export const updateUserStatus = `
  UPDATE users SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *
`;

export const listUsers = (whereClauses: string[], limitParamIndex: number, offsetParamIndex: number) => `
  SELECT * FROM users
  ${whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""}
  ORDER BY created_at DESC
  LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
`;

export const countUsers = (whereClauses: string[]) => `
  SELECT COUNT(*)::int AS count FROM users
  ${whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""}
`;
