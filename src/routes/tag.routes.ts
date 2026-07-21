import { Router } from "express";
import * as tagController from "../controllers/tag.controller";

const router = Router();

router.get("/", tagController.listTags);

export default router;
