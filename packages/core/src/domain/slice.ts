import type { Proportion } from "./proportion";

/** A named share of the pie, e.g. "Needs" taking half of it. */
export interface Slice {
  readonly id: string;
  readonly name: string;
  readonly share: Proportion;
}
