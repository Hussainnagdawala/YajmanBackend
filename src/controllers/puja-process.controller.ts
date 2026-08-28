import { Request, Response, NextFunction } from "express";
import { PoolClient } from "pg";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { AppError } from "../utils/errors";
import { generateUniqueSlug } from "../services/slug.service";
import {
  listActivePujaProcesses,
  listAllPujaProcesses,
  findPujaProcessById,
  findActivePujaProcessBySlug,
  findPujaProcessByIdSimple,
  createPujaProcess as createPujaProcessQuery,
  updatePujaProcess as updatePujaProcessQuery,
  softDeletePujaProcess,
  hardDeletePujaProcess,
  countServicesByPujaProcess,
  clearPujaProcessSteps,
  insertPujaProcessStep,
} from "../queries/puja-process.queries";

type StepInput = { title: string; description?: string };

const replaceSteps = async (client: PoolClient, processId: string, steps: StepInput[]) => {
  await client.query(clearPujaProcessSteps, [processId]);
  for (const [i, step] of steps.entries()) {
    await client.query(insertPujaProcessStep, [processId, step.title, step.description ?? null, i]);
  }
};

const fetchDetail = async (id: string) => {
  const result = await pool.query(findPujaProcessById, [id]);
  return result.rows[0];
};

export const listPujaProcesses = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listActivePujaProcesses);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const getPujaProcessBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(findActivePujaProcessBySlug, [req.params.slug]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Puja process not found", 404);
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

export const listPujaProcessesAdmin = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(listAllPujaProcesses);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const getPujaProcessAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await fetchDetail(req.params.id);
    if (!row) throw new AppError("NOT_FOUND", "Puja process not found", 404);
    return success(res, row);
  } catch (err) {
    next(err);
  }
};

export const createPujaProcess = async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const { name, description, display_order, steps } = req.body as {
      name: string;
      description?: string;
      display_order?: number;
      steps: StepInput[];
    };

    const slug = await generateUniqueSlug(name, "puja_processes");
    await client.query("BEGIN");
    const result = await client.query(createPujaProcessQuery, [name, slug, description ?? null, display_order ?? 0]);
    const process = result.rows[0];
    await replaceSteps(client, process.id, steps);
    await client.query("COMMIT");

    const detail = await fetchDetail(process.id);
    return success(res, detail, "Puja process created", 201);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};

export const updatePujaProcess = async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const existing = await client.query(findPujaProcessById, [req.params.id]);
    if (!existing.rows[0]) throw new AppError("NOT_FOUND", "Puja process not found", 404);

    const { steps, ...rest } = req.body as { steps?: StepInput[]; [key: string]: unknown };
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(rest)) {
      fields.push(key);
      values.push(value);
    }
    if (fields.includes("name")) {
      const newSlug = await generateUniqueSlug(rest.name as string, "puja_processes", req.params.id);
      fields.push("slug");
      values.push(newSlug);
    }

    if (fields.length === 0 && !Array.isArray(steps)) {
      throw new AppError("VALIDATION_ERROR", "No fields to update", 400);
    }

    await client.query("BEGIN");

    if (fields.length > 0) {
      await client.query(updatePujaProcessQuery(fields), [req.params.id, ...values]);
    }
    if (Array.isArray(steps)) {
      await replaceSteps(client, req.params.id, steps);
    }

    await client.query("COMMIT");

    const detail = await fetchDetail(req.params.id);
    return success(res, detail, "Puja process updated");
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};

export const deletePujaProcess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(softDeletePujaProcess, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Puja process not found", 404);
    return success(res, result.rows[0], "Puja process deleted");
  } catch (err) {
    next(err);
  }
};

export const deletePujaProcessPermanently = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const linked = await pool.query<{ count: number }>(countServicesByPujaProcess, [req.params.id]);
    if (linked.rows[0].count > 0) {
      throw new AppError(
        "CONFLICT",
        "Cannot permanently delete a puja process linked to services. Soft-delete it instead, or unlink services first.",
        409
      );
    }

    const result = await pool.query(hardDeletePujaProcess, [req.params.id]);
    if (!result.rows[0]) throw new AppError("NOT_FOUND", "Puja process not found", 404);
    return success(res, result.rows[0], "Puja process permanently deleted");
  } catch (err) {
    next(err);
  }
};
