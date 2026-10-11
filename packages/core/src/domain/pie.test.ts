import { describe, expect, it } from "vitest";
import type { Bite } from "./bite";
import { currencyOf } from "./currency";
import { Money } from "./money";
import { Month } from "./month";
import { Pie, PieError } from "./pie";
import { Proportion } from "./proportion";
import type { Staple } from "./staple";

const eur = (amount: number) => Money.parse(String(amount), currencyOf("EUR"));

const slices = [
  { id: "needs", name: "Needs", share: Proportion.of(0.5) },
  { id: "wants", name: "Wants", share: Proportion.of(0.5) },
];

const bakedAt = new Date(Date.UTC(2026, 9, 1));

let biteCount = 0;

const bite = (sliceId: string, amount: number): Bite => ({
  id: `bite-${++biteCount}`,
  sliceId,
  amount: eur(amount),
  note: "",
  eatenAt: new Date(),
});

const pieOf = (bites: Bite[] = [], staples: Staple[] = []) =>
  Pie.bake({
    id: "pie",
    ownerId: "ada",
    income: eur(1000),
    slices,
    bakedAt,
    month: october,
    bites,
    staples,
  });

const october = Month.of(bakedAt);

const staple = (sliceId: string, amount: number, id = "rent"): Staple => ({
  id,
  sliceId,
  amount: eur(amount),
  note: "Rent",
  since: october,
});

