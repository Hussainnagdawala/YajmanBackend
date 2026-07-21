import { Router } from "express";
import userRoutes from "./user.routes";
import categoryRoutes from "./category.routes";
import typeRoutes from "./type.routes";
import tagRoutes from "./tag.routes";

const router = Router();

router.use("/users", userRoutes);
router.use("/categories", categoryRoutes);
router.use("/types", typeRoutes);
router.use("/tags", tagRoutes);

export default router;
