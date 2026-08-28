// ============================================================
// Swagger/OpenAPI docs convention (served at GET /api-docs)
// ============================================================
// Every route is documented via an `@openapi` JSDoc block placed directly
// above its `router.<method>(...)` call, in the route file itself — see
// auth.routes.ts for a fully-worked example. src/config/swagger.ts globs
// every file under src/routes/** and feeds these comments to swagger-jsdoc,
// so a new route is picked up automatically the moment its JSDoc block is
// added — no separate registration step, no central list to update.
//
// A route added WITHOUT that block simply will not appear in the docs — it
// still works, it's just invisible there. When adding a new endpoint, add
// its @openapi block in the same edit.
//
// Reusable pieces already defined in src/config/swagger.ts — reference them
// with $ref rather than redefining:
//   - #/components/schemas/SuccessEnvelope, PaginationMeta, ErrorEnvelope
//   - #/components/responses/NotFound, ValidationError, Unauthorized, Forbidden
//   - securitySchemes.bearerAuth — add `security: [{ bearerAuth: [] }]` on any
//     route that needs a token, INCLUDING routes whose `authenticate` middleware
//     is only applied at the router.use(...) mount point below (e.g. everything
//     under /profile, /coupons, /bookings, /notifications, /pandit, and all of
//     /admin/**) rather than visibly in the route file itself.
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
import testimonialRoutes from "./testimonial.routes";
import popularSearchRoutes from "./popular-search.routes";
import galleryRoutes from "./gallery.routes";
import blogRoutes from "./blog.routes";
import aayojanRoutes from "./aayojan.routes";
import couponRoutes from "./coupon.routes";
import checkoutRoutes from "./checkout.routes";
import bookingRoutes from "./booking.routes";
import panditRoutes from "./pandit.routes";
import contactRoutes from "./contact.routes";
import notificationRoutes from "./notification.routes";
import appRoutes from "./app.routes";
import addonRoutes from "./addon.routes";
import bannerRoutes from "./banner.routes";
import pujaProcessRoutes from "./puja-process.routes";
import servicePlacementRoutes from "./service-placement.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/profile", authenticate, profileRoutes);
router.use("/admin", authenticate, requireRole("admin"), adminRoutes);
router.use("/categories", categoryRoutes);
router.use("/types", typeRoutes);
router.use("/tags", tagRoutes);
router.use("/services", serviceRoutes);
router.use("/banners", bannerRoutes);
router.use("/home", homeRoutes);
router.use("/testimonials", testimonialRoutes);
router.use("/popular-searches", popularSearchRoutes);
router.use("/gallery", galleryRoutes);
router.use("/blogs", blogRoutes);
router.use("/aayojan", aayojanRoutes);
router.use("/coupons", authenticate, couponRoutes);
router.use("/checkout", checkoutRoutes);
router.use("/bookings", authenticate, bookingRoutes);
router.use("/pandit", authenticate, panditRoutes);
router.use("/contact", contactRoutes);
router.use("/notifications", authenticate, notificationRoutes);
router.use("/app", appRoutes);
router.use("/addons", addonRoutes);
router.use("/puja-processes", pujaProcessRoutes);
router.use("/service-placements", servicePlacementRoutes);

export default router;
