import { Router } from "express";
import * as blogController from "../controllers/blog.controller";
import { validate } from "../middleware/validate";
import { listBlogsQuerySchema } from "../validators/blog.schema";

const router = Router();

router.get("/", validate(listBlogsQuerySchema, "query"), blogController.listBlogsPublic);
router.get("/:slug", blogController.getBlogBySlug);

export default router;
