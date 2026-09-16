import { Request, Response, NextFunction } from "express";
import { success } from "../../utils/response";
import {
  getAdminSettings,
  getAdminSettingByKey,
  updateSettingsBulk,
  updateSettingByKey,
} from "../../services/app-settings.service";

const requestMeta = (req: Request) => ({
  ip: req.ip,
  userAgent: req.get("user-agent") ?? undefined,
});

export const listSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = req.query.category as string | undefined;
    const data = await getAdminSettings(category);
    return success(res, data, "Success");
  } catch (err) {
    next(err);
  }
};

export const getSetting = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getAdminSettingByKey(req.params.key);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

export const bulkUpdateSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await updateSettingsBulk(req.body, req.user!.id, requestMeta(req));
    return success(res, data, "Settings updated");
  } catch (err) {
    next(err);
  }
};

export const patchSetting = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await updateSettingByKey(
      req.params.key,
      req.body.value,
      req.user!.id,
      requestMeta(req)
    );
    return success(res, data, "Setting updated");
  } catch (err) {
    next(err);
  }
};
