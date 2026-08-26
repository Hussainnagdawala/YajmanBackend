import { ZodIssue } from "zod";
import { FieldError } from "./response";

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  name: "Name",
  price: "Price",
  original_price: "Original price",
  category_id: "Category",
  service_id: "Service",
  type_ids: "Types",
  tag_ids: "Tags",
  temple_ids: "Temples",
  addon_ids: "Add-ons",
  benefits: "Benefits",
  key_features: "Key features",
  available_dates: "Available dates",
  availability_start_date: "Availability start date",
  availability_end_date: "Availability end date",
  booking_availability_type: "Booking availability type",
  booking_date: "Booking date",
  booking_time: "Booking time",
  feature_image: "Feature image",
  short_description: "Short description",
  description: "Description",
  about_puja: "About puja",
  custom_content: "Custom content",
  pincode: "Pincode",
  latitude: "Latitude",
  longitude: "Longitude",
  video_url: "Video URL",
  duration_minutes: "Duration (minutes)",
  advance_booking_days: "Advance booking days",
  display_order: "Display order",
  meta_title: "Meta title",
  meta_description: "Meta description",
  packages: "Packages",
  faqs: "FAQs",
  phone: "Phone number",
  country_code: "Country code",
  otp: "OTP",
  refresh_token: "Refresh token",
  customer_name: "Customer name",
  customer_phone: "Phone number",
  customer_whatsapp: "WhatsApp number",
  customer_calling_number: "Calling number",
  customer_email: "Email",
  members: "Member names",
  gotra: "Gotra",
  coupon_code: "Coupon code",
  address: "Address",
  city: "City",
  birth_date: "Birth date",
  birth_time: "Birth time",
  birth_place: "Birth place",
  event_date: "Event date",
  event_time: "Event time",
  max_capacity: "Maximum capacity",
  code: "Coupon code",
  discount_type: "Discount type",
  discount_value: "Discount value",
  max_discount_amount: "Maximum discount amount",
  min_order_amount: "Minimum order amount",
  usage_limit: "Usage limit",
  per_user_limit: "Per-user limit",
  valid_from: "Valid from",
  valid_until: "Valid until",
  applicable_categories: "Applicable categories",
  applicable_services: "Applicable services",
  amount: "Amount",
  rating: "Rating",
  comment: "Comment",
  reason: "Cancellation reason",
  booking_id: "Booking",
  razorpay_order_id: "Razorpay order ID",
  razorpay_payment_id: "Razorpay payment ID",
  razorpay_signature: "Payment signature",
  page: "Page",
  limit: "Limit",
  search: "Search",
  status: "Status",
  is_active: "Active status",
  is_featured: "Featured",
  is_bestseller: "Bestseller",
  is_addon_available: "Add-on availability",
  content: "Content",
  excerpt: "Excerpt",
  author_id: "Author",
  published_at: "Published at",
  color: "Color",
  bg_color: "Background color",
  location: "Location",
  section_key: "Section key",
  cta_text: "Call-to-action text",
  cta_link: "Call-to-action link",
  link_url: "Link URL",
  from: "From date",
  to: "To date",
};

const DATE_FIELDS = new Set([
  "booking_date",
  "birth_date",
  "event_date",
  "availability_start_date",
  "availability_end_date",
  "from",
  "to",
]);

const TIME_FIELDS = new Set(["booking_time", "birth_time", "event_time"]);

const PHONE_FIELDS = new Set([
  "phone",
  "customer_phone",
  "customer_whatsapp",
  "customer_calling_number",
]);

const UUID_FIELDS = new Set([
  "category_id",
  "service_id",
  "author_id",
  "booking_id",
  "user_id",
]);

