import { Router } from "express";
import * as panditController from "../controllers/pandit.controller";
import { requireRole } from "../middleware/role";
import { validate } from "../middleware/validate";
import {
  updatePanditProfileSchema,
  acceptAssignmentSchema,
  rejectAssignmentSchema,
  listAssignmentsQuerySchema,
  listPanditBookingsQuerySchema,
} from "../validators/pandit.schema";

const router = Router();

router.get("/profile", requireRole("pandit"), panditController.getProfile);
router.patch("/profile", requireRole("pandit"), validate(updatePanditProfileSchema), panditController.updateProfile);

router.get("/dashboard", requireRole("pandit"), panditController.getDashboard);

router.get(
  "/assignments",
  requireRole("pandit"),
  validate(listAssignmentsQuerySchema, "query"),
  panditController.listAssignments
);
router.get("/assignments/:id", requireRole("pandit"), panditController.getAssignmentDetail);
router.patch(
  "/assignments/:id/accept",
  requireRole("pandit"),
  validate(acceptAssignmentSchema),
  panditController.acceptAssignment
);
router.patch(
  "/assignments/:id/reject",
  requireRole("pandit"),
  validate(rejectAssignmentSchema),
  panditController.rejectAssignment
);

router.get(
  "/bookings",
  requireRole("pandit"),
  validate(listPanditBookingsQuerySchema, "query"),
  panditController.listBookingsByDate
);
router.patch("/bookings/:id/complete", requireRole("pandit", "admin"), panditController.markBookingComplete);

export default router;
