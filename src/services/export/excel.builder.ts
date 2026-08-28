import ExcelJS from "exceljs";
import type { ExportColumn } from "./export.types";

const formatCell = (value: unknown, format?: ExportColumn["format"]): string | number | boolean => {
  if (value === null || value === undefined) return "";

  if (format === "boolean") {
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return value ? "Yes" : "No";
  }

  if (format === "currency") {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return n;
  }

  if (format === "date") {
    const d = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  if (format === "datetime") {
    const d = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export const buildExcelBuffer = async (
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[]
): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Yajman Admin";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width ?? Math.max(col.header.length + 4, 14),
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FF9A3412" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFF7ED" },
  };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 22;

  for (const row of rows) {
    const record: Record<string, string | number | boolean> = {};
    for (const col of columns) {
      record[col.key] = formatCell(row[col.key], col.format);
    }
    sheet.addRow(record);
  }

  if (columns.some((c) => c.format === "currency")) {
    columns.forEach((col, idx) => {
      if (col.format === "currency") {
        const letter = sheet.getColumn(idx + 1).letter;
        sheet.getColumn(idx + 1).numFmt = '"Rs." #,##0.00';
        sheet.getColumn(idx + 1).eachCell({ includeEmpty: false }, (cell, rowNumber) => {
          if (rowNumber > 1 && typeof cell.value === "number") {
            cell.numFmt = '"Rs." #,##0.00';
          }
        });
        void letter;
      }
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

export const buildExportFilename = (prefix: string, format: string): string => {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").slice(0, 12);
  return `${prefix}_${stamp}.${format}`;
};
