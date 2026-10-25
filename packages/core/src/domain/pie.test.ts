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
  Pie.bake({ id: "pie", ownerId: "ada", income: eur(1000), slices, bakedAt, bites, staples });

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
});
