import { describe, expect, it } from "vitest";
import { Proportion } from "./proportion";

describe("Proportion", () => {
  it("keeps a plain ratio and its rounded percent", () => {
    const third = Proportion.of(1 / 3);

    expect(third.ratio).toBeCloseTo(0.3333);
    expect(third.percent).toBe(33);
  });

  it.each([-0.1, Number.NaN])("refuses %d", (ratio) => {
    expect(() => Proportion.of(ratio)).toThrow(RangeError);
  });

  it("measures a part of a whole", () => {
    expect(Proportion.between(25, 100).ratio).toBe(0.25);
    expect(Proportion.between(150, 100).ratio).toBe(1.5);
  });

  it("treats a part of nothing as all, or nothing when the part is nothing too", () => {
    expect(Proportion.between(5, 0).ratio).toBe(Number.POSITIVE_INFINITY);
    expect(Proportion.between(0, 0).ratio).toBe(0);
  });

  it("knows its complement, never below none", () => {
    expect(Proportion.of(0.25).complement().ratio).toBe(0.75);
    expect(Proportion.of(1.5).complement().ratio).toBe(0);
  });

  it("compares", () => {
    expect(Proportion.of(0.5).isMoreThan(Proportion.of(0.25))).toBe(true);
    expect(Proportion.of(0.25).isLessThan(Proportion.of(0.5))).toBe(true);
  });
});
