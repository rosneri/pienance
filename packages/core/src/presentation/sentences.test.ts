import { describe, expect, it } from "vitest";
import type { Pace } from "../domain";
import type { PieView, SliceView } from "./pie-view";
import {
  describeAppetite,
  describeDropped,
  describeLeftover,
  describePace,
  describePastLeftover,
  describeShelfMonth,
  describeStaple,
  describeWeighing,
} from "./sentences";

const weighing = {
  sliceName: "Wants",
  ofSlice: "about a fifth",
  ofLeftover: "about a quarter",
  ofPie: "about a tenth",
  leftAfter: "about half",
  stapled: "nothing",
} as const;

describe("sentences", () => {
  it.each([
    ["about half", "About half of your pie is left."],
    ["all", "Your whole pie is left."],
    ["nothing", "Your pie is all eaten."],
  ])("describes %s left", (words, sentence) => {
    expect(describeLeftover(words)).toBe(sentence);
  });

  it("describes each verdict", () => {
    expect(describeWeighing({ ...weighing, verdict: "fits" })).toBe(
      "Fits. It is about a fifth of your Wants slice and leaves about half of it.",
    );
    expect(describeWeighing({ ...weighing, verdict: "tight" })).toBe(
      "Tight. It fits, but takes about a quarter of what is left of Wants.",
    );
    expect(describeWeighing({ ...weighing, verdict: "overflows" })).toBe(
      "Too big. It is more than what is left of Wants.",
    );
  });

  it("adds what staples take to a tight or overflowing answer only", () => {
    const stapled = { ...weighing, stapled: "about two thirds" };

    expect(describeWeighing({ ...stapled, verdict: "tight" })).toBe(
      "Tight. It fits, but takes about a quarter of what is left of Wants. Staples already take about two thirds of it.",
    );
    expect(describeWeighing({ ...stapled, verdict: "overflows" })).toBe(
      "Too big. It is more than what is left of Wants. Staples already take about two thirds of it.",
    );
    expect(describeWeighing({ ...stapled, verdict: "fits" })).not.toContain("Staples");
  });

  it.each([
    ["about a tenth", "About a tenth of September's pie was left."],
    ["all", "September's whole pie was left."],
    ["nothing", "September's pie was all eaten."],
  ])("describes %s left of a past month", (words, sentence) => {
    expect(describePastLeftover(words, "September")).toBe(sentence);
  });

  describe("pace", () => {
    const slice = (name: string, pace: Pace, ahead: number): SliceView => ({
      id: name,
      name,
      from: 0,
      to: 1,
      left: 0.5,
      leftWords: "about half",
      pace,
      eatenWords: "about half",
      ahead,
    });

    const paced = (gone: number, slices: SliceView[]): PieView => ({
      currency: "EUR",
      month: "2026-10",
      monthName: "October",
      leftoverWords: "about half",
      slices,
      bites: [],
      staples: [],
      gone,
      goneWords: gone < 0.04 ? "a crumb" : "about a third",
    });

    it("says nothing for a month that is over or barely begun", () => {
      const { gone: _gone, goneWords: _goneWords, ...over } = paced(0.5, []);

      expect(describePace(over)).toBeNull();
      expect(describePace(paced(0.03, [slice("Wants", "fast", 0.5)]))).toBeNull();
    });

    it("says every slice is on pace when none is fast", () => {
      expect(describePace(paced(0.33, [slice("Wants", "slow", -0.2)]))).toBe(
        "Every slice is on pace.",
      );
    });

    it("names the one fast slice", () => {
      expect(describePace(paced(0.33, [slice("Wants", "fast", 0.17)]))).toBe(
        "Wants is going fast: about half eaten, about a third of the month gone.",
      );
    });

    it("names the slice furthest ahead first, then the others", () => {
      expect(
        describePace(
          paced(0.33, [
            slice("Needs", "fast", 0.15),
            slice("Wants", "fast", 0.4),
            slice("Savings", "fast", 0.2),
          ]),
        ),
      ).toBe(
        "Wants is going fast: about half eaten, about a third of the month gone, and Needs and Savings too.",
      );
    });
  });

  it("answers stocking and dropping a staple", () => {
    const rent = {
      id: "rent",
      sliceId: "needs",
      note: "Rent",
      sliceName: "Needs",
      portionWords: "about two thirds",
      amount: "650.00",
      stockedThisMonth: false,
    };

    expect(describeStaple(rent)).toBe("Added. Rent takes about two thirds of Needs every month.");
    expect(describeDropped({ ...rent, endsAfter: "October" })).toBe(
      "Stopped. Rent ends after October.",
    );
    expect(describeDropped(rent)).toBe("Removed. Rent no longer counts.");
  });

  it("describes a month on the shelf", () => {
    expect(
      describeShelfMonth({
        month: "2026-09",
        label: "Sep",
        name: "September",
        slices: [],
        leftoverWords: "about a tenth",
        current: false,
      }),
    ).toBe("September: about a tenth left");
  });

  describe("appetite", () => {
    const usual = (sliceName: string, ratio: number, streak?: "overflowing" | "leftover") => ({
      sliceName,
      usual: ratio,
      usualWords: "about three quarters",
      ...(streak && { streak }),
    });

    it("tells the slice whose usual is furthest from all of it", () => {
      expect(
        describeAppetite([usual("Needs", 0.75), usual("Wants", 0.6), usual("Savings", 0.95)]),
      ).toEqual([{ sentence: "You usually eat about three quarters of Wants." }]);
    });

    it("keeps slice order on ties", () => {
      expect(describeAppetite([usual("Needs", 0.8), usual("Wants", 1.2)])[0]?.sentence).toContain(
        "Needs",
      );
    });

    it("puts streaks first and stops at two sentences", () => {
      expect(
        describeAppetite([
          usual("Needs", 0.7),
          usual("Wants", 1.2, "overflowing"),
          usual("Savings", 0.1, "leftover"),
        ]),
      ).toEqual([
        { sentence: "Wants has overflowed three months running.", streak: "overflowing" },
        { sentence: "Savings usually has more than half left.", streak: "leftover" },
      ]);
    });

    it("says a slice is left untouched rather than eaten by nothing", () => {
      expect(describeAppetite([{ ...usual("Wants", 0), usualWords: "nothing" }])).toEqual([
        { sentence: "You usually leave Wants untouched." },
      ]);
    });

    it("says nothing without a habit", () => {
      expect(describeAppetite([])).toEqual([]);
    });
  });
});
