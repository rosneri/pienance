import { describe, expect, it } from "vitest";
import { Proportion } from "./proportion";
import { roughly } from "./rough-size";

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
