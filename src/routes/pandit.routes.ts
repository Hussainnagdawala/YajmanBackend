import { Router } from "express";
import * as panditController from "../controllers/pandit.controller";
import { requireRole } from "../middleware/role";
import { validate } from "../middleware/validate";
import {
  updatePanditProfileSchema,
  acceptAssignmentSchema,
  rejectAssignmentSchema,
  withdrawAssignmentSchema,
  listAssignmentsQuerySchema,
  listPanditBookingsQuerySchema,
} from "../validators/pandit.schema";

const router = Router();

/**
 * @openapi
 * /pandit/profile:
 *   get:
 *     tags: [Pandit]
 *     summary: Get the current pandit's own profile (created automatically on first access)
 *     description: Requires the "pandit" role — a customer token gets 403.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Pandit profile fetched
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/profile", requireRole("pandit"), panditController.getProfile);

/**
 * @openapi
 * /pandit/profile:
 *   patch:
 *     tags: [Pandit]
 *     summary: Update the current pandit's own profile
 *     description: Requires the "pandit" role — a customer token gets 403.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               display_name: { type: string, maxLength: 100 }
 *               bio: { type: string }
 *               experience_years: { type: integer, minimum: 0 }
 *               specializations:
 *                 type: array
 *                 items: { type: string }
 *               languages:
 *                 type: array
 *                 items: { type: string }
 *               service_areas:
 *                 type: array
 *                 items: { type: string }
 *               is_available: { type: boolean }
 *     responses:
 *       200:
 *         description: Profile updated
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
router.patch("/profile", requireRole("pandit"), validate(updatePanditProfileSchema), panditController.updateProfile);

/**
 * @openapi
 * /pandit/dashboard:
 *   get:
 *     tags: [Pandit]
 *     summary: Get the current pandit's dashboard summary (pending assignments, today's/upcoming bookings, stats)
 *     description: Requires the "pandit" role — a customer token gets 403.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Dashboard data fetched
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
 *                         pending_assignments_count: { type: integer }
 *                         today_bookings_count: { type: integer }
 *                         upcoming_bookings: { type: array, items: { type: object } }
 *                         stats:
 *                           type: object
 *                           properties:
 *                             total_completed: { type: integer }
 *                             rating_avg: { type: number }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/dashboard", requireRole("pandit"), panditController.getDashboard);

/**
 * @openapi
 * /pandit/assignments:
 *   get:
 *     tags: [Pandit]
 *     summary: List the current pandit's booking assignments
 *     description: Requires the "pandit" role — a customer token gets 403.
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
 *         name: status
 *         schema: { type: string, enum: [pending, accepted, rejected, expired, completed] }
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
 *                     data:
 *                       type: array
 *                       items: { type: object }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get(
  "/assignments",
  requireRole("pandit"),
  validate(listAssignmentsQuerySchema, "query"),
  panditController.listAssignments
);

/**
 * @openapi
 * /pandit/assignments/{id}:
 *   get:
 *     tags: [Pandit]
 *     summary: Get an assignment's detail (must belong to the current pandit)
 *     description: Requires the "pandit" role — a customer token gets 403.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Assignment detail fetched
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
router.get("/assignments/:id", requireRole("pandit"), panditController.getAssignmentDetail);

/**
 * @openapi
 * /pandit/assignments/{id}/accept:
 *   patch:
 *     tags: [Pandit]
 *     summary: Accept a pending assignment (fails if the 48-hour response window expired or a scheduling conflict exists)
 *     description: Requires the "pandit" role — a customer token gets 403.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes: { type: string, maxLength: 1000 }
 *     responses:
 *       200:
 *         description: Assignment accepted
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
 */
router.patch(
  "/assignments/:id/accept",
  requireRole("pandit"),
  validate(acceptAssignmentSchema),
  panditController.acceptAssignment
);

/**
 * @openapi
 * /pandit/assignments/{id}/reject:
 *   patch:
 *     tags: [Pandit]
 *     summary: Reject a pending assignment
 *     description: Requires the "pandit" role — a customer token gets 403.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string, minLength: 1, maxLength: 1000 }
 *     responses:
 *       200:
 *         description: Assignment rejected
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
 */
router.patch(
  "/assignments/:id/reject",
  requireRole("pandit"),
  validate(rejectAssignmentSchema),
  panditController.rejectAssignment
);

/**
 * @openapi
 * /pandit/assignments/{id}/withdraw:
 *   patch:
 *     tags: [Pandit]
 *     summary: >
 *       Back out of an assignment AFTER already accepting it (illness, emergency, etc).
 *       Unlike reject (only valid while status is 'pending'), this only works on an
 *       'accepted' assignment. Ends up in the same 'rejected' state either way, so
 *       admin sees it identically as "needs reassignment" — just with a reason prefixed
 *       "Withdrawn after acceptance". If the booking is within 24 hours, admins get an
 *       urgent notification instead of the normal one.
 *     description: Requires the "pandit" role — a customer token gets 403.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string, minLength: 1, maxLength: 1000 }
 *     responses:
 *       200:
 *         description: Assignment withdrawn
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         description: Assignment isn't 'accepted', or the order is already in a terminal status
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch(
  "/assignments/:id/withdraw",
  requireRole("pandit"),
  validate(withdrawAssignmentSchema),
  panditController.withdrawAssignment
);

/**
 * @openapi
 * /pandit/bookings:
 *   get:
 *     tags: [Pandit]
 *     summary: List the current pandit's accepted bookings, optionally filtered to a single date
 *     description: Requires the "pandit" role — a customer token gets 403.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$' }
 *     responses:
 *       200:
 *         description: Bookings fetched
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
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get(
  "/bookings",
  requireRole("pandit"),
  validate(listPanditBookingsQuerySchema, "query"),
  panditController.listBookingsByDate
);

/**
 * @openapi
 * /pandit/bookings/{id}/complete:
 *   patch:
 *     tags: [Pandit]
 *     summary: Mark a booking as completed
 *     description: >
 *       Requires the "pandit" or "admin" role — a customer token gets 403. When called by a
 *       pandit, the booking must be an assignment accepted by that pandit or a 403 is returned.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Booking marked as completed
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         description: Booking is already in a terminal status (completed, cancelled, or refunded)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch("/bookings/:id/complete", requireRole("pandit", "admin"), panditController.markBookingComplete);

export default router;
