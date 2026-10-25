import { describe, expect, it } from "vitest";
import { currencyOf } from "./currency";
import { Money } from "./money";
import { sweepSteps, sweptBy } from "./sweep";

const money = (amount: string, code: string) => Money.parse(amount, currencyOf(code));

describe("rounding up", () => {
  it.each([
    ["4.30", "1", "EUR", "5.00"],
    ["431", "10", "JPY", "440"],
    ["1.234", "1", "KWD", "2.000"],
    ["5.00", "1", "EUR", "5.00"],
  ])("rounds %s up to the next %s %s", (amount, step, code, rounded) => {
    expect(money(amount, code).roundUpTo(money(step, code)).toDecimal()).toBe(rounded);
  });

  it("sweeps the difference, and nothing on a whole step", () => {
    expect(sweptBy(money("4.30", "EUR"), money("1", "EUR")).toDecimal()).toBe("0.70");
    expect(sweptBy(money("10", "EUR"), money("5", "EUR")).minor).toBe(0);
  });

  it("offers steps a currency can sweep with", () => {
    expect(sweepSteps(currencyOf("EUR")).map((step) => step.toDecimal())).toEqual([
      "1.00",
      "5.00",
      "10.00",
    ]);
    expect(sweepSteps(currencyOf("JPY")).map((step) => step.toDecimal())).toEqual([
      "10",
      "50",
      "100",
    ]);
  });
});
