import { Router } from "express";
import * as userController from "../../controllers/admin/user.controller";
import { validate } from "../../middleware/validate";
import {
  createUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
  listUsersQuerySchema,
} from "../../validators/profile.schema";

const router = Router();

/**
 * @openapi
 * /admin/users:
 *   post:
 *     tags: [Admin: Users]
 *     summary: Create a user (defaults to pandit role) as an admin
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, name]
 *             properties:
 *               phone: { type: string, pattern: '^[6-9]\d{9}$', example: '9876543210' }
 *               name: { type: string, minLength: 1, maxLength: 100 }
 *               role: { type: string, enum: [pandit, admin, customer], default: pandit }
 *               email: { type: string, format: email, maxLength: 150 }
 *     responses:
 *       201:
 *         description: User created
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
router.post("/", validate(createUserSchema), userController.createUser);

/**
 * @openapi
 * /admin/users:
 *   get:
 *     tags: [Admin: Users]
 *     summary: List all users with optional role/status/search filters
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
 *         description: Matches name, phone, or email
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [customer, pandit, admin] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive, suspended] }
 *     responses:
 *       200:
 *         description: Users fetched
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
router.get("/", validate(listUsersQuerySchema, "query"), userController.listAllUsers);

/**
 * @openapi
 * /admin/users/{id}:
 *   get:
 *     tags: [Admin: Users]
 *     summary: Get a single user by id
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User fetched
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
router.get("/:id", userController.getUser);

/**
 * @openapi
 * /admin/users/{id}:
 *   patch:
 *     tags: [Admin: Users]
 *     summary: Update a user's phone, name, role, or email
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
 *               phone: { type: string, pattern: '^[6-9]\d{9}$' }
 *               name: { type: string, minLength: 1, maxLength: 100 }
 *               role: { type: string, enum: [pandit, admin, customer] }
 *               email: { type: string, format: email, maxLength: 150 }
 *     responses:
 *       200:
 *         description: User updated
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
router.patch("/:id", validate(updateUserSchema), userController.updateUser);

/**
 * @openapi
 * /admin/users/{id}/status:
 *   patch:
 *     tags: [Admin: Users]
 *     summary: >
 *       Update a user's account status. If this deactivates/suspends a pandit who has
 *       pending or accepted assignments, those are automatically freed (marked
 *       rejected, reason "Pandit account suspended") and all admins are notified
 *       to reassign — otherwise the work would stay stuck on someone who can no
 *       longer log in to respond.
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
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [active, inactive, suspended] }
 *     responses:
 *       200:
 *         description: User status updated
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
router.patch("/:id/status", validate(updateUserStatusSchema), userController.updateUserStatus);

export default router;
