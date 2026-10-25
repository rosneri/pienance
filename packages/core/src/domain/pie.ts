import type { Bite } from "./bite";
import type { Carry } from "./carry";
import type { Currency } from "./currency";
import { Money } from "./money";
import type { Month } from "./month";
import { Proportion } from "./proportion";
import { sliceNameLimit, type Slice } from "./slice";
import { spreadMonths, spreadOver } from "./spread";
import { isVoid, type Staple } from "./staple";
import type { Verdict, Weighing } from "./weighing";

/** Below this much of a slice left, a bite is considered tight. */
const tightThreshold = Proportion.of(0.1);

export interface Serving {
  readonly slice: Slice;
  /** How much of the whole pie the slice holds: its share, plus any carry it holds. */
  readonly ofPie: Proportion;
  /** A retired slice has no size: its bites only count against the whole pie. */
  readonly retired: boolean;
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
  /** Spread over this many months, starting with this one. */
  readonly months?: number | undefined;
}

export class PieError extends Error {
  override readonly name = "PieError";
}

const unknownBite = "That bite is not in this month's pie.";

/**
 * The aggregate root: one person's monthly income (the pie), cut into slices,
 * with the bites eaten from it during one month and the staples that month counts.
 */
export class Pie {
  /** Each slice's share of the income, before any carry. */
  private readonly shares: ReadonlyMap<string, Money>;
  /** Last month's leftover, carried into one slice. */
  private carried: Carry | undefined;
  /** Whether a carry loaded with the pie was undone since. */
  private dropped = false;
  /** Bites put back since the pie was loaded, so repositories can forget them. */
  private readonly putBacks: string[] = [];
  /** Spreads put back from this month on, since the pie was loaded. */
  private readonly putBackSpreads: string[] = [];
  /** Parts of spreads dated after the served month, taken since the pie was loaded. */
  private readonly later: Bite[] = [];

  private constructor(
    readonly id: string,
    /** Who the pie belongs to: an id from the identity provider. */
    readonly ownerId: string,
    readonly income: Money,
    readonly slices: readonly Slice[],
    /** When the pie was first baked: no month before this one is on its shelf. */
    readonly bakedAt: Date,
    /** The month the pie is served for: its bites are eaten in it. */
    readonly month: Month,
    private readonly eaten: Bite[],
    private readonly pantry: Staple[],
  ) {
    const parts = income.split(slices.map((slice) => slice.share));

    this.shares = new Map(
      slices.map((slice, index) => [slice.id, parts[index] ?? Money.zero(income.currency)]),
    );
  }

  static bake(props: {
    id: string;
    ownerId: string;
    income: Money;
    slices: readonly Slice[];
    bakedAt: Date;
    month: Month;
    /** The month's bites, and any parts of spreads dated later. */
    bites?: readonly Bite[];
    /** The staples active in the served month: the pie counts every one it holds. */
    staples?: readonly Staple[];
    /** Last month's leftover, carried into this month. */
    carry?: Carry | undefined;
  }): Pie {
    if (!props.slices.some((slice) => !slice.retired)) {
      throw new PieError("A pie needs at least one slice");
    }

    if (props.slices.some((slice) => slice.retired && slice.share.ratio > 0)) {
      throw new PieError("A retired slice takes no share");
    }

    assertNames(props.slices);

    const totalShare = props.slices.reduce((sum, slice) => sum + slice.share.ratio, 0);

    if (Math.abs(totalShare - 1) > 0.001) {
      throw new PieError(
        `Slices must add up to the whole pie, got ${Math.round(totalShare * 100)}%`,
      );
    }

    const pie = new Pie(
      props.id,
      props.ownerId,
      props.income,
      props.slices,
      props.bakedAt,
      props.month,
      [],
      [],
    );

    // What was eaten stays, even from a slice retired since.
    for (const bite of props.bites ?? []) pie.hold(bite);

    for (const staple of props.staples ?? []) pie.shelve(staple);

    if (props.carry) pie.holdCarry(props.carry);

    return pie;
  }

  /**
   * The same pie with a new income or new slices; every bite and staple stays. A slice left
   * out of `slices` must already be marked retired, so its past bites keep a home.
   */
  reslice(props: { income?: Money; slices: readonly Slice[] }): Pie {
    const income = props.income ?? this.income;

    this.assertInCurrency(income);

    if (!income.isMoreThan(Money.zero(this.currency))) {
      throw new PieError("The income needs to be above zero");
    }

    for (const slice of props.slices) {
      const before = this.slices.find((candidate) => candidate.id === slice.id);

      const active = this.pantry.some(
        (staple) => staple.sliceId === slice.id && !staple.until && !isVoid(staple),
      );

      if (slice.retired && !before?.retired && active) {
        throw new PieError(`Stop ${before?.name ?? slice.name}'s staples first.`);
      }

      if (slice.retired && this.carried?.sliceId === slice.id) {
        throw new PieError("Undo the carry first.");
      }
    }

    return Pie.bake({
      id: this.id,
      ownerId: this.ownerId,
      income,
      slices: props.slices,
      bakedAt: this.bakedAt,
      month: this.month,
      bites: [...this.eaten, ...this.later],
      staples: this.pantry,
      carry: this.carried,
    });
  }

