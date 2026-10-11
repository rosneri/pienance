import type { Bite } from "./bite";
import type { Currency } from "./currency";
import { Money } from "./money";
import type { Month } from "./month";
import { Proportion } from "./proportion";
import type { Slice } from "./slice";
import { isVoid, type Staple } from "./staple";
import type { Verdict, Weighing } from "./weighing";

/** Below this much of a slice left, a bite is considered tight. */
const tightThreshold = Proportion.of(0.1);

export interface Serving {
  readonly slice: Slice;
  readonly eaten: Proportion;
  readonly left: Proportion;
  /** How much of the slice its staples take. Already part of `eaten`. */
  readonly stapled: Proportion;
}

/** Anything eaten from the pie: a bite taken once, or a staple that comes back every month. */
export type Food =
  | { readonly kind: "bite"; readonly item: Bite }
  | { readonly kind: "staple"; readonly item: Staple };

export interface BiteCandidate {
  readonly sliceId: string;
  readonly amount: Money;
}

export class PieError extends Error {
  override readonly name = "PieError";
}

/**
 * The aggregate root: one person's monthly income (the pie), cut into slices,
 * with the bites eaten from it during one month and the staples that month counts.
 */
export class Pie {
  private readonly sizes: ReadonlyMap<string, Money>;

  private constructor(
    readonly id: string,
    /** Who the pie belongs to: an id from the identity provider. */
    readonly ownerId: string,
    readonly income: Money,
    readonly slices: readonly Slice[],
    /** When the pie was first baked: no month before this one is on its shelf. */
    readonly bakedAt: Date,
    private readonly eaten: Bite[],
    private readonly pantry: Staple[],
  ) {
    const parts = income.split(slices.map((slice) => slice.share));

    this.sizes = new Map(
      slices.map((slice, index) => [slice.id, parts[index] ?? Money.zero(income.currency)]),
    );
  }

  static bake(props: {
    id: string;
    ownerId: string;
    income: Money;
    slices: readonly Slice[];
    bakedAt: Date;
    bites?: readonly Bite[];
    /** The staples active in the served month: the pie counts every one it holds. */
    staples?: readonly Staple[];
  }): Pie {
    if (props.slices.length === 0) throw new PieError("A pie needs at least one slice");
    const totalShare = props.slices.reduce((sum, slice) => sum + slice.share.ratio, 0);

    if (Math.abs(totalShare - 1) > 0.001) {
      throw new PieError(
        `Slices must add up to the whole pie, got ${Math.round(totalShare * 100)}%`,
      );
    }

    const pie = new Pie(props.id, props.ownerId, props.income, props.slices, props.bakedAt, [], []);

    for (const bite of props.bites ?? []) pie.take(bite);

    for (const staple of props.staples ?? []) pie.stock(staple);

    return pie;
  }

  get currency(): Currency {
    return this.income.currency;
  }

  get bites(): readonly Bite[] {
    return this.eaten;
  }

  get staples(): readonly Staple[] {
    return this.pantry;
  }

  slice(sliceId: string): Slice {
    const slice = this.slices.find((candidate) => candidate.id === sliceId);

    if (!slice) throw new PieError(`No slice ${sliceId} in this pie`);

    return slice;
  }

  /** Considers a bite without taking it. */
  weigh(candidate: BiteCandidate): Weighing {
    this.assertInCurrency(candidate.amount);

    const slice = this.slice(candidate.sliceId);
    const size = this.sizeOf(slice);
    const leftover = size.minus(this.eatenFrom(slice));
    const leftAfter = leftover.minus(candidate.amount);

    return {
      slice,
      stapled: this.stapledFrom(slice).proportionOf(size),
      ofSlice: candidate.amount.proportionOf(size),
      ofPie: candidate.amount.proportionOf(this.income),
      ofLeftover: candidate.amount.proportionOf(leftover),
      leftAfter: leftAfter.proportionOf(size),
      verdict: verdictFor(candidate.amount, leftover, leftAfter.proportionOf(size)),
    };
  }

  take(bite: Bite): void {
    this.assertInCurrency(bite.amount);
    this.slice(bite.sliceId);
    this.eaten.push(bite);
  }

