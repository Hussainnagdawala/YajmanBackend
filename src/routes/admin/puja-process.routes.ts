import { Router } from "express";
import * as pujaProcessController from "../../controllers/puja-process.controller";
import { validate } from "../../middleware/validate";
import { createPujaProcessSchema, updatePujaProcessSchema } from "../../validators/puja-process.schema";

const router = Router();

/**
 * @openapi
 * /admin/puja-processes:
 *   post:
 *     tags: [Admin: Puja Processes]
 *     summary: Create a puja process with ordered steps
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, steps]
 *             properties:
 *               name: { type: string, maxLength: 150 }
 *               description: { type: string }
 *               display_order: { type: integer, default: 0 }
 *               steps:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [title]
 *                   properties:
 *                     title: { type: string, maxLength: 200 }
 *                     description: { type: string }
 *     responses:
 *       201:
 *         description: Puja process created
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
router.post("/", validate(createPujaProcessSchema), pujaProcessController.createPujaProcess);

/**
 * @openapi
 * /admin/puja-processes:
 *   get:
 *     tags: [Admin: Puja Processes]
 *     summary: List all puja processes (including inactive), with steps
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Puja processes fetched
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 */
router.get("/", pujaProcessController.listPujaProcessesAdmin);

/**
 * @openapi
 * /admin/puja-processes/{id}:
 *   get:
 *     tags: [Admin: Puja Processes]
 *     summary: Get a puja process by id (with steps)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Puja process fetched
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", pujaProcessController.getPujaProcessAdmin);

/**
 * @openapi
 * /admin/puja-processes/{id}:
 *   patch:
 *     tags: [Admin: Puja Processes]
 *     summary: Update a puja process. Send steps to replace all steps.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               display_order: { type: integer }
 *               is_active: { type: boolean }
 *               steps:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [title]
 *                   properties:
 *                     title: { type: string }
 *                     description: { type: string }
 *     responses:
 *       200:
 *         description: Puja process updated
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch("/:id", validate(updatePujaProcessSchema), pujaProcessController.updatePujaProcess);

/**
 * @openapi
 * /admin/puja-processes/{id}:
 *   delete:
 *     tags: [Admin: Puja Processes]
 *     summary: Soft-delete a puja process (sets is_active = false)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Puja process soft-deleted
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete("/:id", pujaProcessController.deletePujaProcess);

/**
 * @openapi
 * /admin/puja-processes/{id}/permanent:
 *   delete:
 *     tags: [Admin: Puja Processes]
 *     summary: Permanently delete a puja process (blocked if linked to services)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Puja process permanently deleted
 *       409:
 *         description: Process is linked to services
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete("/:id/permanent", pujaProcessController.deletePujaProcessPermanently);

export default router;
