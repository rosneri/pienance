import { describe, expect, it } from "vitest";
import { guessLayout } from "./statement-guess";

/** Rows of a simple CSV (no quoting), as a parser would hand them over. */
function table(text: string, delimiter = ","): string[][] {
  return text
    .trim()
    .split("\n")
    .map((line) => line.trim().split(delimiter));
}

describe("guessLayout", () => {
  it("reads a signed amount with a header", () => {
    const guess = guessLayout(
      table(`
        Date,Description,Amount,Balance
        28/09/2026,Salary,3000.00,3100.00
        30/09/2026,Corner shop,-12.40,3087.60
        14/10/2026,Rent,-900.00,2187.60
      `),
    );

    expect(guess).toEqual({
      layout: {
        skipRows: 1,
        columns: ["date", "description", "amount", "ignore"],
        dates: "dmy",
        decimal: ".",
        spending: "negative",
      },
      sure: true,
    });
  });

  it("skips a bank's preamble and reads European numbers and separate debits", () => {
    const guess = guessLayout(
      table(
        `
        Kontoauszug
        IBAN;DE00 1234
        Buchungstag;Verwendungszweck;Soll;Haben
        2026-10-01;Gehalt;;3.000,00
        2026-10-02;Bäckerei;4,20;
        2026-10-03;Miete;900,00;
      `,
        ";",
      ),
    );

    expect(guess.layout).toMatchObject({
      skipRows: 3,
      columns: ["date", "description", "debit", "credit"],
      dates: "dmy",
      decimal: ",",
    });
    expect(guess.sure).toBe(true);
  });

  it("finds the columns of a file without a header", () => {
    const guess = guessLayout(
      table(`
        10/14/2026,STARBUCKS 1234,4.95
        10/15/2026,AMAZON MKTPLACE,23.10
        10/15/2026,SHELL OIL,40.00
      `),
    );

    expect(guess.layout).toMatchObject({
      skipRows: 0,
      columns: ["date", "description", "amount"],
      dates: "mdy",
      spending: "positive",
    });
    expect(guess.sure).toBe(true);
  });

  it("is unsure when days could be months", () => {
    const guess = guessLayout(
      table(`
        Date,Payee,Amount
        03/10/2026,Cinema,-12.00
        04/10/2026,Bakery,-3.50
      `),
    );

    expect(guess.layout?.dates).toBe("dmy");
    expect(guess.sure).toBe(false);
  });

  it("is unsure between two unnamed money columns", () => {
    const guess = guessLayout(
      table(`
        2026-10-01,Coffee,-3.00,97.00
        2026-10-02,Lunch,-9.00,88.00
      `),
    );

    expect(guess.sure).toBe(false);
  });

  it("finds nothing in a table that is not a statement", () => {
    expect(
      guessLayout(
        table(`
          Name,Email,Born
          Ada,ada@example.com,1815
          Grace,grace@example.com,1906
        `),
      ),
    ).toEqual({ layout: null, sure: false });
  });

  it("finds nothing in an empty file", () => {
    expect(guessLayout([])).toEqual({ layout: null, sure: false });
  });
});
