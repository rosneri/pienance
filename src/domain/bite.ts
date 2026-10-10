import type { Money } from "./money";

/** An expense: a bite taken out of one slice of the pie. */
export interface Bite {
  readonly id: string;
  readonly sliceId: string;
  readonly amount: Money;
  readonly note: string;
  readonly eatenAt: Date;
}
