import { describe, expect, it } from "vitest";
import { Proportion } from "./proportion";
import { asFraction, roughly } from "./rough-size";

describe("roughly", () => {
  it.each([
    [0, "nothing"],
    [0.02, "a crumb"],
    [0.1, "about a tenth"],
    [0.25, "about a quarter"],
    [0.33, "about a third"],
    [0.5, "about half"],
    [0.75, "about three quarters"],
    [1, "all"],
    [1.2, "more than all"],
    [Number.POSITIVE_INFINITY, "way more than all"],
  ])("describes %d as %s", (ratio, words) => {
    expect(roughly(Proportion.of(ratio))).toBe(words);
  });
});

describe("asFraction", () => {
  it.each([
    [5 / 9, "5/9"],
    [0.5, "1/2"],
    [0.25, "1/4"],
    [0.3, "3/10"],
    [0.333, "1/3"],
    [0.7, "7/10"],
    [0.12, "1/8"],
    [0.06, "1/10"],
    [0.02, "under 1/10"],
    [0, "nothing"],
    [0.98, "all"],
    [1, "all"],
    [1.5, "3/2"],
    [Number.POSITIVE_INFINITY, "more than all"],
  ])("says %d as %s", (ratio, fraction) => {
    expect(asFraction(Proportion.of(ratio))).toBe(fraction);
  });
});
