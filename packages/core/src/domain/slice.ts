import type { Proportion } from "./proportion";

/** A named share of the pie, e.g. "Needs" taking half of it. */
export interface Slice {
  readonly id: string;
  readonly name: string;
  readonly share: Proportion;
  /** Removed from the pie: it keeps its past bites but takes no share. */
  readonly retired?: boolean;
}

/** Longest name a slice can have. */
export const sliceNameLimit = 30;
