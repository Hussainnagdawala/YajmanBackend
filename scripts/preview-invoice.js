/**
 * Generate a sample invoice PDF for layout preview.
 * Usage: node scripts/preview-invoice.js
 */
const fs = require("fs");
const path = require("path");

async function main() {
  require("ts-node/register");
  const { renderInvoicePdf } = require("../src/services/invoice-pdf.renderer");

  const sample = {
    invoice_number: "INV-2026-0042",
    issued_date: "2026-08-28",
    order: {
      order_number: "ORD-20260828-001",
      customer_name: "Rajesh Kumar Sharma",
      customer_phone: "+91 9876543210",
      customer_whatsapp: "+91 9876543210",
      customer_email: "rajesh@example.com",
      booking_date: "2026-09-15",
      booking_time: "09:00",
      address: "Flat 402, Green Valley Apartments, MG Road",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
    },
    service_title: "Satyanarayan Puja — Full Package with Prasad",
    requires_booking_time: true,
    members: ["Rajesh Kumar", "Priya Sharma", "Arjun Sharma"],
    gotra: "Bharadwaj",
    gotra_unknown: false,
    coupon_code: "YAJMAN10",
    special_instructions: "Please bring extra flowers. Gate code is 4521. Contact security at main entrance.",
    pandit: { display_name: "Pandit Ram Sharma", phone: "+91 8109181057" },
    addons: [
      { name: "Extra Prasad Pack", price: 499 },
      { name: "Flower Decoration", price: 1200 },
    ],
    pricing: {
      base_price: 4999,
      discount_amount: 500,
      convenience_fee: 49,
      total_amount: 5247,
    },
    payment: {
      status: "captured",
      method: "upi",
      paid_at: new Date().toISOString(),
      amount: 5247,
      razorpay_payment_id: "pay_NxK8vJ2mQ9wL3pR",
    },
    branding: {
      appName: "Yajman",
      tagline: "Book pandits for every occasion",
      companyAddress: "Mumbai, Maharashtra, India",
      websiteUrl: "https://yajmanapp.in",
      supportEmail: "contact@yajmanapp.in",
      supportPhone: "+91 8109181057",
    },
  };

  const buffer = await renderInvoicePdf(sample);
  const out = path.join(__dirname, "..", "tmp-invoice-preview.pdf");
  fs.writeFileSync(out, buffer);
  console.log(`Preview written to ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
