import type { PieView } from "@pienance/core";

/** October, a third of the way in: Wants is going fast, Needs pays the rent. */
export const pieView: PieView = {
  currency: "EUR",
  month: "2026-10",
  monthName: "October",
  leftoverWords: "about half",
  slices: [
    {
      id: "needs",
      name: "Needs",
      from: 0,
      to: 0.5,
      left: 0.4,
      leftWords: "about a third",
      stapledWords: "about half",
      pace: "steady",
      eatenWords: "about two thirds",
      ahead: 0.05,
    },
    {
      id: "wants",
      name: "Wants",
      from: 0.5,
      to: 0.8,
      left: 0.25,
      leftWords: "about a quarter",
      pace: "fast",
      eatenWords: "about three quarters",
      ahead: 0.42,
    },
    {
      id: "savings",
      name: "Savings",
      from: 0.8,
      to: 1,
      left: 1,
      leftWords: "all",
      pace: "slow",
      eatenWords: "nothing",
      ahead: -0.33,
    },
  ],
  bites: [
    {
      id: "shoes",
      note: "Shoes",
      sliceName: "Wants",
      portionWords: "about three quarters",
      eatenAt: "2026-10-03T10:00:00.000Z",
    },
    {
      id: "nameless",
      note: "",
      sliceName: "Needs",
      portionWords: "a crumb",
      eatenAt: "2026-10-02T10:00:00.000Z",
    },
  ],
  staples: [
    {
      id: "rent",
      sliceId: "needs",
      note: "Rent",
      sliceName: "Needs",
      portionWords: "about half",
      amount: "1000.00",
      stockedThisMonth: false,
    },
    {
      id: "gym",
      sliceId: "wants",
      note: "Gym",
      sliceName: "Wants",
      portionWords: "a sliver",
      amount: "30.00",
      stockedThisMonth: false,
      endsAfter: "October",
    },
  ],
  gone: 1 / 3,
  goneWords: "about a third",
};

const { gone: _gone, goneWords: _goneWords, ...over } = pieView;

/** The same pie as a past month: no pace. */
export const pastPieView: PieView = {
  ...over,
  month: "2026-09",
  monthName: "September",
  slices: pieView.slices.map(
    ({ pace: _pace, eatenWords: _words, ahead: _ahead, ...slice }) => slice,
  ),
};
