import type { Rows } from "@pienance/core";
import Papa from "papaparse";

/** The largest statement accepted, in characters: years of a busy account. */
export const largestStatement = 2_000_000;

/** Parses a CSV file of any dialect (delimiter, quoting, line endings, BOM) into rows. */
export function rowsOf(text: string): Rows {
  const { data } = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });

  return data;
}