  get currency(): Currency {
    return this.income.currency;
  }

  /** The whole pie this month: the income, plus any carry. */
  get whole(): Money {
    return this.carried ? this.income.plus(this.carried.amount) : this.income;
  }

  /** Last month's leftover, when it was carried into this month. */
  get carry(): Carry | undefined {
    return this.carried;
  }

  /** Whether a carry loaded with the pie was undone, so repositories can forget it. */
  carryDropped(): boolean {
    return this.dropped;
  }

  /** Adds last month's leftover to one live slice, once a month. */
  carryOver(carry: Carry): void {
    if (this.carried) throw new PieError("Already carried this month.");

    this.liveSlice(carry.sliceId);
    this.holdCarry(carry);
  }

  /** Undoes this month's carry. */
  dropCarry(): void {
    if (!this.carried) throw new PieError("Nothing was carried this month.");

    this.carried = undefined;
    this.dropped = true;
  }

  /** What is left of the whole pie in money, never below zero: what a next month can carry. */
  leftoverMoney(): Money {
    return this.whole.minus(
      Money.sum(
        [...this.eaten, ...this.counted()].map((food) => food.amount),
        this.currency,
      ),
    );
  }

  /** The bites eaten in the served month. */
  get bites(): readonly Bite[] {
    return this.eaten;
  }

  /** Parts of spreads dated after the served month, taken since the pie was loaded. */
  get laterBites(): readonly Bite[] {
    return this.later;
  }

  get staples(): readonly Staple[] {
    return this.pantry;
  }

  /** The slices that take a share: retired ones are left out. */
  get liveSlices(): readonly Slice[] {
    return this.slices.filter((slice) => !slice.retired);
  }

  slice(sliceId: string): Slice {
    const slice = this.slices.find((candidate) => candidate.id === sliceId);

    if (!slice) throw new PieError(`No slice ${sliceId} in this pie`);

    return slice;
  }

  /** Considers a bite without taking it; spread, this month's part is what is weighed. */
  weigh(candidate: BiteCandidate): Weighing {
    if (candidate.months === undefined) return this.weighNow(candidate);

    const [part = candidate.amount] = spreadOver(candidate.amount, candidate.months);

    return {
      ...this.weighNow({ sliceId: candidate.sliceId, amount: part }),
      spread: { months: candidate.months, whole: this.weighNow(candidate) },
    };
  }

  /** The fewest months, up to `most`, over which this month's part fits; null if none. */
  fewestMonthsToFit(candidate: BiteCandidate, most: number = spreadMonths.most): number | null {
    for (let months = spreadMonths.fewest; months <= most; months++) {
      if (this.weigh({ ...candidate, months }).verdict !== "overflows") return months;
    }

    return null;
  }

  private weighNow(candidate: BiteCandidate): Weighing {
    this.assertInCurrency(candidate.amount);

    const slice = this.liveSlice(candidate.sliceId);
    const size = this.sizeOf(slice);
    const leftover = size.minus(this.eatenFrom(slice));
    const leftAfter = leftover.minus(candidate.amount);

    return {
      slice,
      stapled: this.stapledFrom(slice).proportionOf(size),
      ofSlice: candidate.amount.proportionOf(size),
      ofPie: candidate.amount.proportionOf(this.whole),
      ofLeftover: candidate.amount.proportionOf(leftover),
      leftAfter: leftAfter.proportionOf(size),
      verdict: verdictFor(candidate.amount, leftover, leftAfter.proportionOf(size)),
    };
  }

  /** Takes a bite of the served month, or a later part of a spread. */
  take(bite: Bite): void {
    this.liveSlice(bite.sliceId);
    this.hold(bite);
  }

  /** One of the served month's bites. */
  bite(biteId: string): Bite {
    const bite = this.eaten.find((candidate) => candidate.id === biteId);

    if (!bite) throw new PieError(unknownBite);

    return bite;
  }

  /** Removes a bite, as if it was never taken. */
  putBack(biteId: string): void {
    this.eaten.splice(this.eaten.indexOf(this.bite(biteId)), 1);
    this.putBacks.push(biteId);
  }

  /** Moves a bite into another slice; only its slice changes. */
  move(biteId: string, sliceId: string): Bite {
    const bite = this.bite(biteId);

    if (bite.sliceId === sliceId) return bite;

    this.liveSlice(sliceId);

    const moved = { ...bite, sliceId };

    this.eaten[this.eaten.indexOf(bite)] = moved;

    return moved;
  }

  /** The ids of the bites put back since the pie was loaded. */
  putBackIds(): readonly string[] {
    return this.putBacks;
  }

