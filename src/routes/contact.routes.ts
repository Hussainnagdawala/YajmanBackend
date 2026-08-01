import { Router } from "express";
import * as contactController from "../controllers/contact.controller";
import { validate } from "../middleware/validate";
import { createContactSchema } from "../validators/contact.schema";

const router = Router();

/**
 * @openapi
 * /contact:
 *   post:
 *     tags: [Contact]
 *     summary: Submit the general contact-us form
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, phone]
 *             properties:
 *               name: { type: string, maxLength: 100 }
 *               email: { type: string, format: email, maxLength: 150 }
 *               phone: { type: string, pattern: '^[6-9]\d{9}$', example: '9876543210' }
 *               city: { type: string, maxLength: 100 }
 *               message: { type: string }
 *     responses:
 *       201:
 *         description: Contact form submitted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post("/", validate(createContactSchema), contactController.createContact);

export default router;
