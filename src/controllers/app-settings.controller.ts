import { Request, Response, NextFunction } from "express";
import { success } from "../utils/response";
import { getPublicSettings } from "../services/app-settings.service";

export const getAppSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const platform = req.query.platform as "android" | "ios" | undefined;
    const appVersion = req.query.app_version as string | undefined;

    const result = await getPublicSettings({
      platform,
      app_version: appVersion,
    });

    res.setHeader("Cache-Control", "public, max-age=60");
    if (result.etag) {
      res.setHeader("ETag", result.etag);
      const ifNoneMatch = req.get("if-none-match");
      if (ifNoneMatch && ifNoneMatch === result.etag) {
        return res.status(304).end();
      }
    }

    return success(res, result.data, "Success");
  } catch (err) {
    next(err);
  }
};
