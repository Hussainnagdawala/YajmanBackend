import { Router } from "express";
import * as pujaProcessController from "../controllers/puja-process.controller";

const router = Router();

/**
 * @openapi
 * /puja-processes:
 *   get:
 *     tags: [Puja Processes]
 *     summary: List active puja processes with steps (for dropdowns / reference)
 *     responses:
 *       200:
 *         description: Active puja processes
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 */
router.get("/", pujaProcessController.listPujaProcesses);

/**
 * @openapi
 * /puja-processes/{slug}:
 *   get:
 *     tags: [Puja Processes]
 *     summary: Get an active puja process by slug (with steps)
 *     parameters:
 *       - name: slug
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Puja process found
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:slug", pujaProcessController.getPujaProcessBySlug);

export default router;
