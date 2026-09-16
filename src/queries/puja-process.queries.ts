// ─── Puja processes: core CRUD ───────────────────────────────

export const listActivePujaProcesses = `
  SELECT pp.*,
    COALESCE(
      (SELECT json_agg(
        jsonb_build_object(
          'id', s.id,
          'title', s.title,
          'description', s.description,
          'display_order', s.display_order
        ) ORDER BY s.display_order, s.created_at
      ) FROM puja_process_steps s WHERE s.puja_process_id = pp.id),
      '[]'
    ) AS steps
  FROM puja_processes pp
  WHERE pp.is_active = true
  ORDER BY pp.display_order, pp.name
`;

export const listAllPujaProcesses = `
  SELECT pp.*,
    COALESCE(
      (SELECT json_agg(
        jsonb_build_object(
          'id', s.id,
          'title', s.title,
          'description', s.description,
          'display_order', s.display_order
        ) ORDER BY s.display_order, s.created_at
      ) FROM puja_process_steps s WHERE s.puja_process_id = pp.id),
      '[]'
    ) AS steps,
    (SELECT COUNT(*)::int FROM services sv WHERE sv.puja_process_id = pp.id) AS linked_services_count
  FROM puja_processes pp
  ORDER BY pp.display_order, pp.name
`;

export const findPujaProcessById = `
  SELECT pp.*,
    COALESCE(
      (SELECT json_agg(
        jsonb_build_object(
          'id', s.id,
          'title', s.title,
          'description', s.description,
          'display_order', s.display_order
        ) ORDER BY s.display_order, s.created_at
      ) FROM puja_process_steps s WHERE s.puja_process_id = pp.id),
      '[]'
    ) AS steps,
    (SELECT COUNT(*)::int FROM services sv WHERE sv.puja_process_id = pp.id) AS linked_services_count
  FROM puja_processes pp
  WHERE pp.id = $1
`;

export const findActivePujaProcessBySlug = `
  SELECT pp.*,
    COALESCE(
      (SELECT json_agg(
        jsonb_build_object(
          'id', s.id,
          'title', s.title,
          'description', s.description,
          'display_order', s.display_order
        ) ORDER BY s.display_order, s.created_at
      ) FROM puja_process_steps s WHERE s.puja_process_id = pp.id),
      '[]'
    ) AS steps
  FROM puja_processes pp
  WHERE pp.slug = $1 AND pp.is_active = true
`;

export const findPujaProcessByIdSimple = `SELECT * FROM puja_processes WHERE id = $1`;

export const createPujaProcess = `
  INSERT INTO puja_processes (name, slug, description, display_order)
  VALUES ($1, $2, $3, $4)
  RETURNING *
`;

export const updatePujaProcess = (fields: string[]) => `
  UPDATE puja_processes SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(", ")}, updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

export const softDeletePujaProcess = `
  UPDATE puja_processes SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *
`;

export const hardDeletePujaProcess = `DELETE FROM puja_processes WHERE id = $1 RETURNING *`;

export const countServicesByPujaProcess = `
  SELECT COUNT(*)::int AS count FROM services WHERE puja_process_id = $1
`;

// ─── Steps ───────────────────────────────────────────────────

export const clearPujaProcessSteps = `DELETE FROM puja_process_steps WHERE puja_process_id = $1`;

export const insertPujaProcessStep = `
  INSERT INTO puja_process_steps (puja_process_id, title, description, display_order)
  VALUES ($1, $2, $3, $4)
`;

// ─── Service embed helper (used in service.queries.ts) ───────

export const pujaProcessJsonForService = (activeOnly: boolean) => `
  CASE
    WHEN pp.id IS NOT NULL ${activeOnly ? "AND pp.is_active = true" : ""} THEN
      jsonb_build_object(
        'id', pp.id,
        'name', pp.name,
        'slug', pp.slug,
        'description', pp.description,
        'display_order', pp.display_order,
        'steps', COALESCE(
          (SELECT json_agg(
            jsonb_build_object(
              'id', s.id,
              'title', s.title,
              'description', s.description,
              'display_order', s.display_order
            ) ORDER BY s.display_order, s.created_at
          ) FROM puja_process_steps s WHERE s.puja_process_id = pp.id),
          '[]'
        )
      )
    ELSE NULL
  END AS puja_process
`;
