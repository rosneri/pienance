import type { Rows } from "@pienance/core";
import Papa from "papaparse";

/** Parses a CSV file of any dialect (delimiter, quoting, line endings, BOM) into rows. */
export function rowsOf(text: string): Rows {
  const { data } = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });

  return data;
}
