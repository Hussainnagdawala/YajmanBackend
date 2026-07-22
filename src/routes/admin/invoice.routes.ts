import { Router } from "express";
import * as invoiceController from "../../controllers/invoice.controller";
import { validate } from "../../middleware/validate";
import { listInvoicesQuerySchema } from "../../validators/booking.schema";

const router = Router();

router.get("/", validate(listInvoicesQuerySchema, "query"), invoiceController.listInvoicesAdmin);

export default router;
