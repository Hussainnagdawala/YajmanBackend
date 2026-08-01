import { Router } from "express";
import * as homeController from "../controllers/home.controller";
import { validate } from "../middleware/validate";
import { listBannersQuerySchema } from "../validators/home.schema";

const router = Router();

// Public app API — same style as /categories, /types, /tags
// GET /banners?type=hero_slider|middle_ad|offer_banner|category_banner
router.get("/", validate(listBannersQuerySchema, "query"), homeController.listBanners);

export default router;
