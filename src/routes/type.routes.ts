import { Router } from "express";
import * as typeController from "../controllers/type.controller";

const router = Router();

router.get("/", typeController.listTypes);

export default router;
