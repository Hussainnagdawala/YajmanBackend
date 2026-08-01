import { Router } from "express";
import * as assignmentController from "../../controllers/admin/assignment.controller";
import { validate } from "../../middleware/validate";
import {
  assignPanditSchema,
  reassignPanditSchema,
  listAdminAssignmentsQuerySchema,
} from "../../validators/pandit.schema";

const router = Router();

/**
 * @openapi
 * /admin/pandit-assignments:
 *   post:
 *     tags: [Admin: Pandit Assignments]
 *     summary: Assign a pandit to a confirmed order (moves order to pandit_assigned, notifies the pandit)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [order_id, pandit_id]
 *             properties:
 *               order_id: { type: string, format: uuid }
 *               pandit_id:
 *                 type: string
 *                 format: uuid
 *                 description: pandit_profiles.id (not the user id)
 *     responses:
 *       201:
 *         description: Pandit assigned
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         description: Validation error, order not confirmed, or order's category does not require a pandit
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Order or pandit profile not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       409:
 *         description: Pandit already has an accepted booking at that date/time
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
router.post("/", validate(assignPanditSchema), assignmentController.createAssignment);

/**
 * @openapi
 * /admin/pandit-assignments:
 *   get:
 *     tags: [Admin: Pandit Assignments]
 *     summary: List pandit assignments, optionally filtered by status or expiring-soon
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
 *         schema: { type: string, enum: [pending, accepted, rejected, expired, completed] }
 *       - in: query
 *         name: expiring
 *         schema: { type: boolean }
 *         description: When true, restricts to pending assignments whose 48h response window expires within 12 hours
 *     responses:
 *       200:
 *         description: Assignments fetched
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
router.get("/", validate(listAdminAssignmentsQuerySchema, "query"), assignmentController.listAssignmentsAdmin);

/**
 * @openapi
 * /admin/pandit-assignments/{id}/reassign:
 *   patch:
 *     tags: [Admin: Pandit Assignments]
 *     summary: Reassign an order to a different pandit
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: pandit_assignments.id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pandit_id]
 *             properties:
 *               pandit_id: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Pandit reassigned
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         description: Validation error or order status does not allow reassignment
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Assignment or new pandit profile not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       409:
 *         description: New pandit already has an accepted booking at that date/time
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
router.patch("/:id/reassign", validate(reassignPanditSchema), assignmentController.reassignPandit);

export default router;
