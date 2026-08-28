import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import type { InvoiceBranding, InvoiceData } from "./invoice.types";

const C = {
  primary: "#C2410C",
  primaryDark: "#9A3412",
  primaryLight: "#FFF7ED",
  dark: "#1F2937",
  muted: "#6B7280",
  border: "#D1D5DB",
  white: "#FFFFFF",
  rowAlt: "#F9FAFB",
};

const PAGE = { w: 595.28, h: 841.89, m: 44 };
const L = PAGE.m;
const R = PAGE.w - PAGE.m;
const W = R - L;

const formatInr = (n: number): string =>
  `Rs. ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (v: string): string => {
  const [y, mo, d] = v.split("-").map(Number);
  if (!y || !mo || !d) return v;
  return new Date(y, mo - 1, d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
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
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const cap = (s: string): string => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

type Doc = PDFKit.PDFDocument;

const font = (doc: Doc, bold: boolean, size: number): void => {
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size);
};

const hOf = (doc: Doc, text: string, width: number, bold = false, size = 8): number => {
  font(doc, bold, size);
  return doc.heightOfString(text || " ", { width });
};

const textLines = (
  doc: Doc,
  x: number,
  y: number,
  width: number,
  lines: string[],
  size = 8,
  color = C.dark,
  gap = 3
): number => {
  doc.fillColor(color);
  let cy = y;
  for (const line of lines) {
    font(doc, false, size);
    doc.text(line, x, cy, { width, lineGap: 1 });
    cy += hOf(doc, line, width, false, size) + gap;
  }
  return cy;
};

const logoPath = (): string | null => {
  for (const p of [
    path.join(process.cwd(), "src", "assets", "brand", "logo.png"),
    path.join(__dirname, "..", "assets", "brand", "logo.png"),
    path.join(process.cwd(), "dist", "assets", "brand", "logo.png"),
  ]) {
    if (fs.existsSync(p)) return p;
  }
  return null;
};

/** Non-overlapping table columns that sum to inner width */
const tableCols = (pad: number) => {
  const inner = W - pad * 2;
  const descW = inner * 0.44;
  const qtyW = inner * 0.08;
  const rateW = inner * 0.22;
  const amtW = inner * 0.22;
  const base = L + pad;
  return {
    desc: { x: base, w: descW },
    qty: { x: base + descW + 4, w: qtyW },
    rate: { x: base + descW + qtyW + 8, w: rateW },
    amt: { x: base + descW + qtyW + rateW + 12, w: amtW },
  };
};

export const renderInvoicePdf = (data: InvoiceData): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const b = data.branding;
    let y = PAGE.m;

    // ── Header ──────────────────────────────────────────────────────────
    const logoSz = 36;
    const split = L + W * 0.55;
    const leftW = split - L - 8;
    const rightX = split;
    const rightW = R - rightX;
    const cx = L + logoSz + 8;
    const cw = leftW - logoSz - 8;

    const companyExtra = [
      ...(b.tagline ? [b.tagline] : []),
      ...(b.companyAddress ? [b.companyAddress] : []),
      `${b.supportEmail} | ${b.supportPhone}`,
    ];
    const meta = [
      data.invoice_number,
      `Issued: ${formatDate(data.issued_date)}`,
      `Order: ${data.order.order_number}`,
      data.requires_booking_time
        ? `Booking: ${formatDate(data.order.booking_date)}, ${formatTime(data.order.booking_time)}`
        : `Booking: ${formatDate(data.order.booking_date)}`,
    ];

    const headerH =
      Math.max(
        logoSz,
        hOf(doc, b.appName, cw, true, 14) +
          4 +
          companyExtra.reduce((s, l) => s + hOf(doc, l, cw, false, 7) + 2, 0),
        18 + meta.reduce((s, l) => s + hOf(doc, l, rightW, false, 7.5) + 3, 0)
      ) + 14;

    doc.rect(0, 0, PAGE.w, y + headerH - 6).fill(C.primaryLight);

    const lp = logoPath();
    if (lp) doc.image(lp, L, y, { width: logoSz, height: logoSz });
    else {
      doc.roundedRect(L, y, logoSz, logoSz, 4).fill(C.primary);
      doc.fillColor(C.white);
      font(doc, true, 16);
      doc.text("Y", L, y + 8, { width: logoSz, align: "center" });
    }

    doc.fillColor(C.dark);
    font(doc, true, 14);
    doc.text(b.appName, cx, y, { width: cw });
    textLines(doc, cx, y + 17, cw, companyExtra, 7, C.muted, 2);

    doc.fillColor(C.primaryDark);
    font(doc, true, 15);
    doc.text("TAX INVOICE", rightX, y, { width: rightW, align: "right" });
    textLines(doc, rightX, y + 20, rightW, meta, 7.5, C.muted, 3);

    y += headerH;
    doc.moveTo(L, y).lineTo(R, y).strokeColor(C.border).lineWidth(0.5).stroke();
    y += 12;

    // ── Bill To + Service (side by side) ────────────────────────────────
    const cardGap = 10;
    const cardW = (W - cardGap) / 2;
    const pad = 10;
    const inner = cardW - pad * 2;
    const fs = 7.5;

    const billLines = [
      data.order.customer_name,
      `Phone: ${data.order.customer_phone}`,
      ...(data.order.customer_email ? [`Email: ${data.order.customer_email}`] : []),
      ...(data.order.address
        ? [`${[data.order.address, data.order.city, data.order.state, data.order.pincode].filter(Boolean).join(", ")}`]
        : []),
    ];
    const svcLines = [
      data.service_title,
      `Date: ${formatDate(data.order.booking_date)}`,
      ...(data.requires_booking_time ? [`Time: ${formatTime(data.order.booking_time)}`] : []),
      ...(data.members.length ? [`Members: ${data.members.join(", ")}`] : []),
      ...(data.pandit?.display_name ? [`Pandit: ${data.pandit.display_name}`] : []),
    ];

    const cardBodyH = (lines: string[]) => lines.reduce((h, l) => h + hOf(doc, l, inner, false, fs) + 2, 0);
    const cardH = pad * 2 + 12 + Math.max(cardBodyH(billLines), cardBodyH(svcLines)) + 4;

    const drawSideCard = (x: number, title: string, lines: string[]) => {
      doc.roundedRect(x, y, cardW, cardH, 4).fillAndStroke(C.white, C.border);
      doc.fillColor(C.primaryDark);
      font(doc, true, 7.5);
      doc.text(title.toUpperCase(), x + pad, y + pad, { width: inner });
      textLines(doc, x + pad, y + pad + 12, inner, lines, fs, C.dark, 2);
    };

    drawSideCard(L, "Bill To", billLines);
    drawSideCard(L + cardW + cardGap, "Service Details", svcLines);
    y += cardH + 12;

    // ── Line items table ────────────────────────────────────────────────
    doc.fillColor(C.primaryDark);
    font(doc, true, 7.5);
    doc.text("INVOICE DETAILS", L, y, { width: W });
    y += 12;

    const rows = [
      { d: data.service_title, q: "1", r: formatInr(data.pricing.base_price), a: formatInr(data.pricing.base_price) },
      ...data.addons.map((a) => ({ d: `Add-on: ${a.name}`, q: "1", r: formatInr(a.price), a: formatInr(a.price) })),
      ...(data.pricing.convenience_fee > 0
        ? [{ d: "Convenience Fee", q: "1", r: formatInr(data.pricing.convenience_fee), a: formatInr(data.pricing.convenience_fee) }]
        : []),
    ];

    const tPad = 8;
    const col = tableCols(tPad);
    const headH = 20;
    const rowHs = rows.map((row) => Math.max(18, hOf(doc, row.d, col.desc.w, false, 7.5) + 8));
    const tH = tPad + headH + rowHs.reduce((a, b) => a + b, 0) + tPad;

    doc.roundedRect(L, y, W, tH, 4).fillAndStroke(C.white, C.border);
    let ty = y + tPad;
    doc.rect(L + 0.5, ty, W - 1, headH).fill(C.primary);
    doc.fillColor(C.white);
    font(doc, true, 7);
    doc.text("Description", col.desc.x, ty + 5, { width: col.desc.w });
    doc.text("Qty", col.qty.x, ty + 5, { width: col.qty.w, align: "center" });
    doc.text("Rate", col.rate.x, ty + 5, { width: col.rate.w, align: "right" });
    doc.text("Amount", col.amt.x, ty + 5, { width: col.amt.w, align: "right" });
    ty += headH;

    rows.forEach((row, i) => {
      const rh = rowHs[i];
      if (i % 2) doc.rect(L + 0.5, ty, W - 1, rh).fill(C.rowAlt);
      const ry = ty + 4;
      doc.fillColor(C.dark);
      font(doc, false, 7.5);
      doc.text(row.d, col.desc.x, ry, { width: col.desc.w, lineGap: 0 });
      doc.text(row.q, col.qty.x, ry, { width: col.qty.w, align: "center" });
      doc.text(row.r, col.rate.x, ry, { width: col.rate.w, align: "right" });
      doc.text(row.a, col.amt.x, ry, { width: col.amt.w, align: "right" });
      ty += rh;
    });
    y += tH + 10;

    // ── Totals (right-aligned box) ──────────────────────────────────────
    const subtotal =
      data.pricing.base_price + data.addons.reduce((s, a) => s + a.price, 0) + data.pricing.convenience_fee;
    const totalLines: [string, string, boolean?][] = [
      ["Subtotal", formatInr(subtotal)],
      ...(data.pricing.discount_amount > 0 ? ([["Discount", `- ${formatInr(data.pricing.discount_amount)}`]] as [string, string][]) : []),
      ...(data.coupon_code ? ([[`Coupon (${data.coupon_code})`, "Applied"]] as [string, string][]) : []),
      ["Total Payable", formatInr(data.pricing.total_amount), true],
    ];

    const boxW = 200;
    const boxX = R - boxW;
    const boxH = 8 + totalLines.length * 16 + 8;
    doc.roundedRect(boxX, y, boxW, boxH, 4).fillAndStroke(C.primaryLight, C.border);
    let by = y + 8;
    totalLines.forEach(([label, value, bold]) => {
      font(doc, Boolean(bold), bold ? 9 : 7.5);
      doc.fillColor(bold ? C.primaryDark : C.muted);
      doc.text(label, boxX + 8, by, { width: boxW - 16 });
      doc.text(value, boxX + 8, by, { width: boxW - 16, align: "right" });
      by += bold ? 18 : 16;
    });
    y += boxH + 10;

    // ── Payment (compact 2×2 grid) ──────────────────────────────────────
    doc.fillColor(C.primaryDark);
    font(doc, true, 7.5);
    doc.text("PAYMENT INFORMATION", L, y, { width: W });
    y += 11;

    const payItems: [string, string][] = [
      ["Status", cap(data.payment.status)],
      ["Method", data.payment.method ? cap(data.payment.method) : "—"],
      [
        "Amount",
        data.payment.amount != null ? formatInr(Number(data.payment.amount)) : formatInr(data.pricing.total_amount),
      ],
      ["Paid On", formatDateTime(data.payment.paid_at)],
      ["Transaction ID", data.payment.razorpay_payment_id ?? "—"],
    ];

    const pPad = 10;
    const pGap = 8;
    const pColW = (W - pPad * 2 - pGap) / 2;
    const pLabelFs = 6.5;
    const pValueFs = 7.5;
    const pCellH = (lbl: string, val: string) =>
      hOf(doc, lbl, pColW, true, pLabelFs) + 1 + hOf(doc, val, pColW, false, pValueFs) + 6;

    const leftPay = payItems.slice(0, 3);
    const rightPay = payItems.slice(3);
    const pBoxH =
      pPad * 2 +
      Math.max(
        leftPay.reduce((h, [l, v]) => h + pCellH(l, v), 0),
        rightPay.reduce((h, [l, v]) => h + pCellH(l, v), 0)
      );

    doc.roundedRect(L, y, W, pBoxH, 4).fillAndStroke(C.white, C.border);

    const drawPayCol = (items: [string, string][], x: number, startY: number) => {
      let py = startY;
      items.forEach(([lbl, val]) => {
        doc.fillColor(C.muted);
        font(doc, true, pLabelFs);
        doc.text(lbl.toUpperCase(), x, py, { width: pColW });
        py += hOf(doc, lbl, pColW, true, pLabelFs) + 1;
        doc.fillColor(C.dark);
        font(doc, false, pValueFs);
        doc.text(val, x, py, { width: pColW, lineGap: 0 });
        py += hOf(doc, val, pColW, false, pValueFs) + 6;
      });
    };

    drawPayCol(leftPay, L + pPad, y + pPad);
    drawPayCol(rightPay, L + pPad + pColW + pGap, y + pPad);
    y += pBoxH + 8;

    // ── Special instructions (optional, compact) ─────────────────────────
    if (data.special_instructions) {
      const nPad = 10;
      const nW = W - nPad * 2;
      const nH = hOf(doc, data.special_instructions, nW, false, 7.5) + nPad * 2 + 10;
      doc.roundedRect(L, y, W, nH, 4).fillAndStroke("#FFFBEB", C.border);
      doc.fillColor(C.primaryDark);
      font(doc, true, 7);
      doc.text("SPECIAL INSTRUCTIONS", L + nPad, y + nPad, { width: nW });
      doc.fillColor(C.dark);
      font(doc, false, 7.5);
      doc.text(data.special_instructions, L + nPad, y + nPad + 10, { width: nW, lineGap: 1 });
      y += nH + 8;
    }

    // ── Footer (pin to bottom if room, else flow) ────────────────────────
    const footerY = Math.max(y + 16, PAGE.h - PAGE.m - 36);
    doc.moveTo(L, footerY).lineTo(R, footerY).strokeColor(C.border).lineWidth(0.5).stroke();
    textLines(
      doc,
      L,
      footerY + 8,
      W,
      [
        `Thank you for choosing ${b.appName}. Computer-generated invoice — no signature required.`,
        `Support: ${b.supportEmail} | ${b.supportPhone}${b.websiteUrl ? ` | ${b.websiteUrl}` : ""}`,
      ],
      6.5,
      C.muted,
      2
    );

    doc.end();
  });
