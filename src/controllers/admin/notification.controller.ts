import { Request, Response, NextFunction } from "express";
import { success } from "../../utils/response";
import {
  createNotificationCampaign,
  listNotificationCampaigns,
  getNotificationCampaign,
  updateNotificationCampaign,
  deleteNotificationCampaign,
  cancelNotificationCampaign,
  duplicateNotificationCampaign,
  sendNotificationCampaign,
  resendNotificationCampaign,
} from "../../services/notification.service";

const requestMeta = (req: Request) => ({
  ip: req.ip,
  userAgent: req.get("user-agent") ?? undefined,
});

export const createCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const imageUrl =
      (req.file as Express.MulterS3.File | undefined)?.location ?? req.body.image_url ?? null;

    const campaign = await createNotificationCampaign(
      {
        title: req.body.title,
        message: req.body.message,
        type: req.body.type,
        target_type: req.body.target_type,
        target_user_ids: req.body.target_user_ids,
        deep_link: req.body.deep_link,
        action_type: req.body.action_type,
        action_value: req.body.action_value,
        scheduled_at: req.body.scheduled_at,
        image_url: imageUrl,
      },
      req.user!.id,
      requestMeta(req)
    );

    return success(res, campaign, "Notification campaign created", 201);
  } catch (err) {
    next(err);
  }
};

export const listCampaigns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await listNotificationCampaigns({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      target_type: req.query.target_type as string | undefined,
      sort: (req.query.sort as string) || "created_at",
      order: ((req.query.order as string) || "desc") as "asc" | "desc",
      from: req.query.from ? new Date(String(req.query.from)) : undefined,
      to: req.query.to ? new Date(String(req.query.to)) : undefined,
    });
    return success(res, result.rows, "Success", 200, result.pagination);
  } catch (err) {
    next(err);
  }
};

export const getCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const campaign = await getNotificationCampaign(req.params.id, page, limit);
    return success(res, campaign);
  } catch (err) {
    next(err);
  }
};

export const updateCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const imageUrl = (req.file as Express.MulterS3.File | undefined)?.location;
    const body = { ...req.body };
    if (imageUrl) body.image_url = imageUrl;

    const campaign = await updateNotificationCampaign(
      req.params.id,
      body,
      req.user!.id,
      requestMeta(req)
    );
    return success(res, campaign, "Notification campaign updated");
  } catch (err) {
    next(err);
  }
};

export const deleteCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await deleteNotificationCampaign(req.params.id, req.user!.id, requestMeta(req));
    return success(res, campaign, "Notification campaign deleted");
  } catch (err) {
    next(err);
  }
};

export const sendCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await sendNotificationCampaign(req.params.id, req.user!.id, requestMeta(req));
    return success(res, campaign, "Notification campaign sent");
  } catch (err) {
    next(err);
  }
};

export const resendCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await resendNotificationCampaign(req.params.id, req.user!.id, requestMeta(req));
    return success(res, campaign, "Notification campaign resent");
  } catch (err) {
    next(err);
  }
};

export const duplicateCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await duplicateNotificationCampaign(req.params.id, req.user!.id, requestMeta(req));
    return success(res, campaign, "Notification campaign duplicated", 201);
  } catch (err) {
    next(err);
  }
};

export const cancelCampaign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await cancelNotificationCampaign(req.params.id, req.user!.id, requestMeta(req));
    return success(res, campaign, "Scheduled notification cancelled");
  } catch (err) {
    next(err);
  }
};
