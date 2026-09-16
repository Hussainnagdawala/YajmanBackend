-- 028_service_quantity.sql
-- Per-service quantity: admin flag allow_quantity + max_quantity. When on,
-- checkout quantity multiplies the service unit price only (addons stay per
-- booking). Orders snapshot quantity and unit_price so later catalog changes
-- never rewrite history. Existing orders are quantity 1, unit_price = base_price.

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS allow_quantity BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS max_quantity INT NOT NULL DEFAULT 10;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_max_quantity_check'
  ) THEN
    ALTER TABLE services
      ADD CONSTRAINT services_max_quantity_check
      CHECK (max_quantity >= 1 AND max_quantity <= 99);
  END IF;
END $$;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2);

UPDATE orders
SET unit_price = base_price
WHERE unit_price IS NULL;

ALTER TABLE orders
  ALTER COLUMN unit_price SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_quantity_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_quantity_check
      CHECK (quantity >= 1 AND quantity <= 99);
  END IF;
END $$;
