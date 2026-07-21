import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import authRoutes from "./auth.routes";
import profileRoutes from "./profile.routes";
import adminRoutes from "./admin";
import categoryRoutes from "./category.routes";
import typeRoutes from "./type.routes";
import tagRoutes from "./tag.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/profile", authenticate, profileRoutes);
router.use("/admin", authenticate, requireRole("admin"), adminRoutes);
router.use("/categories", categoryRoutes);
router.use("/types", typeRoutes);
router.use("/tags", tagRoutes);

export default router;
