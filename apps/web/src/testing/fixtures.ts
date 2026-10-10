import type { PieView } from "@pienance/core";

export const pieView: PieView = {
  currency: "EUR",
  leftoverWords: "about half",
  slices: [
    { id: "needs", name: "Needs", from: 0, to: 0.5, left: 1, leftWords: "all" },
    { id: "wants", name: "Wants", from: 0.5, to: 0.8, left: 0.25, leftWords: "about a quarter" },
    { id: "savings", name: "Savings", from: 0.8, to: 1, left: 1, leftWords: "all" },
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
};
