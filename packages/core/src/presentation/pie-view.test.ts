import { describe, expect, it } from "vitest";
import { currencyOf, Money, Month, Pie, Proportion } from "../domain";
import { viewPie, viewWeighing } from "./pie-view";
import { viewAppetite, viewShelf } from "./shelf-view";

const eur = (amount: number) => Money.parse(String(amount), currencyOf("EUR"));

const october = Month.of(new Date(Date.UTC(2026, 9, 1)));

const pie = Pie.bake({
  id: "pie",
  ownerId: "ada",
  income: eur(1000),
  slices: [
    { id: "needs", name: "Needs", share: Proportion.of(0.5) },
    { id: "wants", name: "Wants", share: Proportion.of(0.5) },
  ],
  bakedAt: new Date(Date.UTC(2026, 9, 1)),
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
    expect(viewPie(pie, { month: october }).currency).toBe("EUR");
  });

  it("lays slices around the pie with what is left", () => {
    expect(viewPie(pie, { month: october }).slices).toEqual([
      { id: "needs", name: "Needs", from: 0, to: 0.5, left: 1, leftWords: "all", stapled: 0 },
      {
        id: "wants",
        name: "Wants",
        from: 0.5,
        to: 1,
        left: 0.75,
        leftWords: "about three quarters",
        stapled: 0,
      },
    ]);
  });

  it("describes bites roughly", () => {
    expect(viewPie(pie, { month: october }).bites).toEqual([
      {
        id: "coffee",
        sliceId: "wants",
        note: "Coffee",
        sliceName: "Wants",
        portion: "1/4",
        portionWords: "about a quarter",
        eatenAt: "2026-10-01T00:00:00.000Z",
      },
    ]);
  });

  it("describes a weighing roughly", () => {
    const view = viewWeighing(pie.weigh({ sliceId: "wants", amount: eur(100) }));
    expect(view).toEqual({
      sliceName: "Wants",
      portion: "1/5",
      ofSlice: "about a fifth",
      ofLeftover: "about a quarter",
      ofPie: "about a tenth",
      leftAfter: "about half",
      stapled: "nothing",
      verdict: "fits",
    });
  });

  it("names the served month and adds no pace for a month that is over", () => {
    const view = viewPie(pie, { month: october });

    expect([view.month, view.monthName, view.gone, view.goneWords]).toEqual([
      "2026-10",
      "October",
      undefined,
      undefined,
    ]);
    expect(view.slices.every((slice) => slice.pace === undefined)).toBe(true);
  });

  it("paces each slice while the month is running", () => {
    const view = viewPie(pie, { month: october, gone: Proportion.of(0.1) });

    expect(view.goneWords).toBe("about a tenth");
    expect(view.slices.map((slice) => [slice.name, slice.pace, slice.eatenWords])).toEqual([
      ["Needs", "steady", "nothing"],
      ["Wants", "fast", "about a quarter"],
    ]);
  });

  it("paces only what staples leave", () => {
    const rentAndLunch = Pie.bake({
      id: "pie",
      ownerId: "ada",
      income: eur(1000),
      slices: [{ id: "needs", name: "Needs", share: Proportion.whole }],
      bakedAt: october.start,
      bites: [
        { id: "lunch", sliceId: "needs", amount: eur(100), note: "", eatenAt: october.start },
      ],
      staples: [{ id: "rent", sliceId: "needs", amount: eur(500), note: "", since: october }],
    });

    const [needs] = viewPie(rentAndLunch, { month: october, gone: Proportion.of(0.2) }).slices;

    // A fifth of what rent leaves is eaten a fifth into the month: on pace, despite rent.
    expect([needs?.stapled, needs?.eatenWords, needs?.pace]).toEqual([
      0.5,
      "about a fifth",
      "steady",
    ]);
  });

  it("lists staples with their portion, and when a stopped one ends", () => {
    const stapled = Pie.bake({
      id: "pie",
      ownerId: "ada",
      income: eur(1000),
      slices: [{ id: "needs", name: "Needs", share: Proportion.whole }],
      bakedAt: october.start,
      staples: [
        { id: "rent", sliceId: "needs", amount: eur(650), note: "Rent", since: october },
        {
          id: "gym",
          sliceId: "needs",
          amount: eur(40),
          note: "Gym",
          since: october.previous(),
          until: october.next(),
        },
        {
          id: "oops",
          sliceId: "needs",
          amount: eur(5),
          note: "Oops",
          since: october,
          until: october,
        },
      ],
    });

    const view = viewPie(stapled, { month: october });

    expect(view.staples).toEqual([
      {
        id: "rent",
        sliceId: "needs",
        note: "Rent",
        sliceName: "Needs",
        portionWords: "about two thirds",
        amount: "650.00",
        stockedThisMonth: true,
      },
      {
        id: "gym",
        sliceId: "needs",
        note: "Gym",
        sliceName: "Needs",
        portionWords: "a crumb",
        amount: "40.00",
        stockedThisMonth: false,
        endsAfter: "October",
      },
    ]);
    expect(view.slices[0]?.stapledWords).toBe("about two thirds");
    expect(view.slices[0]?.stapled).toBeCloseTo(0.69);
  });
});

describe("viewShelf", () => {
  it("labels each month and marks the one on screen", () => {
    const september = october.previous();

    const shelf = viewShelf(
      [
        { month: october, pie },
        { month: september, pie },
      ],
      september,
    );

    expect(shelf.map(({ month, label, name, current }) => [month, label, name, current])).toEqual([
      ["2026-10", "Oct", "October", false],
      ["2026-09", "Sep", "September", true],
    ]);
    expect(shelf[0]?.leftoverWords).toBe("almost all");
    expect(shelf[0]?.slices[0]?.pace).toBeUndefined();
  });
});

describe("viewAppetite", () => {
  it("speaks the usual roughly and keeps the streak", () => {
    const [needs] = pie.slices;

    expect(
      viewAppetite([
        { slice: needs!, appetite: { usual: Proportion.of(0.75), streak: "overflowing" } },
      ]),
    ).toEqual([
      {
        sliceName: "Needs",
        usual: 0.75,
        usualWords: "about three quarters",
        streak: "overflowing",
      },
    ]);
  });
});

describe("focuses", () => {
  it("offer each slice and each recurrence as a single view", () => {
    expect(
      viewPie(pie, { month: october }).focuses.map((focus) => [
        focus.key,
        focus.kind,
        focus.eatenWords,
        focus.biteIds,
      ]),
    ).toEqual([
      ["slice:needs", "slice", "nothing", []],
      ["slice:wants", "slice", "about a quarter", ["coffee"]],
      ["recurrence:every-month", "recurrence", "nothing", []],
      ["recurrence:one-time", "recurrence", "about a tenth", ["coffee"]],
    ]);
  });
});
