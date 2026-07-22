import { Router } from "express";
import * as aayojanController from "../controllers/aayojan.controller";
import * as contactController from "../controllers/contact.controller";
import { validate } from "../middleware/validate";
import { createAayojanContactSchema } from "../validators/contact.schema";

const router = Router();

router.get("/", aayojanController.getAayojan);
router.get("/events/:slug", aayojanController.getAayojanEventBySlug);
router.post("/contact", validate(createAayojanContactSchema), contactController.createAayojanContact);

export default router;
