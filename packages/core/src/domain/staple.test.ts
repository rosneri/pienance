import { describe, expect, it } from "vitest";
import { currencyOf } from "./currency";
import { Money } from "./money";
import { Month } from "./month";
import { isActiveIn, isVoid, type Staple } from "./staple";

const september = Month.of(new Date(Date.UTC(2026, 8, 1)));

const october = september.next();

const november = october.next();

const december = november.next();

const rent = (until?: Month): Staple => ({
  id: "rent",
  sliceId: "needs",
  amount: Money.parse("800", currencyOf("EUR")),
  note: "Rent",
  since: october,
  ...(until && { until }),
});

describe("Staple", () => {
  it("is active from the month it was stocked on", () => {
    expect(isActiveIn(rent(), september)).toBe(false);
    expect(isActiveIn(rent(), october)).toBe(true);
    expect(isActiveIn(rent(), november)).toBe(true);
  });

  it("is active up to, but not including, the month it stops in", () => {
    expect(isActiveIn(rent(december), november)).toBe(true);
    expect(isActiveIn(rent(december), december)).toBe(false);
  });

  it("was never active when it stops in the month it was stocked", () => {
    for (const month of [september, october, november]) {
      expect(isActiveIn(rent(october), month)).toBe(false);
    }

    expect(isVoid(rent(october))).toBe(true);
    expect(isVoid(rent(november))).toBe(false);
    expect(isVoid(rent())).toBe(false);
  });
});
