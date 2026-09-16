import { AppError } from "./errors";

export const ABSOLUTE_MAX_QUANTITY = 99;
export const DEFAULT_MAX_QUANTITY = 10;

export const roundMoney = (n: number): number => Math.round(n * 100) / 100;

export const parseAllowQuantity = (value: unknown): boolean =>
  value === true || value === "true" || value === 1 || value === "1";

export const parseMaxQuantity = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return DEFAULT_MAX_QUANTITY;
  return Math.min(n, ABSOLUTE_MAX_QUANTITY);
};

/** Checkout / coupon: reject qty when the service flag is off; cap when on. */
export const resolveCheckoutQuantity = (
  service: { allow_quantity?: unknown; max_quantity?: unknown },
  requested: number | undefined
): number => {
  const requestedQty = requested ?? 1;
  const allow = parseAllowQuantity(service.allow_quantity);

  if (!allow) {
    if (requestedQty !== 1) {
      throw new AppError("VALIDATION_ERROR", "Quantity cannot be changed for this service", 400, [
        { field: "quantity", message: "Quantity is not enabled for this service" },
      ]);
    }
    return 1;
  }

  const max = parseMaxQuantity(service.max_quantity);
  if (!Number.isInteger(requestedQty) || requestedQty < 1 || requestedQty > max) {
    throw new AppError("VALIDATION_ERROR", `Quantity must be between 1 and ${max}`, 400, [
      { field: "quantity", message: `Quantity must be between 1 and ${max}` },
    ]);
  }
  return requestedQty;
};

export const serviceLineTotal = (unitPrice: number, quantity: number): number =>
  roundMoney(unitPrice * quantity);
