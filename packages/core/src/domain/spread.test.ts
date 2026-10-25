import { describe, expect, it } from "vitest";
import { currencyOf } from "./currency";
import { Money } from "./money";
import { spreadOver } from "./spread";

const minors = (amount: string, code: string, months: number) =>
  spreadOver(Money.parse(amount, currencyOf(code)), months).map((part) => part.minor);

describe("spreadOver", () => {
  it.each([
    ["10", "JPY", 3, [4, 3, 3]],
    ["100", "EUR", 3, [3334, 3333, 3333]],
    ["1", "KWD", 6, [167, 167, 167, 167, 166, 166]],
  ])(
    "splits %s %s over %i months, the first parts carrying the rest",
    (amount, code, months, parts) => {
      expect(minors(amount, code, months)).toEqual(parts);
    },
  );

  it.each([1, 25, 2.5])("refuses %s months", (months) => {
    expect(() => minors("10", "EUR", months)).toThrow("Spread it over 2 to 24 months.");
  });
});
