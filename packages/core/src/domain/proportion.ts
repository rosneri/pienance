/**
 * A part of a whole, kept as a plain ratio (0.25 = a quarter).
 * Can exceed 1 when something is bigger than the whole it is compared to.
 */
export class Proportion {
  private constructor(readonly ratio: number) {}

  static readonly none = new Proportion(0);
  static readonly whole = new Proportion(1);

  static of(ratio: number): Proportion {
    if (Number.isNaN(ratio) || ratio < 0) {
      throw new RangeError(`A proportion must be a non-negative number, got ${ratio}`);
    }

    return new Proportion(ratio);
  }

  /** How much of `whole` the `part` is. A part of nothing is the whole of it. */
  static between(part: number, whole: number): Proportion {
    if (whole <= 0) return part > 0 ? Proportion.of(Number.POSITIVE_INFINITY) : Proportion.none;

    return Proportion.of(Math.max(part, 0) / whole);
  }

  get percent(): number {
    return Math.round(this.ratio * 100);
  }

  complement(): Proportion {
    return Proportion.of(Math.max(1 - this.ratio, 0));
  }

  isMoreThan(other: Proportion): boolean {
    return this.ratio > other.ratio;
  }

  isLessThan(other: Proportion): boolean {
    return this.ratio < other.ratio;
  }
}
