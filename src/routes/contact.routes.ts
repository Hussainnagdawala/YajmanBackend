import { Router } from "express";
import * as contactController from "../controllers/contact.controller";
import { validate } from "../middleware/validate";
import { createContactSchema } from "../validators/contact.schema";

const router = Router();

router.post("/", validate(createContactSchema), contactController.createContact);

export default router;
