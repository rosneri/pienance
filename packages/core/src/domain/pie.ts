import type { Bite } from "./bite";
import { Money } from "./money";
import { Proportion } from "./proportion";
import type { Slice } from "./slice";
import type { Verdict, Weighing } from "./weighing";

/** Below this much of a slice left, a bite is considered tight. */
const tightThreshold = Proportion.of(0.1);

export interface Serving {
  readonly slice: Slice;
  readonly eaten: Proportion;
  readonly left: Proportion;
}

export interface BiteCandidate {
  readonly sliceId: string;
  readonly amount: Money;
}

export class PieError extends Error {
  override readonly name = "PieError";
}

/**
 * The aggregate root: the monthly income (the pie), cut into slices,
 * with the bites eaten from it during one month.
 */
export class Pie {
  private constructor(
    readonly id: string,
    readonly income: Money,
    readonly slices: readonly Slice[],
    private readonly eaten: Bite[],
  ) {}

  static bake(props: {
    id: string;
    income: Money;
    slices: readonly Slice[];
    bites?: readonly Bite[];
  }): Pie {
    if (props.slices.length === 0) throw new PieError("A pie needs at least one slice");
    const totalShare = props.slices.reduce((sum, slice) => sum + slice.share.ratio, 0);

    if (Math.abs(totalShare - 1) > 0.001) {
      throw new PieError(
        `Slices must add up to the whole pie, got ${Math.round(totalShare * 100)}%`,
      );
    }

    const pie = new Pie(props.id, props.income, props.slices, []);

    for (const bite of props.bites ?? []) pie.take(bite);

    return pie;
  }

  get bites(): readonly Bite[] {
    return this.eaten;
  }

  slice(sliceId: string): Slice {
    const slice = this.slices.find((candidate) => candidate.id === sliceId);

    if (!slice) throw new PieError(`No slice ${sliceId} in this pie`);

    return slice;
  }

  /** Considers a bite without taking it. */
  weigh(candidate: BiteCandidate): Weighing {
    const slice = this.slice(candidate.sliceId);
    const size = this.sizeOf(slice);
    const leftover = size.minus(this.eatenFrom(slice));
    const leftAfter = leftover.minus(candidate.amount);

    return {
      slice,
      ofSlice: candidate.amount.proportionOf(size),
      ofPie: candidate.amount.proportionOf(this.income),
      ofLeftover: candidate.amount.proportionOf(leftover),
      leftAfter: leftAfter.proportionOf(size),
      verdict: verdictFor(candidate.amount, leftover, leftAfter.proportionOf(size)),
    };
  }

  take(bite: Bite): void {
    this.slice(bite.sliceId);
    this.eaten.push(bite);
  }

  /** How much of its slice a bite took. */
  portionOf(bite: Bite): Proportion {
    return bite.amount.proportionOf(this.sizeOf(this.slice(bite.sliceId)));
  }

  servings(): Serving[] {
    return this.slices.map((slice) => {
      const eaten = this.eatenFrom(slice).proportionOf(this.sizeOf(slice));

      return { slice, eaten, left: eaten.complement() };
    });
  }

  /** How much of the whole pie is still left. */
  leftover(): Proportion {
    return Money.sum(this.eaten.map((bite) => bite.amount))
      .proportionOf(this.income)
      .complement();
  }

  private sizeOf(slice: Slice): Money {
    return this.income.times(slice.share);
  }

  private eatenFrom(slice: Slice): Money {
    return Money.sum(
      this.eaten.flatMap((bite) => (bite.sliceId === slice.id ? [bite.amount] : [])),
    );
  }
}

function verdictFor(amount: Money, leftover: Money, leftAfter: Proportion): Verdict {
  if (amount.cents > leftover.cents) return "overflows";

  return leftAfter.isLessThan(tightThreshold) ? "tight" : "fits";
}
