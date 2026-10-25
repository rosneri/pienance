import { describe, expect, it } from "vitest";
import { Proportion, type Pace } from "../domain";
import type { PieView, SliceView } from "./pie-view";
import {
  describeAppetite,
  describeCarried,
  describeCarry,
  describeCarryOffer,
  describeDropped,
  describeFocus,
  describeLeftover,
  describeMoved,
  describePace,
  describePastLeftover,
  describeReslice,
  describeShelfMonth,
  describeSlice,
  describeSweep,
  describeSwept,
  describeStaple,
  describeTaken,
  describeVerdict,
  describeWeighing,
} from "./sentences";

const weighing = {
  sliceName: "Wants",
  portion: "1/5",
  ofSlice: "about a fifth",
  ofLeftover: "about a quarter",
  ofPie: "about a tenth",
  leftAfter: "about half",
  stapled: "nothing",
} as const;

/** A pie view with nothing in it but what a test gives. */
const pieViewFor = (view: Pick<PieView, "swept"> & Partial<PieView>): PieView => ({
  currency: "EUR",
  month: "2026-10",
  monthName: "October",
  leftoverWords: "all",
  slices: [],
  bites: [],
  staples: [],
  focuses: [],
  ...view,
});

describe("sentences", () => {
  it("offers, carries and tells a carry", () => {
    expect(
      describeCarryOffer({
        month: "2026-09",
        monthName: "September",
        leftoverWords: "about a fifth",
      }),
    ).toBe("September left about a fifth of your pie.");
    expect(describeCarried("Savings")).toBe("Carried into Savings. It is bigger this month.");
    expect(describeCarry({ sliceId: "savings", sliceName: "Savings", from: "September" })).toBe(
      "Savings holds September's leftover.",
    );
  });

  it("previews a re-slice by the first slice it would eat up", () => {
    const serving = (name: string, left: number, retired = false) => ({
      slice: { id: name, name, share: Proportion.none },
      ofPie: Proportion.none,
      retired,
      eaten: Proportion.of(1 - left),
      left: Proportion.of(left),
      stapled: Proportion.none,
    });

    expect(describeReslice([serving("Needs", 0.5), serving("Old", 0, true)])).toEqual({
      verdict: "fits",
      sentence: "Every slice still fits.",
    });
    expect(describeReslice([serving("Needs", 0.5), serving("Wants", 0)])).toEqual({
      verdict: "overflows",
      sentence: "Wants would be all eaten.",
    });
  });

  it("tells the sweep, and what this month swept", () => {
    const view = { swept: [{ sliceName: "Savings", words: "a sliver" }] } as const;

    expect(describeSwept(pieViewFor(view))).toBe("Swept this month: a sliver of Savings.");
    expect(describeSwept(pieViewFor({ swept: [] }))).toBeNull();
    expect(
      describeSweep(
        pieViewFor({ swept: [], sweep: { sliceId: "s", sliceName: "Savings", step: "1.00" } }),
      ),
    ).toBe("Bites now round up to the next 1.00 into Savings.");
    expect(describeSweep(pieViewFor({ swept: [] }))).toBe("The sweep is off. Past sweeps stay.");
  });

  it("restates a bite after taking or moving it", () => {
    const bite = {
      id: "shoes",
      sliceId: "needs",
      note: "Shoes",
      sliceName: "Needs",
      portion: "1/10",
      portionWords: "about a tenth",
      eatenAt: "2026-10-03T10:00:00.000Z",
    };

    expect(describeTaken(bite)).toBe("Taken. About a tenth of Needs.");
    expect(describeMoved(bite)).toBe("Moved. It is about a tenth of Needs.");
  });

  it.each([
    ["about half", "About half of your pie is left."],
    ["all", "Your whole pie is left."],
    ["nothing", "Your pie is all eaten."],
  ])("describes %s left", (words, sentence) => {
    expect(describeLeftover(words)).toBe(sentence);
  });

  it("compares a spread with taking it all now", () => {
    const spread = {
      ...weighing,
      verdict: "fits",
      spread: { months: 6, wholeVerdict: "overflows" },
    } as const;

    expect(describeWeighing(spread)).toBe(
      "Too big now. Spread over 6 months it is about a fifth of Wants each month, and fits.",
    );
    expect(describeVerdict(spread)).toBe(
      "Too big now. Over 6 months it fits and leaves about half of Wants.",
    );
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

  it("gives the verdict alone, for a bite being typed", () => {
    expect(describeVerdict({ ...weighing, verdict: "fits" })).toBe(
      "Fits: leaves about half of Wants.",
    );
    expect(describeVerdict({ ...weighing, verdict: "tight", stapled: "about half" })).toBe(
      "Tight: it takes about a quarter of what is left of Wants. Staples already take about half of it.",
    );
    expect(describeVerdict({ ...weighing, verdict: "overflows" })).toBe(
      "Too big: more than what is left of Wants.",
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
      retired: false,
      from: 0,
      to: 1,
      left: 0.5,
      leftWords: "about half",
      stapled: 0,
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
      focuses: [],
      swept: [],
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

    it("says a slice with staples is paced after them", () => {
      expect(
        describePace(paced(0.33, [{ ...slice("Needs", "fast", 0.2), stapledWords: "about half" }])),
      ).toBe(
        "Needs is going fast: about half eaten after staples, about a third of the month gone.",
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

  describe("one slice", () => {
    const wants = (pace: Pace): SliceView => ({
      id: "wants",
      name: "Wants",
      retired: false,
      from: 0,
      to: 1,
      left: 0.5,
      leftWords: "about half",
      stapled: 0,
      pace,
    });

    const october: PieView = {
      currency: "EUR",
      month: "2026-10",
      monthName: "October",
      leftoverWords: "about half",
      slices: [],
      bites: [],
      staples: [],
      focuses: [],
      swept: [],
      gone: 1 / 3,
      goneWords: "about a third",
    };

    it.each([
      ["fast", "Wants is going fast"],
      ["steady", "Wants is on pace"],
      ["slow", "Wants is going slowly"],
    ] as const)("tells a %s slice against the month still to go", (pace, opening) => {
      expect(describeSlice(wants(pace), october)).toBe(
        `${opening}: about half of it is left, with about two thirds of October to go.`,
      );
    });

    it("adds what staples take", () => {
      expect(
        describeSlice(
          { ...wants("steady"), stapledWords: "about a third", eatenWords: "about a third" },
          october,
        ),
      ).toContain(
        "Staples take about a third of it, so pace counts only the rest: about a third of it eaten.",
      );
    });

    it("tells a month that is over in the past tense", () => {
      const {
        gone: _gone,
        goneWords: _words,
        ...september
      } = {
        ...october,
        monthName: "September",
      };

      expect(describeSlice(wants("fast"), september)).toBe(
        "About half of Wants was left in September.",
      );
    });
  });

  describe("a focus", () => {
    const recurrence = (key: string, biteIds: string[], stapleIds: string[]) => ({
      key,
      kind: "recurrence" as const,
      name: "Every month",
      eatenWords: "about a third",
      leftWords: "about two thirds",
      ofPieWords: "about a third",
      biteIds,
      stapleIds,
    });

    const october: PieView = {
      currency: "EUR",
      month: "2026-10",
      monthName: "October",
      leftoverWords: "about half",
      slices: [
        {
          id: "wants",
          name: "Wants",
          retired: false,
          from: 0,
          to: 1,
          left: 0.5,
          leftWords: "about half",
          stapled: 0,
          pace: "fast",
        },
      ],
      bites: [],
      staples: [],
      focuses: [],
      swept: [],
      gone: 1 / 3,
      goneWords: "about a third",
    };

    it("tells a slice by its pace", () => {
      expect(
        describeFocus(
          { ...recurrence("slice:wants", [], []), kind: "slice", sliceId: "wants", name: "Wants" },
          october,
        ),
      ).toMatch(/^Wants is going fast/);
    });

    it("tells what comes back every month", () => {
      expect(describeFocus(recurrence("recurrence:every-month", [], ["rent"]), october)).toBe(
        "Every month, one staple takes about a third of your pie.",
      );
      expect(describeFocus(recurrence("recurrence:every-month", [], ["a", "b"]), october)).toBe(
        "Every month, 2 staples take about a third of your pie.",
      );
      expect(describeFocus(recurrence("recurrence:every-month", [], []), october)).toBe(
        "Nothing comes back every month yet.",
      );
    });

    it("tells what was eaten once, now or in a month that is over", () => {
      const {
        gone: _gone,
        goneWords: _words,
        ...september
      } = { ...october, monthName: "September" };

      expect(describeFocus(recurrence("recurrence:one-time", ["a", "b"], []), october)).toBe(
        "2 bites taken once this month ate about a third of your pie.",
      );
      expect(describeFocus(recurrence("recurrence:one-time", ["a"], []), september)).toBe(
        "One bite taken once in September ate about a third of your pie.",
      );
      expect(describeFocus(recurrence("recurrence:one-time", [], []), september)).toBe(
        "Nothing was eaten once in September.",
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
