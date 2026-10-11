import type { Currency } from "./currency";
import { Money } from "./money";

/** What a column of a bank statement holds. */
export type ColumnRole = "date" | "amount" | "debit" | "credit" | "description" | "ignore";

export const columnRoles: readonly ColumnRole[] = [
  "date",
  "amount",
  "debit",
  "credit",
  "description",
  "ignore",
];

/** How a numeric date is written: 2026-10-03, 03/10/2026 or 10/03/2026. */
export type DateOrder = "ymd" | "dmy" | "mdy";

export const dateOrders: readonly DateOrder[] = ["ymd", "dmy", "mdy"];

/** The character before the cents: "1,234.56" or "1.234,56". */
export type DecimalMark = "." | ",";

/** How money leaving the account shows in a single amount column. */
export type Spending = "negative" | "positive";

/** How to read the transactions of one bank's CSV export. */
export interface StatementLayout {
  /** Rows above the first transaction: a bank's preamble and the column names. */
  readonly skipRows: number;
  readonly columns: readonly ColumnRole[];
  readonly dates: DateOrder;
  readonly decimal: DecimalMark;
  readonly spending: Spending;
}

/** Money that left the account, read from one row of a statement. */
export interface Spend {
  /** Midnight UTC of the day it was spent. */
  readonly eatenOn: Date;
  readonly amount: Money;
  readonly note: string;
}

export interface StatementReading {
  readonly spends: readonly Spend[];
  /** Rows of money coming in, or of nothing at all. */
  readonly incoming: number;
  /** Rows whose date or amount could not be read. */
  readonly unreadable: number;
}

/** Below this share of readable rows, a file is not a list of transactions. */
const readableShare = 0.8;

const monthNames = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

const numericDate = /^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})$/;

const dayMonthYear = /^(\d{1,2})[\s-]+([a-z]{3,})\.?[\s-]+(\d{2}|\d{4})$/;

const monthDayYear = /^([a-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})$/;

function utcDay(year: number, month: number, day: number): Date | null {
  const fullYear = year < 100 ? 2000 + year : year;
  const date = new Date(Date.UTC(fullYear, month - 1, day));

  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;

  return date;
}

function namedDay(day = "", monthName = "", year = ""): Date | null {
  const month = monthNames.findIndex((name) => monthName.startsWith(name)) + 1;

  return month > 0 ? utcDay(Number(year), month, Number(day)) : null;
}

/** A day written as a bank would: "2026-10-03", "03/10/26", "3 Oct 2026", "Oct 3, 2026". */
export function parseDay(text: string, order: DateOrder): Date | null {
  const written = text.trim().toLowerCase();
  const dayFirst = dayMonthYear.exec(written);

  if (dayFirst) return namedDay(dayFirst[1], dayFirst[2], dayFirst[3]);

  const monthFirst = monthDayYear.exec(written);

  if (monthFirst) return namedDay(monthFirst[2], monthFirst[1], monthFirst[3]);

  // A time after the day ("2026-10-03T12:00", "03/10/2026 12:00") does not matter.
  const [, first = "", second = "", third = ""] =
    numericDate.exec(written.split(/[\st]/)[0] ?? "") ?? [];

  if (!first) return null;

  if (first.length === 4) return utcDay(Number(first), Number(second), Number(third));

  if (third.length === 1 || third.length === 3) return null;

  return order === "mdy"
    ? utcDay(Number(third), Number(first), Number(second))
    : utcDay(Number(third), Number(second), Number(first));
}

export interface WrittenAmount {
  /** Always positive, with a "." before the cents: "1234.56". */
  readonly decimal: string;
  readonly negative: boolean;
}

const negativeSign = /[-−]|^\(.*\)$/;

const innerDash = /\d\s*[-−]\s*\d/;

const signsAndCurrency = /[-−+()\s\p{Sc}]|\b[A-Z]{3}\b/gu;

const pointGrouping = /^(?:\d{1,3}(?:[,']\d{3})+|\d+)(?:\.\d+)?$/;

const commaGrouping = /^(?:\d{1,3}(?:[.']\d{3})+|\d+)(?:,\d+)?$/;

/** An amount as banks write it: "-12.50", "(1,234.56)", "1.234,56 €", "EUR 12". */
export function parseAmount(text: string, decimal: DecimalMark): WrittenAmount | null {
  const written = text.trim();
  const digits = written.replace(signsAndCurrency, "");

  if (innerDash.test(written)) return null;

  if (!(decimal === "." ? pointGrouping : commaGrouping).test(digits)) return null;

  const plain =
    decimal === "." ? digits.replace(/[,']/g, "") : digits.replace(/[.']/g, "").replace(",", ".");

  return { decimal: plain, negative: negativeSign.test(written) };
}

function cell(row: readonly string[], index: number): string {
  return row[index]?.trim() ?? "";
}

function noteOf(row: readonly string[], columns: readonly ColumnRole[]): string {
  return columns
    .flatMap((role, index) =>
      role === "description" && cell(row, index) ? [cell(row, index)] : [],
    )
    .join(" · ")
    .replace(/\s+/g, " ");
}

type Outflow = { readonly decimal: string } | "incoming" | "unreadable";

function outflowOf(row: readonly string[], layout: StatementLayout): Outflow {
  const at = (role: ColumnRole) => layout.columns.indexOf(role);

  const read = (role: ColumnRole) =>
    at(role) < 0 || !cell(row, at(role)) ? null : parseAmount(cell(row, at(role)), layout.decimal);

  if (at("amount") >= 0) {
    const amount = read("amount");

    if (!amount) return "unreadable";

    return amount.negative === (layout.spending === "negative") ? amount : "incoming";
  }

  const debit = read("debit");

  if (debit) return debit;

  return read("credit") ? "incoming" : "unreadable";
}

/** The money that left the account, row by row, in the pie's currency. */
export function readSpends(
  rows: readonly (readonly string[])[],
  layout: StatementLayout,
  currency: Currency,
): StatementReading {
  const dateAt = layout.columns.indexOf("date");
  const spends: Spend[] = [];
  let incoming = 0;
  let unreadable = 0;

  for (const row of rows.slice(layout.skipRows)) {
    if (row.every((value) => !value.trim())) continue;

    const eatenOn = dateAt < 0 ? null : parseDay(cell(row, dateAt), layout.dates);
    const outflow = outflowOf(row, layout);

    if (!eatenOn || outflow === "unreadable") {
      unreadable += 1;
    } else if (outflow === "incoming") {
      incoming += 1;
    } else {
      const amount = Money.parse(outflow.decimal, currency);

      if (amount.minor === 0) incoming += 1;
      else spends.push({ eatenOn, amount, note: noteOf(row, layout.columns) });
    }
  }

  return { spends, incoming, unreadable };
}

/** Whether a reading is a list of transactions rather than some other table. */
export function isTransactions(reading: StatementReading): boolean {
  const readable = reading.spends.length + reading.incoming;

  return reading.spends.length > 0 && readable >= (readable + reading.unreadable) * readableShare;
}
