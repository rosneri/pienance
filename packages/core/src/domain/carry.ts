import type { Money } from "./money";

/** Last month's leftover, added to one slice of this month's pie. The month is the pie's. */
export interface Carry {
  readonly sliceId: string;
  readonly amount: Money;
}
