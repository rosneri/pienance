// Apart from the converter, so telling a spreadsheet apart does not load SheetJS.

/** The spreadsheet files a statement may come in, besides CSV. */
export const spreadsheetTypes = [".xlsx", ".xls", ".ods"] as const;

export function isSpreadsheet(name: string): boolean {
  const lower = name.toLowerCase();

  return spreadsheetTypes.some((type) => lower.endsWith(type));
}
