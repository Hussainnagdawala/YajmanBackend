import { Router } from "express";
import * as homeController from "../controllers/home.controller";

const router = Router();

router.get("/", homeController.getHome);

export default router;
