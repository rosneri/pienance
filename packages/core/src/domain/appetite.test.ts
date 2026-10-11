import { describe, expect, it } from "vitest";
import { appetiteOf } from "./appetite";
import { Proportion } from "./proportion";

const months = (...ratios: number[]) => ratios.map((ratio) => Proportion.of(ratio));

describe("appetiteOf", () => {
  it("needs three months", () => {
    expect(appetiteOf(months(0.5, 0.6))).toBeNull();
  });

  it("takes the middle of three months as the usual", () => {
    expect(appetiteOf(months(0.9, 0.6, 0.75))).toEqual({ usual: Proportion.of(0.75) });
  });

  it("calls three overflowed months a streak", () => {
    expect(appetiteOf(months(1, 1.2, 1.5))).toEqual({
      usual: Proportion.of(1.2),
      streak: "overflowing",
    });
  });

  it("calls three months each leaving more than half a streak", () => {
    expect(appetiteOf(months(0.2, 0.4, 0.1))?.streak).toBe("leftover");
    expect(appetiteOf(months(0.2, 0.5, 0.1))?.streak).toBeUndefined();
  });
});
