import { describe, expect, it } from "vitest";
import { rowsOf } from "./csv";

describe("rowsOf", () => {
  it("reads commas, quotes and Windows line endings", () => {
    expect(rowsOf('Date,Description,Amount\r\n2026-10-02,"Shop, corner",-4.20\r\n')).toEqual([
      ["Date", "Description", "Amount"],
      ["2026-10-02", "Shop, corner", "-4.20"],
    ]);
  });

  it("finds the delimiter by itself and drops a byte order mark", () => {
    expect(rowsOf("﻿Buchungstag;Betrag\n02.10.2026;-4,20\n\n")).toEqual([
      ["Buchungstag", "Betrag"],
      ["02.10.2026", "-4,20"],
    ]);
    expect(rowsOf("Date\tAmount\n2026-10-02\t-4.20")).toEqual([
      ["Date", "Amount"],
      ["2026-10-02", "-4.20"],
    ]);
  });
});
