import { Router } from "express";
import * as notificationController from "../controllers/notification.controller";
import { validate } from "../middleware/validate";
import { listInboxQuerySchema } from "../validators/notification.schema";

const router = Router();

// Static paths before /:id

/**
 * @openapi
 * /notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Get the current user's unread notification count
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Unread count fetched
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         count: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/unread-count", notificationController.unreadCount);

/**
 * @openapi
 * /notifications/read-all:
 *   post:
 *     tags: [Notifications]
 *     summary: Mark all of the current user's notifications as read
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post("/read-all", notificationController.readAllNotifications);

/**
 * @openapi
 * /notifications:
 *   delete:
 *     tags: [Notifications]
 *     summary: Clear (delete) the current user's entire notification history
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Notification history cleared
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.delete("/", notificationController.clearNotifications);

/**
 * @openapi
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List the current user's notifications (inbox)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: unread_only
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Notifications fetched
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { type: object }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/", validate(listInboxQuerySchema, "query"), notificationController.listNotifications);

/**
 * @openapi
 * /notifications/{id}:
 *   get:
 *     tags: [Notifications]
 *     summary: Get a single notification (inbox item) by id
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notification fetched
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", notificationController.getNotification);

/**
 * @openapi
 * /notifications/{id}/read:
 *   post:
 *     tags: [Notifications]
 *     summary: Mark a single notification as read
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/read", notificationController.readNotification);

/**
 * @openapi
 * /notifications/{id}/click:
 *   post:
 *     tags: [Notifications]
 *     summary: Record that the current user clicked/opened a notification
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notification click recorded
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/click", notificationController.clickNotification);

/**
 * @openapi
 * /notifications/{id}:
 *   delete:
 *     tags: [Notifications]
 *     summary: Delete a single notification from the current user's inbox
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notification deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete("/:id", notificationController.deleteNotification);

export default router;
