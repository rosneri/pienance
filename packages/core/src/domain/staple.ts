import type { Money } from "./money";
import type { Month } from "./month";

/** A bite that comes back every month, e.g. rent from Needs. All of a pie's staples are its pantry. */
export interface Staple {
  readonly id: string;
  readonly sliceId: string;
  readonly amount: Money;
  readonly note: string;
  /** The first month it counts in. */
  readonly since: Month;
  /** The first month it no longer counts in; absent while it keeps coming back. */
  readonly until?: Month;
}

export function isActiveIn(staple: Staple, month: Month): boolean {
  if (staple.since.isAfter(month)) return false;

  return !staple.until || staple.until.isAfter(month);
}

/** Dropped in the month it was stocked: it never counted anywhere. */
export function isVoid(staple: Staple): boolean {
  return staple.until !== undefined && !staple.until.isAfter(staple.since);
}