  /** Puts back this month's parts of a spread and every later one; earlier parts stay. */
  putBackSpread(spreadId: string): void {
    const ofSpread = (bite: Bite) => bite.spread?.id === spreadId;

    if (!this.eaten.some(ofSpread)) throw new PieError(unknownBite);

    this.eaten.splice(0, this.eaten.length, ...this.eaten.filter((bite) => !ofSpread(bite)));
    this.later.splice(0, this.later.length, ...this.later.filter((bite) => !ofSpread(bite)));
    this.putBackSpreads.push(spreadId);
  }

  /** The spreads put back from the served month on, since the pie was loaded. */
  putBackSpreadIds(): readonly string[] {
    return this.putBackSpreads;
  }

  /** Adds a staple to the pantry. */
  stock(staple: Staple): void {
    this.liveSlice(staple.sliceId);
    this.shelve(staple);
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

  /** How much of its slice a bite took; of the whole pie, for a retired slice. */
  portionOf(bite: Bite): Proportion {
    return bite.amount.proportionOf(this.wholeOf(this.slice(bite.sliceId)));
  }

  /** How much of its slice a staple takes each month; of the whole pie, for a retired slice. */
  portionOfStaple(staple: Staple): Proportion {
    return staple.amount.proportionOf(this.wholeOf(this.slice(staple.sliceId)));
  }

  /** Every live slice, and a retired one only while something was eaten from it this month. */
  servings(): Serving[] {
    return this.slices.flatMap((slice): Serving[] => {
      const eatenFrom = this.eatenFrom(slice);

      if (slice.retired) {
        if (!eatenFrom.isMoreThan(Money.zero(this.currency))) return [];

        const none = Proportion.none;

        return [{ slice, ofPie: none, retired: true, eaten: none, left: none, stapled: none }];
      }

      const size = this.sizeOf(slice);
      const eaten = eatenFrom.proportionOf(size);

      return [
        {
          slice,
          ofPie: size.proportionOf(this.whole),
          retired: false,
          eaten,
          left: eaten.complement(),
          stapled: this.stapledFrom(slice).proportionOf(size),
        },
      ];
    });
  }

  /** How much of the whole pie is still left. */
  leftover(): Proportion {
    return Money.sum(
      [...this.eaten, ...this.counted()].map((food) => food.amount),
      this.currency,
    )
      .proportionOf(this.whole)
      .complement();
  }

  /** Everything eaten from the pie this month: its bites and the staples it counts. */
  food(): Food[] {
    return [
      ...this.eaten.map((bite): Food => ({ kind: "bite", item: bite })),
      ...this.counted().map((staple): Food => ({ kind: "staple", item: staple })),
    ];
  }

  /** How much money a slice holds: its share of the income, plus any carry it holds. */
  sizeOf(slice: Slice): Money {
    const share = this.shares.get(slice.id) ?? Money.zero(this.currency);

    return this.carried?.sliceId === slice.id ? share.plus(this.carried.amount) : share;
  }

  private wholeOf(slice: Slice): Money {
    return slice.retired ? this.whole : this.sizeOf(slice);
  }

  private holdCarry(carry: Carry): void {
    this.assertInCurrency(carry.amount);
    this.slice(carry.sliceId);

    if (!carry.amount.isMoreThan(Money.zero(this.currency))) {
      throw new PieError("There is nothing to carry.");
    }

    this.carried = carry;
  }

  /** A slice that can still be eaten from. */
  private liveSlice(sliceId: string): Slice {
    const slice = this.slice(sliceId);

    if (slice.retired) throw new PieError(`${slice.name} is retired. Pick another slice.`);

    return slice;
  }

  private hold(bite: Bite): void {
    this.assertInCurrency(bite.amount);
    this.slice(bite.sliceId);

    if (bite.eatenAt < this.month.start) {
      throw new PieError("That bite belongs to an earlier month.");
    }

    (this.month.contains(bite.eatenAt) ? this.eaten : this.later).push(bite);
  }

  private shelve(staple: Staple): void {
    this.assertInCurrency(staple.amount);
    this.slice(staple.sliceId);

    if (!staple.amount.isMoreThan(Money.zero(this.currency))) {
      throw new PieError("A staple needs an amount above zero");
    }

    this.pantry.push(staple);
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

/** Names are trimmed by the caller: here they must be there, short, and told apart. */
function assertNames(slices: readonly Slice[]): void {
  const seen = new Set<string>();

  for (const { name } of slices) {
    if (name.trim() === "") throw new PieError("Every slice needs a name.");

    if (name.length > sliceNameLimit) {
      throw new PieError(`${name} is too long: keep slice names to ${sliceNameLimit} letters.`);
    }

    const key = name.trim().toLowerCase();

    if (seen.has(key)) throw new PieError(`Two slices are called ${name}.`);

    seen.add(key);
  }
}

function verdictFor(amount: Money, leftover: Money, leftAfter: Proportion): Verdict {
  if (amount.isMoreThan(leftover)) return "overflows";

  return leftAfter.isLessThan(tightThreshold) ? "tight" : "fits";
}
