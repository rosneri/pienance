import Papa from "papaparse";
import { read, SSF, utils, type CellObject, type WorkSheet } from "xlsx";

function dayOf(serial: number): string {
  const { y, m, d } = SSF.parse_date_code(serial);

  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** A cell as a bank's CSV would write it: days as 2026-10-03, amounts without float noise. */
function textOf(cell: CellObject | undefined): string {
  if (!cell) return "";

  if (cell.t === "n") {
    const value = Number(cell.v);

    if (cell.z !== undefined && SSF.is_date(cell.z)) return dayOf(value);

    return String(Number(value.toPrecision(15)));
  }

  return cell.w ?? String(cell.v ?? "");
}

function rowsOf(sheet: WorkSheet): string[][] {
  const range = utils.decode_range(sheet["!ref"] ?? "A1");
  const rows: string[][] = [];

  for (let row = range.s.r; row <= range.e.r; row += 1) {
    const cells: string[] = [];

    for (let column = range.s.c; column <= range.e.c; column += 1) {
      cells.push(textOf(sheet[utils.encode_cell({ r: row, c: column })]));
    }

    rows.push(cells);
  }

  return rows;
}

/**
 * The first sheet of an Excel or OpenDocument workbook as CSV text, so it is read like any
 * other statement. Null when the file holds no sheet.
 */
export function csvOf(workbook: ArrayBuffer): string | null {
  const book = read(workbook, { type: "array", cellNF: true });
  const first = book.SheetNames[0];
  const sheet = first === undefined ? undefined : book.Sheets[first];

  if (!sheet) return null;

  return Papa.unparse(rowsOf(sheet));
}
