import { Router } from "express";
import * as orderController from "../../controllers/admin/order.controller";
import { validate } from "../../middleware/validate";
import {
  listOrdersAdminQuerySchema,
  updateOrderStatusAdminSchema,
  adminCancelOrderSchema,
} from "../../validators/order.schema";

const router = Router();

router.get("/", validate(listOrdersAdminQuerySchema, "query"), orderController.listOrdersAdmin);
router.get("/:id", orderController.getOrderDetailAdmin);
router.get("/:id/activity", orderController.getOrderActivity);
router.patch("/:id/status", validate(updateOrderStatusAdminSchema), orderController.updateOrderStatusAdmin);
router.patch("/:id/cancel", validate(adminCancelOrderSchema), orderController.cancelOrderAdmin);
router.post("/:id/retry-refund", orderController.retryRefund);

export default router;
