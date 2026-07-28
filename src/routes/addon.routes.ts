import { Router } from "express";
import * as addonController from "../controllers/addon.controller";

const router = Router();

router.get("/", addonController.listAddons);

export default router;
