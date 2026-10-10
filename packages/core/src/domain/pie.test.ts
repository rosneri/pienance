import { describe, expect, it } from "vitest";
import type { Bite } from "./bite";
import { Money } from "./money";
import { Pie, PieError } from "./pie";
import { Proportion } from "./proportion";

const slices = [
  { id: "needs", name: "Needs", share: Proportion.of(0.5) },
  { id: "wants", name: "Wants", share: Proportion.of(0.5) },
];

let biteCount = 0;

const bite = (sliceId: string, amount: number): Bite => ({
  id: `bite-${++biteCount}`,
  sliceId,
  amount: Money.of(amount),
  note: "",
  eatenAt: new Date(),
});

const pieOf = (bites: Bite[] = []) =>
  Pie.bake({ id: "pie", income: Money.of(1000), slices, bites });

describe("Pie", () => {
  it("refuses slices that do not add up to the whole pie", () => {
    expect(() =>
      Pie.bake({ id: "pie", income: Money.of(1000), slices: slices.slice(0, 1) }),
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
    const weighing = pieOf().weigh({ sliceId: "wants", amount: Money.of(50) });
    expect(weighing.verdict).toBe("fits");
    expect(weighing.ofSlice.ratio).toBe(0.1);
    expect(weighing.ofPie.ratio).toBe(0.05);
    expect(weighing.leftAfter.ratio).toBe(0.9);
  });

  it("weighs a bite that leaves only crumbs as tight", () => {
    const weighing = pieOf([bite("wants", 400)]).weigh({
      sliceId: "wants",
      amount: Money.of(80),
    });

    expect(weighing.verdict).toBe("tight");
    expect(weighing.ofLeftover.ratio).toBe(0.8);
  });

  it("weighs a bite bigger than what is left as overflowing", () => {
    const weighing = pieOf([bite("wants", 400)]).weigh({
      sliceId: "wants",
      amount: Money.of(200),
    });

    expect(weighing.verdict).toBe("overflows");
    expect(weighing.leftAfter.ratio).toBe(0);
  });

  it("does not take a bite when only weighing it", () => {
    const pie = pieOf();
    pie.weigh({ sliceId: "wants", amount: Money.of(50) });
    expect(pie.bites).toHaveLength(0);
  });
});
