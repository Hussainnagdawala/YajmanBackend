import { Router, Request, Response, NextFunction } from "express";
import * as notificationController from "../../controllers/admin/notification.controller";
import { validate } from "../../middleware/validate";
import { uploadSingle } from "../../middleware/upload";
import {
  createCampaignSchema,
  updateCampaignSchema,
  listCampaignsQuerySchema,
  listRecipientsQuerySchema,
} from "../../validators/notification.schema";

const router = Router();

const setUploadFolder = (req: Request, _res: Response, next: NextFunction) => {
  req.uploadFolder = "notifications";
  next();
};

/**
 * @openapi
 * /admin/notifications:
 *   post:
 *     tags: [Admin: Notifications]
 *     summary: Create a push notification campaign (draft, or scheduled if scheduled_at is set)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, message]
 *             properties:
 *               title: { type: string, minLength: 1, maxLength: 200 }
 *               message: { type: string, minLength: 1 }
 *               type: { type: string, maxLength: 50, default: promo }
 *               target_type: { type: string, enum: [all, selected], default: all }
 *               target_user_ids:
 *                 type: string
 *                 description: JSON-encoded array of user uuids (or comma-separated). Required when target_type is 'selected'.
 *               deep_link: { type: string, maxLength: 500, nullable: true }
 *               action_type: { type: string, maxLength: 50, nullable: true }
 *               action_value: { type: string, maxLength: 500, nullable: true }
 *               scheduled_at:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 description: Must be in the future
 *               image_url:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *                 description: Used only if no image file is uploaded
 *               image: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Campaign created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post(
  "/",
  setUploadFolder,
  uploadSingle("image"),
  validate(createCampaignSchema),
  notificationController.createCampaign
);

/**
 * @openapi
 * /admin/notifications:
 *   get:
 *     tags: [Admin: Notifications]
 *     summary: List notification campaigns
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, scheduled, sending, sent, cancelled, failed] }
 *       - in: query
 *         name: target_type
 *         schema: { type: string, enum: [all, selected, group, topic] }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [created_at, sent_at, scheduled_at, title], default: created_at }
 *       - in: query
 *         name: order
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Campaigns fetched
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/", validate(listCampaignsQuerySchema, "query"), notificationController.listCampaigns);

/**
 * @openapi
 * /admin/notifications/{id}:
 *   get:
 *     tags: [Admin: Notifications]
 *     summary: Get a campaign with its paginated recipient delivery list
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Campaign fetched
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
 *                         recipients: { type: array, items: { type: object } }
 *                         recipients_pagination: { $ref: '#/components/schemas/PaginationMeta' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get(
  "/:id",
  validate(listRecipientsQuerySchema, "query"),
  notificationController.getCampaign
);

/**
 * @openapi
 * /admin/notifications/{id}:
 *   put:
 *     tags: [Admin: Notifications]
 *     summary: Update a draft or scheduled campaign
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, minLength: 1, maxLength: 200 }
 *               message: { type: string, minLength: 1 }
 *               type: { type: string, maxLength: 50 }
 *               target_type: { type: string, enum: [all, selected] }
 *               target_user_ids:
 *                 type: string
 *                 description: JSON-encoded array of user uuids (or comma-separated)
 *               deep_link: { type: string, maxLength: 500, nullable: true }
 *               action_type: { type: string, maxLength: 50, nullable: true }
 *               action_value: { type: string, maxLength: 500, nullable: true }
 *               scheduled_at:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 description: Must be in the future; set to null to clear the schedule and return the campaign to draft
 *               image_url: { type: string, format: uri, nullable: true }
 *               image: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Campaign updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Only draft or scheduled campaigns can be updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
router.put(
  "/:id",
  setUploadFolder,
  uploadSingle("image"),
  validate(updateCampaignSchema),
  notificationController.updateCampaign
);

/**
 * @openapi
 * /admin/notifications/{id}:
 *   delete:
 *     tags: [Admin: Notifications]
 *     summary: Delete a draft campaign
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Campaign deleted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         description: Only draft campaigns can be deleted (also returned if the campaign does not exist)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
router.delete("/:id", notificationController.deleteCampaign);

/**
 * @openapi
 * /admin/notifications/{id}/send:
 *   post:
 *     tags: [Admin: Notifications]
 *     summary: Send a draft or scheduled campaign now (resolves audience, writes inbox rows, fans out FCM push)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Campaign sent
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Campaign is not in a sendable status (only draft/scheduled can be sent)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
router.post("/:id/send", notificationController.sendCampaign);

/**
 * @openapi
 * /admin/notifications/{id}/resend:
 *   post:
 *     tags: [Admin: Notifications]
 *     summary: Clone a sent or failed campaign and send the clone immediately
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: New (cloned) campaign sent
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Only sent or failed campaigns can be resent
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
router.post("/:id/resend", notificationController.resendCampaign);

/**
 * @openapi
 * /admin/notifications/{id}/duplicate:
 *   post:
 *     tags: [Admin: Notifications]
 *     summary: Duplicate a campaign as a new draft (does not send it)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Campaign duplicated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post("/:id/duplicate", notificationController.duplicateCampaign);

/**
 * @openapi
 * /admin/notifications/{id}/cancel:
 *   post:
 *     tags: [Admin: Notifications]
 *     summary: Cancel a scheduled campaign before it sends
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Campaign cancelled
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         description: Only scheduled campaigns can be cancelled (also returned if the campaign does not exist)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
router.post("/:id/cancel", notificationController.cancelCampaign);

export default router;
