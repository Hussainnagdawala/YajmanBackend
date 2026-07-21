import { Router } from "express";
import * as userController from "../../controllers/admin/user.controller";
import { validate } from "../../middleware/validate";
import {
  createUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
  listUsersQuerySchema,
} from "../../validators/profile.schema";

const router = Router();

router.post("/", validate(createUserSchema), userController.createUser);
router.get("/", validate(listUsersQuerySchema, "query"), userController.listAllUsers);
router.get("/:id", userController.getUser);
router.patch("/:id", validate(updateUserSchema), userController.updateUser);
router.patch("/:id/status", validate(updateUserStatusSchema), userController.updateUserStatus);

export default router;
