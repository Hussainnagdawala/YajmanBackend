import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

type ValidateTarget = "body" | "query" | "params";

export const validate = (schema: ZodSchema, target: ValidateTarget = "body") =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      return next(result.error);
    }
    req[target] = result.data;
    next();
  };
