export const EXPORT_RESOURCES = [
  "orders",
  "users",
  "pandits",
  "pandit-assignments",
  "services",
  "categories",
  "coupons",
  "contact-entries",
  "invoices",
  "aayojan-content",
  "aayojan-events",
  "aayojan-banners",
  "aayojan-gallery",
] as const;

export type ExportResource = (typeof EXPORT_RESOURCES)[number];
