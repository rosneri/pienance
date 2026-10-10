import { describe, expect, it } from "vitest";
import { currencyOf, Money, Pie, Proportion } from "../domain";
import { viewPie, viewWeighing } from "./pie-view";

const eur = (amount: number) => Money.parse(String(amount), currencyOf("EUR"));

const pie = Pie.bake({
  id: "pie",
  ownerId: "ada",
  income: eur(1000),
  slices: [
    { id: "needs", name: "Needs", share: Proportion.of(0.5) },
    { id: "wants", name: "Wants", share: Proportion.of(0.5) },
  ],
  bites: [
    {
      id: "coffee",
      sliceId: "wants",
      amount: eur(125),
      note: "Coffee",
      eatenAt: new Date(Date.UTC(2026, 9, 1)),
    },
  ],
});

describe("viewPie", () => {
  it("tells the pie's currency", () => {
    expect(viewPie(pie).currency).toBe("EUR");
  });

  it("lays slices around the pie with what is left", () => {
    expect(viewPie(pie).slices).toEqual([
      { id: "needs", name: "Needs", from: 0, to: 0.5, left: 1, leftWords: "all" },
      {
        id: "wants",
        name: "Wants",
        from: 0.5,
        to: 1,
        left: 0.75,
        leftWords: "about three quarters",
      },
    ]);
  });

  it("describes bites roughly", () => {
    expect(viewPie(pie).bites).toEqual([
      {
        id: "coffee",
        note: "Coffee",
        sliceName: "Wants",
        portionWords: "about a quarter",
        eatenAt: "2026-10-01T00:00:00.000Z",
      },
    ]);
  });

  it("describes a weighing roughly", () => {
    const view = viewWeighing(pie.weigh({ sliceId: "wants", amount: eur(100) }));
    expect(view).toEqual({
      sliceName: "Wants",
      ofSlice: "about a fifth",
      ofLeftover: "about a quarter",
      ofPie: "about a tenth",
      leftAfter: "about half",
      verdict: "fits",
    });
  });
});
