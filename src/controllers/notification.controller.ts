import { Request, Response, NextFunction } from "express";
import { success } from "../utils/response";
import {
  listInbox,
  getInboxItem,
  markRead,
  markAllRead,
  markClicked,
  deleteInboxItem,
  clearInbox,
  getUnreadCount,
} from "../services/notification.service";

export const listNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unreadOnly = req.query.unread_only === "true" ? true : undefined;
    const result = await listInbox(
      req.user!.id,
      Number(req.query.page) || 1,
      Number(req.query.limit) || 20,
      unreadOnly
    );
    return success(res, result.rows, "Success", 200, result.pagination);
  } catch (err) {
    next(err);
  }
};

export const getNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await getInboxItem(req.user!.id, req.params.id);
    return success(res, item);
  } catch (err) {
    next(err);
  }
};

export const readNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await markRead(req.user!.id, req.params.id);
    return success(res, item, "Notification marked as read");
  } catch (err) {
    next(err);
  }
};

export const readAllNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await markAllRead(req.user!.id);
    return success(res, result, "All notifications marked as read");
  } catch (err) {
    next(err);
  }
};

export const clickNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await markClicked(req.user!.id, req.params.id);
    return success(res, item, "Notification click recorded");
  } catch (err) {
    next(err);
  }
};

export const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await deleteInboxItem(req.user!.id, req.params.id);
    return success(res, item, "Notification deleted");
  } catch (err) {
    next(err);
  }
};

export const clearNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await clearInbox(req.user!.id);
    return success(res, result, "Notification history cleared");
  } catch (err) {
    next(err);
  }
};

export const unreadCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getUnreadCount(req.user!.id);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};
