import type { Proportion } from "./proportion";
import type { Slice } from "./slice";

/**
 * - fits: plenty of the slice is left after the bite
 * - tight: the bite fits, but leaves only crumbs
 * - overflows: the bite is bigger than what is left of the slice
 */
export type Verdict = "fits" | "tight" | "overflows";

/** The answer to "is this expense worth it?", expressed in proportions. */
export interface Weighing {
  readonly slice: Slice;
  /** How much of the whole slice the bite is. */
  readonly ofSlice: Proportion;
  /** How much of the whole pie the bite is. */
  readonly ofPie: Proportion;
  /** How much of what is still left of the slice the bite would eat. */
  readonly ofLeftover: Proportion;
  /** What would be left of the slice afterwards. */
  readonly leftAfter: Proportion;
  /** How much of the slice its staples already take. */
  readonly stapled: Proportion;
  readonly verdict: Verdict;
  /** Weighed as a spread: this weighing is this month's part, `whole` the full amount now. */
  readonly spread?: { readonly months: number; readonly whole: Weighing };
  /** The fewest months over which this month's part would fit, when the whole is too big. */
  readonly fitsOver?: number;
}
