import { Proportion } from "./proportion";

/** An amount of money in minor units (cents) to avoid floating point drift. */
export class Money {
  private constructor(readonly cents: number) {}

  static readonly zero = new Money(0);

  static ofCents(cents: number): Money {
    if (!Number.isSafeInteger(cents) || cents < 0) {
      throw new RangeError(`Money must be a non-negative whole number of cents, got ${cents}`);
    }
    return new Money(cents);
  }

  static of(amount: number): Money {
    return Money.ofCents(Math.round(amount * 100));
  }

  plus(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  /** Never goes below zero: an overspent slice simply has nothing left. */
  minus(other: Money): Money {
    return new Money(Math.max(this.cents - other.cents, 0));
  }

  times(proportion: Proportion): Money {
    return new Money(Math.round(this.cents * proportion.ratio));
  }

  proportionOf(whole: Money): Proportion {
    return Proportion.between(this.cents, whole.cents);
  }

  static sum(amounts: Iterable<Money>): Money {
    let total = Money.zero;
    for (const amount of amounts) total = total.plus(amount);
    return total;
  }
}
