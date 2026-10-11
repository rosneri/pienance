import { describe, expect, it } from "vitest";
import { currencyOf } from "./currency";
import { cutsOf, RecurrenceCut, SliceCut, WholeCut } from "./cut";
import { focusOn } from "./focus";
import { Money } from "./money";
import { Month } from "./month";
import { Pie } from "./pie";
import { Proportion } from "./proportion";

const eur = (amount: number) => Money.parse(String(amount), currencyOf("EUR"));

const october = Month.of(new Date(Date.UTC(2026, 9, 1)));

const needs = { id: "needs", name: "Needs", share: Proportion.of(0.5) };

const wants = { id: "wants", name: "Wants", share: Proportion.of(0.5) };

const pie = Pie.bake({
  id: "pie",
  ownerId: "ada",
  income: eur(1000),
  slices: [needs, wants],
  bakedAt: october.start,
  month: october,
  bites: [
    { id: "concert", sliceId: "wants", amount: eur(100), note: "", eatenAt: october.start },
    { id: "bread", sliceId: "needs", amount: eur(50), note: "", eatenAt: october.start },
  ],
  staples: [
    { id: "rent", sliceId: "needs", amount: eur(250), note: "Rent", since: october },
    { id: "void", sliceId: "needs", amount: eur(9), note: "", since: october, until: october },
  ],
});

const ids = (cut: Parameters<typeof focusOn>[1]) =>
  focusOn(pie, cut).food.map(({ item }) => item.id);

describe("cuts", () => {
  it("offer the overview, each slice, then every month and one time", () => {
    expect(cutsOf(pie).map((cut) => [cut.key, cut.name])).toEqual([
      ["whole", "Your pie"],
      ["slice:needs", "Needs"],
      ["slice:wants", "Wants"],
      ["recurrence:every-month", "Every month"],
      ["recurrence:one-time", "One time"],
    ]);
  });

  it("see everything through the whole cut, against the income", () => {
    const whole = focusOn(pie, new WholeCut());

    expect(ids(new WholeCut())).toEqual(["concert", "bread", "rent"]);
    expect(whole.eaten.ratio).toBe(0.4);
    expect(whole.left.ratio).toBeCloseTo(0.6);
  });

  it("measure a slice against its own share", () => {
    const focus = focusOn(pie, new SliceCut(needs));

    expect(ids(new SliceCut(needs))).toEqual(["bread", "rent"]);
    expect(focus.eaten.ratio).toBe(0.6);
    expect(focus.ofPie.ratio).toBe(0.3);
    expect(focus.eaten.ratio).toBe(pie.servings()[0]?.eaten.ratio);
  });

  it("split staples from bites across slices, against the income", () => {
    expect(ids(new RecurrenceCut("every-month"))).toEqual(["rent"]);
    expect(ids(new RecurrenceCut("one-time"))).toEqual(["concert", "bread"]);
    expect(focusOn(pie, new RecurrenceCut("one-time")).eaten.ratio).toBe(0.15);
  });
});