  /** Adds a staple to the pantry. */
  stock(staple: Staple): void {
    this.assertInCurrency(staple.amount);
    this.slice(staple.sliceId);

    if (!staple.amount.isMoreThan(Money.zero(this.currency))) {
      throw new PieError("A staple needs an amount above zero");
    }

    this.pantry.push(staple);
  }

  /**
   * Stops a staple: `month` still counts it, since it is likely paid already. Dropped in
   * the month it was stocked, it never counted, so a mistake is one tap to undo.
   */
  drop(stapleId: string, month: Month): Staple {
    const staple = this.stapleOf(stapleId);

    if (staple.until) throw new PieError("That staple is already stopped");

    return this.restock({
      ...staple,
      until: staple.since.equals(month) ? staple.since : month.next(),
    });
  }

  /** Changes a staple's amount: the old one stops where the new one starts, so past months keep theirs. */
  replace(stapleId: string, staple: Staple): void {
    const old = this.stapleOf(stapleId);

    if (old.until) throw new PieError("That staple is already stopped");

    this.stock(staple);
    this.restock({ ...old, until: staple.since.isAfter(old.since) ? staple.since : old.since });
  }

  /** How much of its slice a bite took. */
  portionOf(bite: Bite): Proportion {
    return bite.amount.proportionOf(this.sizeOf(this.slice(bite.sliceId)));
  }

  /** How much of its slice a staple takes each month. */
  portionOfStaple(staple: Staple): Proportion {
    return staple.amount.proportionOf(this.sizeOf(this.slice(staple.sliceId)));
  }

  servings(): Serving[] {
    return this.slices.map((slice) => {
      const size = this.sizeOf(slice);
      const eaten = this.eatenFrom(slice).proportionOf(size);

      return {
        slice,
        eaten,
        left: eaten.complement(),
        stapled: this.stapledFrom(slice).proportionOf(size),
      };
    });
  }

  /** How much of the whole pie is still left. */
  leftover(): Proportion {
    return Money.sum(
      [...this.eaten, ...this.counted()].map((food) => food.amount),
      this.currency,
    )
      .proportionOf(this.income)
      .complement();
  }

  /** Everything eaten from the pie this month: its bites and the staples it counts. */
  food(): Food[] {
    return [
      ...this.eaten.map((bite): Food => ({ kind: "bite", item: bite })),
      ...this.counted().map((staple): Food => ({ kind: "staple", item: staple })),
    ];
  }

  /** How much money a slice holds. */
  sizeOf(slice: Slice): Money {
    return this.sizes.get(slice.id) ?? Money.zero(this.currency);
  }

  private eatenFrom(slice: Slice): Money {
    return Money.sum(
      this.eaten.flatMap((bite) => (bite.sliceId === slice.id ? [bite.amount] : [])),
      this.currency,
    ).plus(this.stapledFrom(slice));
  }

  private stapledFrom(slice: Slice): Money {
    return Money.sum(
      this.counted().flatMap((staple) => (staple.sliceId === slice.id ? [staple.amount] : [])),
      this.currency,
    );
  }

  /** Every staple held, except one dropped in the month it was stocked. */
  private counted(): Staple[] {
    return this.pantry.filter((staple) => !isVoid(staple));
  }

  private stapleOf(stapleId: string): Staple {
    const staple = this.pantry.find((candidate) => candidate.id === stapleId);

    if (!staple) throw new PieError(`No staple ${stapleId} in this pie`);

    return staple;
  }

  private restock(staple: Staple): Staple {
    const index = this.pantry.findIndex((candidate) => candidate.id === staple.id);

    this.pantry[index] = staple;

    return staple;
  }

  private assertInCurrency(amount: Money): void {
    if (!amount.isIn(this.currency)) {
      throw new PieError(`This pie is in ${this.currency.code}, not ${amount.currency.code}`);
    }
  }
}

function verdictFor(amount: Money, leftover: Money, leftAfter: Proportion): Verdict {
  if (amount.isMoreThan(leftover)) return "overflows";

  return leftAfter.isLessThan(tightThreshold) ? "tight" : "fits";
}
