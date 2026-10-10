import { describe, expect, it } from "vitest";
import { currencyOf } from "./currency";
import { Money } from "./money";
import { Proportion } from "./proportion";

const eur = currencyOf("EUR");

describe("Money", () => {
  it.each([
    ["12", "EUR", 1200],
    ["12.5", "EUR", 1250],
    ["12,50", "EUR", 1250],
    ["0.005", "EUR", 0],
    ["0.015", "EUR", 2],
    ["450000", "JPY", 450000],
    ["1.2345", "KWD", 1234],
  ])("parses %s %s into %d minor units", (decimal, code, minor) => {
    expect(Money.parse(decimal, currencyOf(code)).minor).toBe(minor);
  });

  it.each(["", "abc", "-5", "1.2.3", "1e5"])("refuses %j", (decimal) => {
    expect(() => Money.parse(decimal, eur)).toThrow(RangeError);
  });

  it("splits without losing a cent", () => {
    const parts = Money.parse("100", eur).split([1 / 3, 1 / 3, 1 / 3].map(Proportion.of));

    expect(parts.map((part) => part.minor)).toEqual([3334, 3333, 3333]);
  });

  it("never goes below zero", () => {
    expect(Money.parse("5", eur).minus(Money.parse("8", eur)).minor).toBe(0);
  });

  it("refuses to mix currencies", () => {
    expect(() => Money.parse("5", eur).plus(Money.parse("5", currencyOf("USD")))).toThrow(
      RangeError,
    );
  });

  it("knows unknown currencies are unknown", () => {
    expect(() => currencyOf("XYZ")).toThrow(RangeError);
  });
});
