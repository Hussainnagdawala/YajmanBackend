export interface InvoiceBranding {
  appName: string;
  tagline: string;
  companyAddress: string;
  websiteUrl: string;
  supportEmail: string;
  supportPhone: string;
}

export interface InvoiceData {
  invoice_number: string;
  issued_date: string;
  order: {
    order_number: string;
    customer_name: string;
    customer_phone: string;
    customer_whatsapp: string | null;
    customer_email: string | null;
    booking_date: string;
    booking_time: string;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
  };
  service_title: string;
  requires_booking_time: boolean;
  members: string[];
  gotra: string | null;
  gotra_unknown: boolean;
  coupon_code: string | null;
  special_instructions: string | null;
  pandit: { display_name: string; phone?: string } | null;
  addons: { name: string; price: number }[];
  pricing: {
    base_price: number;
    discount_amount: number;
    convenience_fee: number;
    total_amount: number;
  };
  payment: {
    status: string;
    method: string | null;
    paid_at: string | null;
    amount: number | null;
    razorpay_payment_id: string | null;
  };
  branding: InvoiceBranding;
}