describe("Pie", () => {
  it("refuses slices that do not add up to the whole pie", () => {
    expect(() =>
      Pie.bake({
        id: "pie",
        ownerId: "ada",
        income: eur(1000),
        slices: slices.slice(0, 1),
        bakedAt,
        month: october,
      }),
    ).toThrow(PieError);
  });

  it("refuses bites from unknown slices", () => {
    expect(() => pieOf([bite("dessert", 1)])).toThrow(PieError);
  });

  it("serves what is eaten and left per slice", () => {
    const [needs, wants] = pieOf([bite("needs", 250)]).servings();
    expect(needs?.eaten.ratio).toBe(0.5);
    expect(needs?.left.ratio).toBe(0.5);
    expect(wants?.left.ratio).toBe(1);
  });

  it("knows how much of the whole pie is left", () => {
    expect(pieOf([bite("needs", 250), bite("wants", 250)]).leftover().ratio).toBe(0.5);
  });

  it("weighs a bite that fits", () => {
    const weighing = pieOf().weigh({ sliceId: "wants", amount: eur(50) });
    expect(weighing.verdict).toBe("fits");
    expect(weighing.ofSlice.ratio).toBe(0.1);
    expect(weighing.ofPie.ratio).toBe(0.05);
    expect(weighing.leftAfter.ratio).toBe(0.9);
  });

  it("weighs a bite that leaves only crumbs as tight", () => {
    const weighing = pieOf([bite("wants", 400)]).weigh({
      sliceId: "wants",
      amount: eur(80),
    });

    expect(weighing.verdict).toBe("tight");
    expect(weighing.ofLeftover.ratio).toBe(0.8);
  });

  it("weighs a bite bigger than what is left as overflowing", () => {
    const weighing = pieOf([bite("wants", 400)]).weigh({
      sliceId: "wants",
      amount: eur(200),
    });

    expect(weighing.verdict).toBe("overflows");
    expect(weighing.leftAfter.ratio).toBe(0);
  });

  it("tells how much of its slice a bite took", () => {
    const coffee = bite("wants", 50);

    expect(pieOf([coffee]).portionOf(coffee).ratio).toBe(0.1);
  });

  it("refuses to weigh a bite from an unknown slice", () => {
    expect(() => pieOf().weigh({ sliceId: "dessert", amount: eur(1) })).toThrow(PieError);
  });

  it("belongs to its owner and keeps the income's currency", () => {
    const pie = pieOf();

    expect(pie.ownerId).toBe("ada");
    expect(pie.currency.code).toBe("EUR");
  });

  it("refuses a bite in another currency", () => {
    const dollars = Money.parse("5", currencyOf("USD"));

    expect(() => pieOf().weigh({ sliceId: "wants", amount: dollars })).toThrow(PieError);
  });

  it("does not take a bite when only weighing it", () => {
    const pie = pieOf();
    pie.weigh({ sliceId: "wants", amount: eur(50) });
    expect(pie.bites).toHaveLength(0);
  });

  describe("staples", () => {
    it("count as eaten from day one, in servings and leftover", () => {
      const pie = pieOf([bite("needs", 50)], [staple("needs", 300)]);
      const [needs] = pie.servings();

      expect(needs?.eaten.ratio).toBe(0.7);
      expect(needs?.stapled.ratio).toBe(0.6);
      expect(pie.leftover().ratio).toBe(0.65);
    });

    it("weigh in, so a slice they fill overflows with any bite", () => {
      const pie = pieOf([], [staple("needs", 500)]);
      const weighing = pie.weigh({ sliceId: "needs", amount: eur(1) });

      expect(pie.servings()[0]?.left.ratio).toBe(0);
      expect(weighing.verdict).toBe("overflows");
      expect(weighing.stapled.ratio).toBe(1);
    });

    it("refuses one in another currency, on an unknown slice, or of nothing", () => {
      const pie = pieOf();
      const dollars = { ...staple("needs", 1), amount: Money.parse("5", currencyOf("USD")) };

      expect(() => pie.stock(dollars)).toThrow(PieError);
      expect(() => pie.stock(staple("dessert", 1))).toThrow(PieError);
      expect(() => pie.stock(staple("needs", 0))).toThrow("A staple needs an amount above zero");
    });

    it("stops after the month it is dropped in", () => {
      const pie = pieOf([], [{ ...staple("needs", 300), since: october.previous() }]);
      const dropped = pie.drop("rent", october);

      expect(dropped.until?.equals(october.next())).toBe(true);
      expect(pie.servings()[0]?.stapled.ratio).toBe(0.6);
    });

    it("never counted when dropped in the month it was stocked", () => {
      const pie = pieOf([], [staple("needs", 300)]);
      const dropped = pie.drop("rent", october);

      expect(dropped.until?.equals(october)).toBe(true);
      expect(pie.servings()[0]?.eaten.ratio).toBe(0);
      expect(pie.leftover().ratio).toBe(1);
    });

    it("refuses to drop an unknown or stopped staple", () => {
      const pie = pieOf([], [staple("needs", 300)]);

      expect(() => pie.drop("water", october)).toThrow(PieError);
      pie.drop("rent", october);
      expect(() => pie.drop("rent", october)).toThrow("That staple is already stopped");
    });

    it("changes an amount by stopping the old staple where the new one starts", () => {
      const old = { ...staple("needs", 300), since: october.previous() };
      const pie = pieOf([], [old]);

      pie.replace("rent", staple("needs", 350, "new-rent"));

      expect(pie.staples.map((kept) => [kept.id, kept.until?.toString()])).toEqual([
        ["rent", october.toString()],
        ["new-rent", undefined],
      ]);
    });

    it("tells how much of its slice a staple takes", () => {
      const rent = staple("needs", 250);

      expect(pieOf([], [rent]).portionOfStaple(rent).ratio).toBe(0.5);
    });
  });

  describe("putting back and moving bites", () => {
    it("puts a bite back, as if it was never taken", () => {
      const shoes = bite("wants", 100);
      const pie = pieOf([bite("needs", 100), shoes]);

      pie.putBack(shoes.id);

      expect(pie.bites).not.toContain(shoes);
      expect(pie.servings()[1]?.eaten.ratio).toBe(0);
      expect(pie.leftover().ratio).toBe(0.9);
      expect(pie.putBackIds()).toEqual([shoes.id]);
    });

    it("moves a bite, changing only its slice", () => {
      const shoes = { ...bite("wants", 100), note: "Shoes" };
      const pie = pieOf([shoes]);

      const moved = pie.move(shoes.id, "needs");

      expect(moved).toEqual({ ...shoes, sliceId: "needs" });
      expect(pie.bite(shoes.id)).toEqual(moved);
      expect(pie.servings().map((serving) => serving.eaten.ratio)).toEqual([0.2, 0]);
    });

    it("moves a bite into its own slice without a change", () => {
      const shoes = bite("wants", 100);
      const pie = pieOf([shoes]);

      expect(pie.move(shoes.id, "wants")).toBe(shoes);
      expect(pie.bites).toEqual([shoes]);
    });

    it("refuses unknown bites and slices", () => {
      const shoes = bite("wants", 100);
      const pie = pieOf([shoes]);

      expect(() => pie.putBack("nope")).toThrow("That bite is not in this month's pie.");
      expect(() => pie.move("nope", "needs")).toThrow("That bite is not in this month's pie.");
      expect(() => pie.move(shoes.id, "dessert")).toThrow(PieError);
      expect(pie.putBackIds()).toEqual([]);
    });
  });

  describe("re-slicing", () => {
    const retiredWants = { id: "wants", name: "Wants", share: Proportion.none, retired: true };

    it("keeps the id and every bite, with a new income and shares", () => {
      const shoes = bite("wants", 100);
      const pie = pieOf([shoes]);

      const resliced = pie.reslice({
        income: eur(2000),
        slices: [
          { id: "needs", name: "Needs", share: Proportion.of(0.75) },
          { id: "wants", name: "Wants", share: Proportion.of(0.25) },
        ],
      });

      expect(resliced.id).toBe("pie");
      expect(resliced.bites).toEqual([shoes]);
      expect(resliced.portionOf(shoes).ratio).toBe(0.2);
    });

    it("refuses shares that do not add up to the whole pie", () => {
      expect(() =>
        pieOf().reslice({ slices: [{ id: "needs", name: "Needs", share: Proportion.of(0.95) }] }),
      ).toThrow("Slices must add up to the whole pie, got 95%");
    });

    it("retires a slice: no share, no serving once empty, its bites against the whole pie", () => {
      const shoes = bite("wants", 100);
      const needsOnly = [{ id: "needs", name: "Needs", share: Proportion.whole }, retiredWants];

      const withBites = pieOf([shoes]).reslice({ slices: needsOnly });

      expect(withBites.sizeOf(retiredWants).minor).toBe(0);
      expect(withBites.portionOf(shoes).ratio).toBe(0.1);
      expect(withBites.leftover().ratio).toBe(0.9);
      expect(withBites.servings().map((serving) => [serving.slice.id, serving.retired])).toEqual([
        ["needs", false],
        ["wants", true],
      ]);
      expect(pieOf().reslice({ slices: needsOnly }).servings()).toHaveLength(1);
    });

    it("takes nothing more from a retired slice", () => {
      const pie = pieOf([bite("needs", 10)]).reslice({
        slices: [{ id: "needs", name: "Needs", share: Proportion.whole }, retiredWants],
      });

      const retired = "Wants is retired. Pick another slice.";

      expect(() => pie.weigh({ sliceId: "wants", amount: eur(1) })).toThrow(retired);
      expect(() => pie.take(bite("wants", 1))).toThrow(retired);
      expect(() => pie.stock(staple("wants", 1))).toThrow(retired);
      expect(() => pie.move(pie.bites[0]!.id, "wants")).toThrow(retired);
    });

    it("keeps at least one live slice", () => {
      expect(() =>
        pieOf().reslice({
          slices: [{ id: "needs", name: "Needs", share: Proportion.none, retired: true }],
        }),
      ).toThrow(PieError);
    });

    it("refuses to retire a slice with an active staple", () => {
      expect(() =>
        pieOf([], [staple("wants", 100)]).reslice({
          slices: [{ id: "needs", name: "Needs", share: Proportion.whole }, retiredWants],
        }),
      ).toThrow("Stop Wants's staples first.");
    });

    it.each([
      ["", "Every slice needs a name."],
      ["needs", "Two slices are called needs."],
      ["A name far longer than thirty letters", "keep slice names to 30 letters"],
    ])("refuses the name %j", (name, error) => {
      expect(() =>
        pieOf().reslice({
          slices: [
            { id: "needs", name: "Needs", share: Proportion.of(0.5) },
            { id: "wants", name, share: Proportion.of(0.5) },
          ],
        }),
      ).toThrow(error);
    });

    it("refuses an income of nothing", () => {
      expect(() => pieOf().reslice({ income: eur(0), slices })).toThrow(
        "The income needs to be above zero",
      );
    });
  });

  describe("spreading", () => {
    it("weighs this month's part, and the whole amount now", () => {
      const weighing = pieOf().weigh({ sliceId: "wants", amount: eur(600), months: 6 });

      expect(weighing.ofSlice.ratio).toBe(0.2);
      expect(weighing.verdict).toBe("fits");
      expect(weighing.spread?.months).toBe(6);
      expect(weighing.spread?.whole.verdict).toBe("overflows");
    });

    it("finds the fewest months over which a bite fits, or none", () => {
      const pie = pieOf([bite("wants", 400)]);

      expect(pie.fewestMonthsToFit({ sliceId: "wants", amount: eur(300) })).toBe(3);
      expect(pie.fewestMonthsToFit({ sliceId: "wants", amount: eur(90_000) })).toBeNull();
    });

    it("refuses months outside 2 to 24", () => {
      expect(() => pieOf().weigh({ sliceId: "wants", amount: eur(10), months: 30 })).toThrow(
        "Spread it over 2 to 24 months.",
      );
    });

    it("keeps later parts apart from the month's bites, and refuses earlier ones", () => {
      const pie = pieOf();
      const later = { ...bite("wants", 50), eatenAt: october.next().start };

      pie.take(later);

      expect(pie.bites).toEqual([]);
      expect(pie.laterBites).toEqual([later]);
      expect(pie.leftover().ratio).toBe(1);
      expect(() => pie.take({ ...bite("wants", 5), eatenAt: october.previous().start })).toThrow(
        "That bite belongs to an earlier month.",
      );
    });

    it("puts back this month's part and the later ones", () => {
      const spread = { id: "laptop", part: 1, of: 2 };
      const now = { ...bite("wants", 50), spread };

      const next = {
        ...bite("wants", 50),
        eatenAt: october.next().start,
        spread: { ...spread, part: 2 },
      };

      const pie = pieOf([now, next, bite("needs", 5)]);

      pie.putBackSpread("laptop");

      expect(pie.bites.map((eaten) => eaten.sliceId)).toEqual(["needs"]);
      expect(pie.laterBites).toEqual([]);
      expect(pie.putBackSpreadIds()).toEqual(["laptop"]);
      expect(() => pie.putBackSpread("laptop")).toThrow("That bite is not in this month's pie.");
    });
  });

  describe("carrying last month's leftover", () => {
    it("makes its slice bigger and the whole pie the income plus the carry", () => {
      const pie = pieOf([bite("wants", 100)]);

      pie.carryOver({ sliceId: "needs", amount: eur(500) });

      expect(pie.whole.minor).toBe(150_000);
      expect(pie.sizeOf(slices[0]!).minor).toBe(100_000);
      expect(pie.sizeOf(slices[1]!).minor).toBe(50_000);
      expect(pie.servings().map((serving) => serving.ofPie.ratio)).toEqual([2 / 3, 1 / 3]);
      expect(pie.leftover().ratio).toBeCloseTo(1 - 100 / 1500);
      expect(pie.leftoverMoney().minor).toBe(140_000);
    });

    it("carries nothing from an overspent month", () => {
      expect(pieOf([bite("wants", 1200)]).leftoverMoney().minor).toBe(0);
    });

    it("carries once, into a live slice, and can be undone", () => {
      const pie = pieOf();

      expect(() => pie.carryOver({ sliceId: "dessert", amount: eur(5) })).toThrow(PieError);
      expect(() => pie.carryOver({ sliceId: "needs", amount: eur(0) })).toThrow(
        "There is nothing to carry.",
      );

      pie.carryOver({ sliceId: "needs", amount: eur(5) });

      expect(() => pie.carryOver({ sliceId: "wants", amount: eur(5) })).toThrow(
        "Already carried this month.",
      );

      pie.dropCarry();

      expect(pie.carry).toBeUndefined();
      expect(pie.carryDropped()).toBe(true);
      expect(pie.whole.minor).toBe(100_000);
    });

    it("refuses to retire the slice holding the carry", () => {
      const pie = pieOf();

      pie.carryOver({ sliceId: "wants", amount: eur(5) });

      expect(() =>
        pie.reslice({
          slices: [
            { id: "needs", name: "Needs", share: Proportion.whole },
            { id: "wants", name: "Wants", share: Proportion.none, retired: true },
          ],
        }),
      ).toThrow("Undo the carry first.");
    });
  });

  describe("sweeping", () => {
    const sweepInto = (pie: Pie) => pie.setSweep({ sliceId: "wants", step: eur(1) });

    it("sweeps what rounding a bite up leaves, but not into its own slice or on a whole step", () => {
      const pie = pieOf();

      expect(pie.sweepOf({ sliceId: "needs", amount: eur(4.3) })).toBeUndefined();

      sweepInto(pie);

      expect(pie.sweepOf({ sliceId: "needs", amount: eur(4.3) })?.amount.toDecimal()).toBe("0.70");
      expect(pie.sweepOf({ sliceId: "wants", amount: eur(4.3) })).toBeUndefined();
      expect(pie.sweepOf({ sliceId: "needs", amount: eur(4) })).toBeUndefined();
    });

    it("counts each sweep once: from its slice, and against the whole pie", () => {
      const lunch = {
        ...bite("needs", 4.3),
        swept: { sliceId: "wants", amount: eur(0.7) },
      };

      const pie = pieOf([lunch]);

      expect(pie.servings().map((serving) => serving.eaten.ratio)).toEqual([0.0086, 0.0014]);
      expect(pie.leftover().ratio).toBeCloseTo(0.995);

      pie.putBack(lunch.id);

      expect(pie.leftover().ratio).toBe(1);
    });

    it("refuses a retired or unknown slice, and retiring the sweep's slice", () => {
      const pie = pieOf();

      expect(() => pie.setSweep({ sliceId: "dessert", step: eur(1) })).toThrow(PieError);
      expect(() => pie.setSweep({ sliceId: "wants", step: eur(0) })).toThrow(
        "A sweep needs a step above zero.",
      );

      sweepInto(pie);

      expect(() =>
        pie.reslice({
          slices: [
            { id: "needs", name: "Needs", share: Proportion.whole },
            { id: "wants", name: "Wants", share: Proportion.none, retired: true },
          ],
        }),
      ).toThrow("Turn the sweep off first.");
    });
  });
});
