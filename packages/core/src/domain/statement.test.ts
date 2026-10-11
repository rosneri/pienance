import { describe, expect, it } from "vitest";
import { currencyOf } from "./currency";
import {
  isTransactions,
  parseAmount,
  parseDay,
  readSpends,
  type StatementLayout,
} from "./statement";

const eur = currencyOf("EUR");

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("parseDay", () => {
  it.each([
    ["2026-10-03", "dmy", "2026-10-03"],
    ["2026/10/03", "mdy", "2026-10-03"],
    ["2026-10-03T14:22:00Z", "dmy", "2026-10-03"],
    ["03/10/2026", "dmy", "2026-10-03"],
    ["03/10/2026", "mdy", "2026-03-10"],
    ["03.10.26", "dmy", "2026-10-03"],
    ["03/10/2026 08:15", "dmy", "2026-10-03"],
    ["3 Oct 2026", "mdy", "2026-10-03"],
    ["03-oct-26", "dmy", "2026-10-03"],
    ["October 3, 2026", "dmy", "2026-10-03"],
  ] as const)("reads %s (%s)", (text, order, iso) => {
    expect(parseDay(text, order)).toEqual(day(iso));
  });

  it.each(["", "Groceries", "31/02/2026", "13/13/2026", "12.50", "2026", "3 Foo 2026"])(
    "refuses %s",
    (text) => {
      expect(parseDay(text, "dmy")).toBeNull();
    },
  );
});

describe("parseAmount", () => {
  it.each([
    ["12.50", ".", "12.50", false],
    ["-12.50", ".", "12.50", true],
    ["12.50-", ".", "12.50", true],
    ["(1,234.56)", ".", "1234.56", true],
    ["−7", ".", "7", true],
    ["+1,000", ".", "1000", false],
    ["$ 4.99", ".", "4.99", false],
    ["EUR -3.10", ".", "3.10", true],
    ["1.234,56 €", ",", "1234.56", false],
    ["-12,5", ",", "12.5", true],
    ["1 234,56", ",", "1234.56", false],
    ["1'234.50", ".", "1234.50", false],
  ] as const)("reads %s with %s decimals", (text, decimal, plain, negative) => {
    expect(parseAmount(text, decimal)).toEqual({ decimal: plain, negative });
  });

  it.each(["", "Coffee", "2026-10-03", "03/10/2026", "1.234,56", "Order 1234", "12-50"])(
    "refuses %s",
    (text) => {
      expect(parseAmount(text, ".")).toBeNull();
    },
  );
});

describe("readSpends", () => {
  const signed: StatementLayout = {
    skipRows: 1,
    columns: ["date", "description", "amount", "ignore"],
    dates: "dmy",
    decimal: ".",
    spending: "negative",
  };

  const rows = [
    ["Date", "Description", "Amount", "Balance"],
    ["01/10/2026", "Salary", "3000.00", "3000.00"],
    ["02/10/2026", "  Corner   shop ", "-12.40", "2987.60"],
    ["", "", "", ""],
    ["03/10/2026", "Rent", "-900", "2087.60"],
    ["03/10/2026", "Refund", "0.00", "2087.60"],
    ["Closing balance", "", "", "2087.60"],
  ];

  it("keeps the money that left, skipping income, blanks and noise", () => {
    const reading = readSpends(rows, signed, eur);

    expect(
      reading.spends.map((spend) => [spend.eatenOn, spend.amount.toDecimal(), spend.note]),
    ).toEqual([
      [day("2026-10-02"), "12.40", "Corner shop"],
      [day("2026-10-03"), "900.00", "Rent"],
    ]);
    expect(reading.incoming).toBe(2);
    expect(reading.unreadable).toBe(1);
    expect(isTransactions(reading)).toBe(true);
  });

  it("reads positive spends, as credit card statements write them", () => {
    const reading = readSpends(
      [["2026-10-02", "Books", "25.00"]],
      { ...signed, skipRows: 0, columns: ["date", "description", "amount"], spending: "positive" },
      eur,
    );

    expect(reading.spends.map((spend) => spend.amount.toDecimal())).toEqual(["25.00"]);
  });

  it("reads debit and credit columns, joining the descriptions", () => {
    const reading = readSpends(
      [
        ["2026-10-02", "Card", "Bakery", "4,20", ""],
        ["2026-10-03", "Transfer", "Mum", "", "50,00"],
      ],
      {
        skipRows: 0,
        columns: ["date", "description", "description", "debit", "credit"],
        dates: "ymd",
        decimal: ",",
        spending: "negative",
      },
      eur,
    );

    expect(reading.spends.map((spend) => [spend.note, spend.amount.toDecimal()])).toEqual([
      ["Card · Bakery", "4.20"],
    ]);
    expect(reading.incoming).toBe(1);
  });

  it("tells a list of transactions from another table", () => {
    const contacts = readSpends(
      [
        ["Ada", "ada@example.com", "1815"],
        ["Grace", "grace@example.com", "1906"],
      ],
      { ...signed, skipRows: 0 },
      eur,
    );

    expect(isTransactions(contacts)).toBe(false);
  });
});
