import {
  dateOrders,
  parseAmount,
  parseDay,
  type ColumnRole,
  type DecimalMark,
  type StatementLayout,
} from "./statement";

export interface LayoutGuess {
  /** Null when no date or money column could be found. */
  readonly layout: StatementLayout | null;
  /** False when someone (the person, or a model) should check the guess. */
  readonly sure: boolean;
}

type Rows = readonly (readonly string[])[];

/** Share of a column's cells that must read as dates or amounts for it to count as one. */
const enough = 0.9;

const sampleSize = 200;

/** Column names in the languages banks most often export in, in order of precedence. */
const headings: readonly (readonly [ColumnRole | "balance", RegExp])[] = [
  ["balance", /balance|saldo|solde|kontostand|running|\bid\b|iban|account|konto|compte/],
  ["date", /date|datum|fecha|\bdata\b|booked|posted|\bday\b|jour|buchungstag/],
  ["debit", /debit|débit|withdraw|paid out|money out|\bout\b|\bsoll\b|cargo|spent|ausgang/],
  ["credit", /credit|crédit|deposit|paid in|money in|\bin\b|haben|abono|eingang/],
  ["amount", /amount|betrag|importe|montant|valor|value|\bsum\b|umsatz/],
  [
    "description",
    /desc|detail|memo|payee|narrat|text|libell|concept|verwendung|merchant|name|particular|transaction|purpose|reference/,
  ],
];

const moneyHeadings: readonly (ColumnRole | "balance")[] = ["amount", "debit", "credit"];

function headingRole(name: string): ColumnRole | "balance" | null {
  return headings.find(([, pattern]) => pattern.test(name))?.[0] ?? null;
}

function widthOf(rows: Rows): number {
  const counts = new Map<number, number>();

  for (const row of rows)
    if (row.length > 1) counts.set(row.length, (counts.get(row.length) ?? 0) + 1);

  return [...counts].toSorted(([, a], [, b]) => b - a)[0]?.[0] ?? 0;
}

function share(values: readonly string[], reads: (value: string) => boolean): number {
  return values.length === 0 ? 0 : values.filter(reads).length / values.length;
}

function decimalMarkOf(cells: readonly string[]): DecimalMark {
  const commas = cells.filter((value) => /,\d{1,2}\D*$/.test(value)).length;
  const points = cells.filter((value) => /\.\d{1,2}\D*$/.test(value)).length;

  return commas > points ? "," : ".";
}

function isDay(value: string): boolean {
  return dateOrders.some((order) => parseDay(value, order) !== null);
}

function isAmount(value: string): boolean {
  return parseAmount(value, ".") !== null || parseAmount(value, ",") !== null;
}

/** Day-first unless every day reads the same either way; unsure when both orders fit. */
function dateOrderOf(values: readonly string[]) {
  const fits = dateOrders.filter(
    (order) => share(values, (value) => parseDay(value, order) !== null) >= enough,
  );

  const sameEitherWay = values.every(
    (value) => parseDay(value, "dmy")?.getTime() === parseDay(value, "mdy")?.getTime(),
  );

  const ambiguous = !sameEitherWay && fits.includes("dmy") && fits.includes("mdy");

  return { order: fits.includes("dmy") ? "dmy" : (fits[0] ?? "dmy"), sure: !ambiguous };
}

/**
 * Guesses how to read a bank's CSV export from its rows alone: where the
 * transactions start, which column is which, and how dates and amounts are written.
 */
export function guessLayout(rows: Rows): LayoutGuess {
  const width = widthOf(rows);
  const start = rows.findIndex((row) => row.length === width);
  const first = rows[start] ?? [];
  const hasHeader = !first.some((value) => isDay(value) || isAmount(value));
  const skipRows = start + (hasHeader ? 1 : 0);

  const data = rows
    .slice(skipRows)
    .filter((row) => row.length === width && row.some((value) => value.trim()))
    .slice(0, sampleSize);

  if (width < 2 || data.length === 0) return { layout: null, sure: false };

  const columns = Array.from({ length: width }, (_, index) => {
    const values = data.flatMap((row) => (row[index]?.trim() ? [row[index].trim()] : []));

    return {
      index,
      values,
      named: hasHeader ? headingRole(first[index]?.toLowerCase() ?? "") : null,
    };
  });

  const decimal = decimalMarkOf(data.flat());

  const dates = columns.filter(
    (column) =>
      column.values.length >= data.length * enough && share(column.values, isDay) >= enough,
  );

  const date = dates.find((column) => column.named === "date") ?? dates[0];

  const money = columns.filter(
    (column) =>
      column !== date &&
      (column.named === null || moneyHeadings.includes(column.named)) &&
      column.values.length > 0 &&
      share(column.values, (value) => parseAmount(value, decimal) !== null) >= enough,
  );

  if (!date || money.length === 0) return { layout: null, sure: false };

  const roles: ColumnRole[] = columns.map(() => "ignore");
  const order = dateOrderOf(date.values);
  let sure = order.sure;

  roles[date.index] = "date";

  const debit = money.find((column) => column.named === "debit");
  const credit = money.find((column) => column.named === "credit");

  const amount =
    money.find((column) => column.named === "amount") ??
    (money.length === 1 ? money[0] : undefined);

  if (debit) {
    roles[debit.index] = "debit";

    if (credit) roles[credit.index] = "credit";
  } else if (amount) {
    roles[amount.index] = "amount";
  } else {
    // Two or more unnamed money columns: a debit/credit pair, or an amount and a balance.
    sure = false;
    roles[money[0]?.index ?? 0] = money.length === 2 ? "debit" : "amount";

    if (money.length === 2) roles[money[1]?.index ?? 0] = "credit";
  }

  const texts = columns.filter(
    (column) =>
      roles[column.index] === "ignore" && column.named !== "balance" && !money.includes(column),
  );

  const named = texts.filter((column) => column.named === "description");

  const descriptions =
    named.length > 0
      ? named
      : texts.toSorted((a, b) => new Set(b.values).size - new Set(a.values).size).slice(0, 1);

  for (const column of descriptions) roles[column.index] = "description";

  const amountAt = roles.indexOf("amount");

  const spendsAreNegative =
    amountAt < 0 ||
    data.some((row) => parseAmount(row[amountAt] ?? "", decimal)?.negative === true);

  return {
    layout: {
      skipRows,
      columns: roles,
      dates: order.order,
      decimal,
      spending: spendsAreNegative ? "negative" : "positive",
    },
    sure,
  };
}
