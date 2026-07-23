import { Router } from "express";
import * as orderController from "../../controllers/admin/order.controller";
import { validate } from "../../middleware/validate";
import { listOrdersAdminQuerySchema, updateOrderStatusAdminSchema } from "../../validators/order.schema";

const router = Router();

router.get("/", validate(listOrdersAdminQuerySchema, "query"), orderController.listOrdersAdmin);
router.get("/:id", orderController.getOrderDetailAdmin);
router.patch("/:id/status", validate(updateOrderStatusAdminSchema), orderController.updateOrderStatusAdmin);

export default router;
