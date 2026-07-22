import { Request, Response, NextFunction } from "express";
import { pool } from "../config/database";
import { success } from "../utils/response";
import { createAayojanContactEntry } from "../queries/contact.queries";

export const createAayojanContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, phone, city, event_name, number_of_people, preferred_date } = req.body;
    const result = await pool.query(createAayojanContactEntry, [
      name, email ?? null, phone, city ?? null, event_name ?? null, number_of_people ?? null, preferred_date ?? null,
    ]);
    return success(res, result.rows[0], "Contact form submitted", 201);
  } catch (err) {
    next(err);
  }
};
