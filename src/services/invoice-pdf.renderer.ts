import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { INVOICE_COMPANY as CO } from "../constants/invoice-company";
import type { InvoiceData } from "./invoice.types";

const C = {
  navy: "#2E4053",
  bar: "#2C3E50",
  dark: "#1F2937",
  text: "#374151",
  muted: "#4B5563",
  border: "#1F2937",
  gridLine: "#9CA3AF",
  rowAlt: "#F9FAFB",
  totalBg: "#EAF1F8",
  white: "#FFFFFF",
};

const PAGE = { w: 595.28, h: 841.89 };
const L = 18;
const R = PAGE.w - 18;
const W = R - L;
const SPLIT = L + W * 0.472; // header + info grid column divider
const TOP = 22;
const BOTTOM = PAGE.h - 16;
const MIN_ITEM_ROWS = 4;

// ── Formatting ─────────────────────────────────────────────────────────────

/** "1500", "1500.50" — matches the plain numeric style of the invoice table. */
const amt = (n: number): string => {
  const v = Math.round(Number(n) * 100) / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

/** YYYY-MM-DD (or ISO) → DD/MM/YYYY */
const dmy = (v: string | null | undefined): string => {
  if (!v) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const formatTime = (v: string): string => {
  const [h, mi] = v.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(mi)) return v;
  const dt = new Date();
  dt.setHours(h, mi, 0, 0);
  return dt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
};

const formatDateTime = (v: string | null | undefined): string => {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
};

const cap = (s: string): string => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Strip +91 / spaces so the contact reads like "8120539394". */
const plainPhone = (p: string | null | undefined): string => {
  if (!p) return "—";
  const digits = p.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits || p;
};

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const twoDigits = (n: number): string =>
  n < 20 ? ONES[n] : [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(" ");

const threeDigits = (n: number): string =>
  [n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred` : "", twoDigits(n % 100)].filter(Boolean).join(" ");

/** Indian numbering words; 1100–9999 read as "Fifteen Hundred" style. */
const intToWords = (n: number): string => {
  if (n === 0) return "Zero";
  if (n > 1000 && n < 10000 && Math.floor(n / 100) % 10 !== 0) {
    return [`${twoDigits(Math.floor(n / 100))} Hundred`, twoDigits(n % 100)].filter(Boolean).join(" ");
  }
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${intToWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(" ");
};

const amountInWords = (n: number): string => {
  const rupees = Math.floor(Math.abs(n));
  const paise = Math.round((Math.abs(n) - rupees) * 100);
  return `Rupees ${intToWords(rupees)}${paise ? ` and ${twoDigits(paise)} Paise` : ""} Only.`;
};

// ── Assets ─────────────────────────────────────────────────────────────────

const assetPath = (...rel: string[]): string | null => {
  for (const base of [
    path.join(process.cwd(), "src", "assets"),
    path.join(__dirname, "..", "assets"),
    path.join(process.cwd(), "dist", "assets"),
  ]) {
    const p = path.join(base, ...rel);
    if (fs.existsSync(p)) return p;
  }
  return null;
};

type Doc = PDFKit.PDFDocument;

/** Helvetica has no ₹ glyph — use bundled Noto Sans for rupee strings. */
const registerRupeeFonts = (doc: Doc): { regular: string; bold: string } => {
  const reg = assetPath("fonts", "NotoSans-Regular.ttf");
  const bold = assetPath("fonts", "NotoSans-Bold.ttf");
  if (reg && bold) {
    doc.registerFont("Rupee", reg);
    doc.registerFont("Rupee-Bold", bold);
    return { regular: "Rupee", bold: "Rupee-Bold" };
  }
  return { regular: "Helvetica", bold: "Helvetica-Bold" };
};

// ── Line items ─────────────────────────────────────────────────────────────

type Item = { desc: string; value: string };

const buildItems = (data: InvoiceData): Item[] => {
  const qty = data.pricing.quantity ?? 1;
  const items: Item[] = [
    { desc: qty > 1 ? `${data.service_title} (x${qty})` : data.service_title, value: amt(data.pricing.base_price) },
    ...data.addons.map((a) => ({ desc: `Add-on: ${a.name}`, value: amt(a.price) })),
  ];
  if (data.pricing.convenience_fee > 0) {
    items.push({ desc: "Convenience Fee", value: amt(data.pricing.convenience_fee) });
  }
  if (data.pricing.discount_amount > 0) {
    items.push({
      desc: data.coupon_code ? `Discount (Coupon: ${data.coupon_code})` : "Discount",
      value: `- ${amt(data.pricing.discount_amount)}`,
    });
  }
  return items;
};

type Detail = [string, string];

/** Booking details (left column) and payment details (right column). */
const buildAdditionalDetails = (data: InvoiceData): { booking: Detail[]; payment: Detail[] } => {
  const o = data.order;
  const address = [o.address, o.city, o.state, o.pincode].filter(Boolean).join(", ");
  const paidAmount = data.payment.amount != null ? data.payment.amount : data.pricing.total_amount;
  const booking: (Detail | null)[] = [
    ["Order No", o.order_number],
    data.requires_booking_time ? ["Time of Event", formatTime(o.booking_time)] : null,
    data.pandit?.display_name ? ["Pandit Ji", data.pandit.display_name] : null,
    data.members.length ? ["Members", data.members.join(", ")] : null,
    data.gotra || data.gotra_unknown ? ["Gotra", data.gotra_unknown ? "Not known" : String(data.gotra)] : null,
    o.customer_email ? ["Email", o.customer_email] : null,
    address ? ["Address", address] : null,
  ];
  const payment: Detail[] = [
    ["Payment Status", cap(data.payment.status)],
    ["Payment Method", data.payment.method ? (data.payment.method.toLowerCase() === "upi" ? "UPI" : cap(data.payment.method)) : "—"],
    ["Amount Paid", `₹${amt(paidAmount)}`],
    ["Paid On", formatDateTime(data.payment.paid_at)],
    ["Transaction ID", data.payment.razorpay_payment_id ?? "—"],
  ];
  return { booking: booking.filter((d): d is Detail => d !== null), payment };
};

// ── Renderer ───────────────────────────────────────────────────────────────

export const renderInvoicePdf = async (data: InvoiceData): Promise<Buffer> => {
  const total = data.pricing.total_amount;
  const upiUri =
    `upi://pay?pa=${encodeURIComponent(CO.upiId)}&pn=${encodeURIComponent(CO.legalName)}` +
    `&am=${Number(total).toFixed(2)}&cu=INR&tn=${encodeURIComponent(data.invoice_number)}`;
  const qrPng = await QRCode.toBuffer(upiUri, { errorCorrectionLevel: "M", margin: 0, width: 360 });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const rupee = registerRupeeFonts(doc);
    const line = (x1: number, y1: number, x2: number, y2: number, color = C.border, w = 0.6) =>
      doc.moveTo(x1, y1).lineTo(x2, y2).strokeColor(color).lineWidth(w).stroke();
    const box = (x: number, y: number, w: number, h: number, fill?: string) => {
      if (fill) doc.rect(x, y, w, h).fill(fill);
      doc.rect(x, y, w, h).strokeColor(C.border).lineWidth(0.6).stroke();
    };
    /** Bold label + regular value on one baseline, Times like the reference invoice. */
    const labelValue = (label: string, value: string, x: number, y: number, w: number, size = 10.5) => {
      doc.fillColor(C.dark).font("Times-Bold").fontSize(size);
      doc.text(`${label} `, x, y, { continued: true, width: w });
      doc.font("Times-Roman").text(value);
    };

    let y = TOP;

    // ── Header: logo | company details ──────────────────────────────────
    const hdrPad = 6;
    const rx = SPLIT + hdrPad;
    const rw = R - rx - hdrPad;
    const companyLines: [string, number][] = [
      [CO.address, 6.8],
      [`PAN: ${CO.pan}.`, 7.5],
      [`GSTIN: ${CO.gstin}`, 7.5],
      [`Email: ${CO.email}`, 7.5],
      [`Mobile: ${CO.mobile}`, 7.5],
    ];
    doc.font("Helvetica-Bold").fontSize(17);
    const brandH = doc.heightOfString(CO.brandName, { width: rw });
    doc.fontSize(13);
    const legalH = doc.heightOfString(CO.legalName, { width: rw });
    doc.font("Times-Roman");
    const linesH = companyLines.reduce((s, [t, fs]) => s + doc.fontSize(fs).heightOfString(t, { width: rw }), 0);
    const headerH = Math.max(112, hdrPad + brandH + legalH + 2 + linesH + hdrPad + 4);

    box(L, y, W, headerH);
    line(SPLIT, y, SPLIT, y + headerH);

    const logo = assetPath("brand", "logo.png");
    const logoW = SPLIT - L - 20;
    const logoH = headerH - 30;
    if (logo) {
      doc.image(logo, L + 10, y + 15, { fit: [logoW, logoH], align: "center", valign: "center" });
    } else {
      doc.fillColor("#C2410C").font("Helvetica-Bold").fontSize(28);
      doc.text(CO.brandName, L, y + headerH / 2 - 14, { width: SPLIT - L, align: "center" });
    }

    let hy = y + hdrPad;
    doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(17).text(CO.brandName, rx, hy, { width: rw });
    hy += brandH;
    doc.fontSize(13).text(CO.legalName, rx, hy, { width: rw });
    hy += legalH + 2;
    doc.fillColor(C.text).font("Times-Roman");
    for (const [t, fs] of companyLines) {
      doc.fontSize(fs).text(t, rx, hy, { width: rw });
      hy += doc.heightOfString(t, { width: rw });
    }
    y += headerH;

    // ── Spacer row, TAX INVOICE bar, spacer row ─────────────────────────
    box(L, y, W, 18);
    y += 18;
    doc.rect(L, y, W, 18).fill(C.bar);
    doc.fillColor(C.white).font("Helvetica-Bold").fontSize(11.5).text("TAX INVOICE", L, y + 4, { width: W, align: "center" });
    y += 18;
    box(L, y, W, 14);
    y += 14;

    // ── Invoice info grid ───────────────────────────────────────────────
    const rowH = 30;
    const cellPad = 6;
    const leftW = SPLIT - L - cellPad * 2;
    const rightW = R - SPLIT - cellPad * 2;
    box(L, y, W, rowH * 3);
    line(SPLIT, y, SPLIT, y + rowH * 3);
    line(L, y + rowH, SPLIT, y + rowH);
    line(L, y + rowH * 2, R, y + rowH * 2);
    const ty = (row: number) => y + row * rowH + rowH / 2 - 6;

    labelValue("Invoice No:", data.invoice_number, L + cellPad, ty(0), leftW);
    labelValue("Date of Invoice:", dmy(data.issued_date), L + cellPad, ty(1), leftW);
    labelValue("Date of Event:", dmy(data.order.booking_date), L + cellPad, ty(2), leftW);
    labelValue("Customer Name:", data.order.customer_name, SPLIT + cellPad, ty(0) + 3, rightW);
    labelValue("Contact:", plainPhone(data.order.customer_phone), SPLIT + cellPad, ty(2), rightW);
    y += rowH * 3;

    // ── Items table ─────────────────────────────────────────────────────
    const col = {
      sno: { x: L, w: 34 },
      desc: { x: L + 34, w: 366 },
      val: { x: L + 400, w: W - 400 },
    };
    const theadH = 32;
    doc.rect(L, y, W, theadH).fill(C.navy);
    doc.fillColor(C.white).font("Helvetica-Bold").fontSize(9.5);
    const thy = y + theadH / 2 - 5;
    doc.text("S.No.", col.sno.x + 6, thy, { width: col.sno.w + 20 });
    doc.text("Description of Corporate Service", col.desc.x + 8, thy, { width: col.desc.w - 16 });
    doc.font(rupee.bold).fontSize(9.5).text("Invoice Value (₹)", col.val.x, thy - 2, { width: col.val.w, align: "center" });
    y += theadH;

    const items = buildItems(data);
    while (items.length < MIN_ITEM_ROWS) items.push({ desc: "", value: "" });
    items.forEach((it, i) => {
      doc.font("Helvetica").fontSize(9.5);
      const h = Math.max(24, doc.heightOfString(it.desc || " ", { width: col.desc.w - 16 }) + 14);
      if (i % 2 === 1) doc.rect(col.val.x, y, col.val.w, h).fill(C.rowAlt);
      box(col.sno.x, y, col.sno.w, h);
      box(col.desc.x, y, col.desc.w, h);
      box(col.val.x, y, col.val.w, h);
      if (it.desc) {
        doc.fillColor(C.dark).font("Times-Roman").fontSize(8).text(String(i + 1), col.sno.x, y + h / 2 - 2, { width: col.sno.w, align: "center" });
        doc.font("Helvetica").fontSize(9.5).fillColor(C.dark);
        const dh = doc.heightOfString(it.desc, { width: col.desc.w - 16 });
        doc.text(it.desc, col.desc.x + 8, y + (h - dh) / 2, { width: col.desc.w - 16, align: "left" });
        doc.text(it.value, col.val.x, y + h / 2 - 5, { width: col.val.w, align: "center" });
      }
      y += h;
    });

    // Grand total
    const gtH = 34;
    doc.rect(L, y, W, gtH).fill(C.totalBg);
    box(L, y, col.val.x - L, gtH);
    box(col.val.x, y, col.val.w, gtH);
    doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(10).text("Grand Total Invoice Value:", L, y + gtH / 2 - 5, {
      width: col.val.x - L,
      align: "center",
    });
    doc.font(rupee.regular).fontSize(10).text(`₹${amt(total)}`, col.val.x, y + gtH / 2 - 7, { width: col.val.w, align: "center" });
    y += gtH;

    // ── Footer block: words, notes, bank | signatory, QR ────────────────
    const footTop = y;
    const fx = L + 6;
    const fw = W * 0.5;
    let fy = footTop + 12;
    doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(9.5);
    doc.text(`Amount in Words:  ${amountInWords(total)}`, fx, fy, { width: fw + 40 });
    fy += doc.heightOfString(`Amount in Words:  ${amountInWords(total)}`, { width: fw + 40 }) + 1;
    doc.fontSize(7).text("(Inclusive of all taxes)", fx, fy);
    fy += 14;
    const note =
      "Amounts shown under reimbursement are recovered on actual basis on behalf of the customer pursuant to explicit customer authorization. The company acts strictly as a Pure Agent; no markup or profit has been charged on these components.";
    doc.fillColor(C.muted).font("Helvetica").fontSize(7);
    doc.text(note, fx, fy, { width: fw - 20, lineGap: 0.5 });
    fy += doc.heightOfString(note, { width: fw - 20, lineGap: 0.5 }) + 12;
    doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(7).text("Bank Account Details for Electronic Transfer:", fx, fy);
    fy += 11;
    doc.font("Times-Roman").fontSize(7.2).fillColor(C.text);
    for (const t of [
      `Account Name: ${CO.bank.accountName}`,
      `Account No: ${CO.bank.accountNo}`,
      `Bank & Branch: ${CO.bank.branch}`,
      `IFSC Code: ${CO.bank.ifsc}`,
    ]) {
      doc.text(t, fx, fy);
      fy += 9.5;
    }

    const qrBox = { w: 124, h: 118 };
    const qrX = R - 12 - qrBox.w;
    doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(8).text(`For ${CO.legalName}`, SPLIT, footTop + 12, {
      width: R - SPLIT - 14,
      align: "right",
    });
    doc.font("Helvetica").fontSize(7.2).text("This is System generated invoice and doesn’t require to be sign.", SPLIT, footTop + 22, {
      width: R - SPLIT - 4,
      align: "right",
    });
    const qrY = footTop + 36;
    doc.rect(qrX, qrY, qrBox.w, qrBox.h).strokeColor(C.border).lineWidth(0.6).stroke();
    const qrSize = qrBox.h - 22;
    doc.image(qrPng, qrX + (qrBox.w - qrSize) / 2, qrY + 6, { width: qrSize, height: qrSize });
    doc.fillColor(C.muted).font("Helvetica").fontSize(4.5).text(`UPI ID: ${CO.upiId}`, qrX, qrY + qrBox.h - 11, {
      width: qrBox.w,
      align: "center",
    });

    const footBottom = Math.max(fy, qrY + qrBox.h) + 8;
    box(L, footTop, W, footBottom - footTop);
    y = footBottom;

    // ── Additional details (booking + payment) ──────────────────────────
    const { booking, payment } = buildAdditionalDetails(data);
    const notes = data.special_instructions?.trim();
    const dPad = 6;
    const half = W / 2;
    const dLabelW = 74;
    const dValW = half - dLabelW - dPad * 2;
    const pairs: Detail[][] = Array.from({ length: Math.max(booking.length, payment.length) }, (_, i) =>
      [booking[i], payment[i]].map((d): Detail => d ?? ["", ""])
    );
    const valFont = (v: string) => (v.includes("₹") ? rupee.regular : "Helvetica");
    const cellH = ([lbl, val]: Detail) => {
      doc.font(valFont(val)).fontSize(7.5);
      return Math.max(doc.heightOfString(val || " ", { width: dValW }), doc.font("Helvetica-Bold").heightOfString(lbl || " ", { width: dLabelW }));
    };
    const pairHs = pairs.map((p) => Math.max(...p.map(cellH)) + 6);
    doc.font("Helvetica").fontSize(7.5);
    const notesH = notes ? doc.heightOfString(notes, { width: W - dPad * 2 - dLabelW }) + 8 : 0;
    const sectionH = 12 + 16 + pairHs.reduce((a, b) => a + b, 0) + notesH;

    if (y + sectionH > BOTTOM) {
      doc.addPage({ size: "A4", margin: 0 });
      y = TOP;
    } else {
      y += 12;
    }

    doc.rect(L, y, W, 16).fill(C.bar);
    doc.fillColor(C.white).font("Helvetica-Bold").fontSize(9).text("ADDITIONAL DETAILS", L, y + 4, { width: W, align: "center" });
    y += 16;
    const dTop = y;
    pairs.forEach((p, i) => {
      const h = pairHs[i];
      p.forEach(([lbl, val], j) => {
        if (!lbl) return;
        const x = L + j * half + dPad;
        doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(7.5).text(lbl, x, y + 4, { width: dLabelW });
        doc.font(valFont(val)).fontSize(7.5).fillColor(C.text).text(val, x + dLabelW, y + (valFont(val) === "Helvetica" ? 4 : 2.5), { width: dValW });
      });
      y += h;
      line(L, y, R, y, C.gridLine, 0.4);
    });
    line(L + half, dTop, L + half, y, C.gridLine, 0.4);
    if (notes) {
      doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(7.5).text("Special Instructions", L + dPad, y + 4, { width: dLabelW });
      doc.font("Helvetica").fillColor(C.text).text(notes, L + dPad + dLabelW, y + 4, { width: W - dPad * 2 - dLabelW });
      y += notesH;
    }
    box(L, dTop, W, y - dTop);

    doc.end();
  });
};
