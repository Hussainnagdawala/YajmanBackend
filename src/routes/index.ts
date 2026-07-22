import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import authRoutes from "./auth.routes";
import profileRoutes from "./profile.routes";
import adminRoutes from "./admin";
import categoryRoutes from "./category.routes";
import typeRoutes from "./type.routes";
import tagRoutes from "./tag.routes";
import serviceRoutes from "./service.routes";
import homeRoutes from "./home.routes";
import blogRoutes from "./blog.routes";
import aayojanRoutes from "./aayojan.routes";
import couponRoutes from "./coupon.routes";
import checkoutRoutes from "./checkout.routes";
import bookingRoutes from "./booking.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/profile", authenticate, profileRoutes);
router.use("/admin", authenticate, requireRole("admin"), adminRoutes);
router.use("/categories", categoryRoutes);
router.use("/types", typeRoutes);
router.use("/tags", tagRoutes);
router.use("/services", serviceRoutes);
router.use("/home", homeRoutes);
router.use("/blogs", blogRoutes);
router.use("/aayojan", aayojanRoutes);
router.use("/coupons", authenticate, couponRoutes);
router.use("/checkout", checkoutRoutes);
router.use("/bookings", authenticate, bookingRoutes);

export default router;
