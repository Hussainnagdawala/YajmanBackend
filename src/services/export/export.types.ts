import type { ZodSchema } from "zod";
import type { Pool } from "pg";

export type ExportFormat = "xlsx";

export type ExportCellFormat = "date" | "datetime" | "currency" | "boolean" | "text";

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  format?: ExportCellFormat;
}

export interface ExportFilterResult {
  whereClauses: string[];
  values: unknown[];
}

export interface ExportResourceConfig {
  resource: string;
  sheetName: string;
  filenamePrefix: string;
  filterSchema: ZodSchema;
  buildFilters: (query: Record<string, unknown>) => ExportFilterResult;
  fetchRows: (
    pool: Pool,
    filters: ExportFilterResult,
    maxRows: number,
    rawQuery?: Record<string, unknown>
  ) => Promise<Record<string, unknown>[]>;
  columns: ExportColumn[];
  maxRows?: number;
}
