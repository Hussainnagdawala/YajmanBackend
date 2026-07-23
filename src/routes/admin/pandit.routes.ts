import { Router } from "express";
import * as assignmentController from "../../controllers/admin/assignment.controller";
import { validate } from "../../middleware/validate";
import {
  assignPanditSchema,
  reassignPanditSchema,
  listAdminAssignmentsQuerySchema,
} from "../../validators/pandit.schema";

const router = Router();

router.post("/", validate(assignPanditSchema), assignmentController.createAssignment);
router.get("/", validate(listAdminAssignmentsQuerySchema, "query"), assignmentController.listAssignmentsAdmin);
router.patch("/:id/reassign", validate(reassignPanditSchema), assignmentController.reassignPandit);

export default router;
