import type { Currency } from "./currency";
import { Money } from "./money";

/** Rounding bites up to a step, and counting the difference as eaten from one slice. */
export interface Sweep {
  readonly sliceId: string;
  readonly step: Money;
}

/**
 * The steps a pie offers, in its currency's major units: 1, 5 or 10, or 10, 50 or 100
 * for a currency without minor units, where a step of 1 could never sweep.
 */
export function sweepSteps(currency: Currency): readonly Money[] {
  const steps = currency.exponent === 0 ? ["10", "50", "100"] : ["1", "5", "10"];

  return steps.map((step) => Money.parse(step, currency));
}

/** What a bite of `amount` sweeps with `step`: nothing when it is on a whole step. */
export function sweptBy(amount: Money, step: Money): Money {
  return amount.roundUpTo(step).minus(amount);
}
