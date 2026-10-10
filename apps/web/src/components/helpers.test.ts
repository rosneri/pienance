import { describe, expect, it } from "vitest";
import { crustBackground, crustFill } from "./crust";
import { currencySymbol } from "./currency-symbol";

describe("currencySymbol", () => {
  it.each([
    ["EUR", "€"],
    ["JPY", "¥"],
    ["GBP", "£"],
  ])("shows %s as %s", (code, symbol) => {
    expect(currencySymbol(code)).toBe(symbol);
  });
});

describe("crust colours", () => {
  it("cycles through the three bakes", () => {
    expect([0, 1, 2, 3].map(crustFill)).toEqual([
      "fill-crust-1",
      "fill-crust-2",
      "fill-crust-3",
      "fill-crust-1",
    ]);
    expect(crustBackground(4)).toBe("bg-crust-2");
  });
});
