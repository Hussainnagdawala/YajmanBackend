export type UserRole = "customer" | "pandit" | "admin";
export type UserStatus = "active" | "inactive" | "suspended";
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "pandit_assigned"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "refunded";
export type PaymentStatus = "pending" | "created" | "authorized" | "captured" | "failed" | "refunded";
export type PanditAssignmentStatus = "pending" | "accepted" | "rejected" | "expired" | "completed";
export type CouponDiscountType = "percentage" | "fixed";
export type ContentStatus = "draft" | "published" | "archived";
export type ContactFormType = "general" | "service" | "aayojan";
export type BannerPosition = "hero_slider" | "middle_ad" | "offer_banner" | "category_banner";
export type DeviceSource = "web" | "app" | "portal";
export type NotificationTargetType = "all" | "selected" | "group" | "topic";
export type NotificationCampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "cancelled"
  | "failed";
export type NotificationDeliveryStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "failed"
  | "skipped";
