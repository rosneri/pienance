import type { Money } from "./money";
import type { SpreadPart } from "./spread";

/** An expense: a bite taken out of one slice of the pie. */
export interface Bite {
  readonly id: string;
  readonly sliceId: string;
  readonly amount: Money;
  readonly note: string;
  readonly eatenAt: Date;
  /** One of the equal monthly parts of a spread expense. */
  readonly spread?: SpreadPart;
}