export const formatFieldLabel = (path: string): string => {
  if (!path || path === "(root)") return "Request";
  const segments = path.split(".");
  const last = segments[segments.length - 1];
  if (/^\d+$/.test(last) && segments.length > 1) {
    const parent = segments[segments.length - 2];
    const parentLabel = FIELD_LABELS[parent] ?? parent.replace(/_/g, " ");
    return `${parentLabel} (item ${Number(last) + 1})`;
  }
  return FIELD_LABELS[last] ?? last.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatIssueMessage = (issue: ZodIssue, fieldLabel: string): string => {
  if (issue.code === "custom") {
    return issue.message;
  }

  const fieldKey = issue.path.length > 0 ? String(issue.path[issue.path.length - 1]) : "";

  switch (issue.code) {
    case "invalid_type":
      if (issue.received === "undefined" || issue.received === "null") {
        return `${fieldLabel} is required`;
      }
      return `${fieldLabel} has an invalid value`;

    case "invalid_string":
      if (issue.validation === "uuid") {
        return `${fieldLabel} must be a valid ID`;
      }
      if (issue.validation === "email") {
        return `${fieldLabel} must be a valid email address`;
      }
      if (issue.validation === "regex") {
        if (DATE_FIELDS.has(fieldKey) || fieldKey.endsWith("_date")) {
          return `${fieldLabel} must be a valid date in YYYY-MM-DD format (e.g. 2026-08-15)`;
        }
        if (TIME_FIELDS.has(fieldKey) || fieldKey.endsWith("_time")) {
          return `${fieldLabel} must be a valid time in HH:MM format (e.g. 09:30)`;
        }
        if (PHONE_FIELDS.has(fieldKey)) {
          return `${fieldLabel} must be a valid 10-digit Indian mobile number starting with 6–9`;
        }
        if (fieldKey === "pincode") {
          return `${fieldLabel} must be a valid pincode`;
        }
        if (UUID_FIELDS.has(fieldKey) || fieldKey.endsWith("_id")) {
          return `${fieldLabel} must be a valid ID`;
        }
        return `${fieldLabel} has an invalid format`;
      }
      return issue.message;

    case "too_small":
      if (issue.type === "string") {
        if (issue.minimum === 1) return `${fieldLabel} is required`;
        return `${fieldLabel} must be at least ${issue.minimum} characters`;
      }
      if (issue.type === "array") {
        if (issue.minimum === 1) return `${fieldLabel} must have at least one item`;
        return `${fieldLabel} must contain at least ${issue.minimum} items`;
      }
      if (issue.type === "number") {
        if (issue.minimum === 0 && "inclusive" in issue && issue.inclusive === false) {
          return `${fieldLabel} must be greater than zero`;
        }
        return `${fieldLabel} must be at least ${issue.minimum}`;
      }
      return issue.message;

    case "too_big":
      if (issue.type === "string") {
        return `${fieldLabel} must be at most ${issue.maximum} characters`;
      }
      if (issue.type === "number") {
        return `${fieldLabel} must be at most ${issue.maximum}`;
      }
      return issue.message;

    case "invalid_enum_value":
      return `${fieldLabel} must be one of: ${issue.options.map(String).join(", ")}`;

    case "invalid_literal":
      return `${fieldLabel} has an invalid value`;

    default:
      if (issue.message.startsWith("Number must be")) {
        if (issue.message.includes("greater than 0")) {
          return `${fieldLabel} must be greater than zero`;
        }
        if (issue.message.includes("greater than or equal to 0")) {
          return `${fieldLabel} cannot be negative`;
        }
      }
      if (issue.message === "Required") {
        return `${fieldLabel} is required`;
      }
      return issue.message;
  }
};

export const formatZodIssues = (issues: ZodIssue[]): FieldError[] =>
  issues.map((issue) => {
    const field = issue.path.join(".") || "(root)";
    const fieldLabel = formatFieldLabel(field);
    return {
      field,
      message: formatIssueMessage(issue, fieldLabel),
    };
  });

export const summarizeValidationErrors = (details: FieldError[]): string => {
  if (details.length === 0) return "Please check your input and try again";
  if (details.length === 1) return details[0].message;
  return `${details.length} fields need attention: ${details.map((d) => d.field).join(", ")}`;
};
