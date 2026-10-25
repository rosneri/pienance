import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import { csvOf } from "./spreadsheet";
import { isSpreadsheet } from "./spreadsheet-types";

function workbook(rows: unknown[][], bookType: "xlsx" | "xls" | "ods" = "xlsx"): ArrayBuffer {
  const book = utils.book_new();

  utils.book_append_sheet(book, utils.aoa_to_sheet(rows), "Statement");

  return write(book, { type: "array", bookType });
}

describe("csvOf", () => {
  it("writes the first sheet as CSV, with days as 2026-10-02 whatever the time zone", () => {
    const csv = csvOf(
      workbook([
        ["Bank X, current account"],
        ["Date", "Description", "Amount"],
        [new Date(2026, 9, 2), "Shop, corner", -4.2],
        [new Date(2026, 9, 3), "Rent", -900],
      ]),
    );

    expect(csv).toBe(
      '"Bank X, current account",,\r\nDate,Description,Amount\r\n' +
        '2026-10-02,"Shop, corner",-4.2\r\n2026-10-03,Rent,-900',
    );
  });

  it("drops float noise from amounts and keeps text as written", () => {
    expect(csvOf(workbook([["0.1 + 0.2", 0.1 + 0.2, "02.10.2026"]]))).toBe(
      "0.1 + 0.2,0.3,02.10.2026",
    );
  });

  it("reads old Excel and OpenDocument files too", () => {
    expect(
      csvOf(
        workbook(
          [
            ["Date", "Amount"],
            ["2026-10-02", -3],
          ],
          "xls",
        ),
      ),
    ).toBe("Date,Amount\r\n2026-10-02,-3");
    expect(
      csvOf(
        workbook(
          [
            ["Date", "Amount"],
            ["2026-10-02", -3],
          ],
          "ods",
        ),
      ),
    ).toBe("Date,Amount\r\n2026-10-02,-3");
  });
});

describe("isSpreadsheet", () => {
  it("knows spreadsheets by their extension", () => {
    expect(isSpreadsheet("Statement.XLSX")).toBe(true);
    expect(isSpreadsheet("statement.xls")).toBe(true);
    expect(isSpreadsheet("statement.csv")).toBe(false);
  });
});
