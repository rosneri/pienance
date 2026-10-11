import { Proportion } from "./proportion";

/** How much of a slice is usually eaten by the end of a month. */
export interface Appetite {
  readonly usual: Proportion;
  /** Every month overflowed, or every month left more than half. */
  readonly streak?: "overflowing" | "leftover";
}

/** Below three months there is no habit, only noise. */
const monthsNeeded = 3;

const half = Proportion.of(0.5);

/** From how much of a slice each past month ate; null with fewer than three months. */
export function appetiteOf(eaten: readonly Proportion[]): Appetite | null {
  if (eaten.length < monthsNeeded) return null;

  const sorted = eaten.toSorted((a, b) => a.ratio - b.ratio);
  const usual = sorted[Math.floor(sorted.length / 2)] ?? Proportion.none;

  if (eaten.every((month) => !month.isLessThan(Proportion.whole))) {
    return { usual, streak: "overflowing" };
  }

  if (eaten.every((month) => month.isLessThan(half))) return { usual, streak: "leftover" };

  return { usual };
}
