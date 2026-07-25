import { Router } from "express";
import * as notificationController from "../controllers/notification.controller";
import { validate } from "../middleware/validate";
import { listInboxQuerySchema } from "../validators/notification.schema";

const router = Router();

// Static paths before /:id
router.get("/unread-count", notificationController.unreadCount);
router.post("/read-all", notificationController.readAllNotifications);
router.delete("/", notificationController.clearNotifications);

router.get("/", validate(listInboxQuerySchema, "query"), notificationController.listNotifications);
router.get("/:id", notificationController.getNotification);
router.post("/:id/read", notificationController.readNotification);
router.post("/:id/click", notificationController.clickNotification);
router.delete("/:id", notificationController.deleteNotification);

export default router;
