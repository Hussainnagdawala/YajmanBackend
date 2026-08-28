import { pool } from "../../config/database";
import { AppError } from "../../utils/errors";
import { logger } from "../../config/logger";
import { insertActivityLog } from "../../queries/settings.queries";
import { buildExcelBuffer, buildExportFilename } from "./excel.builder";
import { countExportRowsForResource, getExportConfig } from "./export.registry";
import type { ExportResource } from "./export.constants";
import { exportQuerySchema } from "../../validators/export.schema";

const DEFAULT_MAX_ROWS = 50_000;

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  rowCount: number;
  contentType: string;
}

export const runExport = async (
  rawQuery: Record<string, unknown>,
  adminUserId: string,
  ip?: string | null,
  userAgent?: string | null
): Promise<ExportResult> => {
  const base = exportQuerySchema.safeParse(rawQuery);
  if (!base.success) {
    throw base.error;
  }

  const resource = base.data.resource as ExportResource;
  const format = base.data.format as "xlsx";
  const config = getExportConfig(resource);
  if (!config) {
    throw new AppError("VALIDATION_ERROR", `Unknown export resource: ${resource}`, 400);
  }

  const filterInput = { ...rawQuery };
  delete filterInput.resource;
  delete filterInput.format;

  const parsedFilters = config.filterSchema.safeParse(filterInput);
  if (!parsedFilters.success) {
    throw parsedFilters.error;
  }

  const filters = config.buildFilters(parsedFilters.data as Record<string, unknown>);
  const maxRows = config.maxRows ?? DEFAULT_MAX_ROWS;

  const totalRows = await countExportRowsForResource(resource, filters);
  if (totalRows === 0) {
    throw new AppError("NOT_FOUND", "No records found for the selected filters", 404);
  }
  if (totalRows > maxRows) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Export would include ${totalRows.toLocaleString("en-IN")} rows (max ${maxRows.toLocaleString("en-IN")}). Please narrow your filters.`,
      422,
      [{ field: "filters", message: "Too many rows to export. Apply date range or search filters." }]
    );
  }

  const rows = await config.fetchRows(pool, filters, maxRows, parsedFilters.data as Record<string, unknown>);
  const buffer = await buildExcelBuffer(config.sheetName, config.columns, rows);
  const filename = buildExportFilename(config.filenamePrefix, format);

  try {
    await pool.query(insertActivityLog, [
      adminUserId,
      "export_data",
      "export",
      resource,
      null,
      JSON.stringify({ resource, rowCount: rows.length, filters: parsedFilters.data }),
      ip ?? null,
      userAgent ?? null,
    ]);
  } catch (err) {
    logger.warn("Failed to write export activity log", { err, resource });
  }

  logger.info("Admin export completed", { resource, rowCount: rows.length, adminUserId });

  return {
    buffer,
    filename,
    rowCount: rows.length,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
};
