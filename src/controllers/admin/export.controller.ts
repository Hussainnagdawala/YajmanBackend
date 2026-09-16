import { Request, Response, NextFunction } from "express";
import { runExport } from "../../services/export/export.service";

export const exportAdminData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await runExport(
      req.query as Record<string, unknown>,
      req.user!.id,
      req.ip,
      req.get("user-agent")
    );

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.setHeader("X-Export-Row-Count", String(result.rowCount));
    return res.send(result.buffer);
  } catch (err) {
    next(err);
  }
};
