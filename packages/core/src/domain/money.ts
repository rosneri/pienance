import {
  add,
  allocate,
  dinero,
  greaterThan,
  halfEven,
  subtract,
  toDecimal,
  toSnapshot,
  transformScale,
  type Dinero,
} from "dinero.js";
import type { Currency } from "./currency";
import { Proportion } from "./proportion";

const decimalPattern = /^\d+(?:[.,]\d+)?$/;

/**
 * An amount of money in one currency. Arithmetic, rounding and splitting are
 * delegated to Dinero.js; this class only speaks the domain's language.
 */
export class Money {
  private constructor(private readonly value: Dinero<number>) {}

  static zero(currency: Currency): Money {
    return Money.ofMinor(0, currency);
  }

  /** From minor units (cents, yen, fils…), as stored. */
  static ofMinor(amount: number, currency: Currency): Money {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new RangeError(`An amount must be zero or more, got ${amount}`);
    }

    return new Money(dinero({ amount, currency }));
  }

  /** From what a person types: "12", "12.5" or "12,50". Rounded to the currency's minor unit. */
  static parse(decimal: string, currency: Currency): Money {
    const text = decimal.trim();

    if (!decimalPattern.test(text)) {
      throw new RangeError(`"${decimal}" is not an amount of money`);
    }

    const [whole = "", fraction = ""] = text.split(/[.,]/);
    const amount = Number(whole + fraction);

    if (!Number.isSafeInteger(amount)) throw new RangeError(`"${decimal}" is too large`);

    const exact = dinero({ amount, currency, scale: fraction.length });

    return new Money(transformScale(exact, currency.exponent, halfEven));
  }

  static sum(amounts: Iterable<Money>, currency: Currency): Money {
    let total = Money.zero(currency);

    for (const amount of amounts) total = total.plus(amount);

    return total;
  }

  get currency(): Currency {
    return toSnapshot(this.value).currency;
  }

  /** The amount in the currency's minor units. */
  get minor(): number {
    return toSnapshot(this.value).amount;
  }

  toDecimal(): string {
    return toDecimal(this.value);
  }

  isIn(currency: Currency): boolean {
    return this.currency.code === currency.code;
  }

  plus(other: Money): Money {
    this.assertSameCurrency(other);

    return new Money(add(this.value, other.value));
  }

  /** Never goes below zero: an overspent slice simply has nothing left. */
  minus(other: Money): Money {
    this.assertSameCurrency(other);

    if (greaterThan(other.value, this.value)) return Money.zero(this.currency);

    return new Money(subtract(this.value, other.value));
  }

  isMoreThan(other: Money): boolean {
    this.assertSameCurrency(other);

    return greaterThan(this.value, other.value);
  }

  proportionOf(whole: Money): Proportion {
    this.assertSameCurrency(whole);

    return Proportion.between(this.minor, whole.minor);
  }

  /** Rounded up to the next whole step: 4.30 to the next 1 is 5.00. A whole step stays. */
  roundUpTo(step: Money): Money {
    this.assertSameCurrency(step);

    if (step.minor <= 0) throw new RangeError("A step needs to be above zero");

    return Money.ofMinor(Math.ceil(this.minor / step.minor) * step.minor, this.currency);
  }

  /** Splits without losing a single minor unit, in the given proportions. */
  split(shares: readonly Proportion[]): Money[] {
    // Integer weights keep the parts in the currency's own scale.
    const ratios = shares.map((share) => Math.round(share.ratio * 1_000_000));

    return allocate(this.value, ratios).map((part) => new Money(part));
  }

  private assertSameCurrency(other: Money): void {
    if (!other.isIn(this.currency)) {
      throw new RangeError(`Cannot mix ${this.currency.code} with ${other.currency.code}`);
    }
  }
}
