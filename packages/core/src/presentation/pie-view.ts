import {
  aheadOf,
  isVoid,
  paceOf,
  roughly,
  type Month,
  type Pace,
  type Pie,
  type Proportion,
  type Staple,
  type Verdict,
  type Weighing,
} from "../domain";
import { monthName } from "./month-words";

/**
 * Plain, serialisable views of the pie. Every surface (web, native, agents)
 * renders these, so the rough wording lives in one place.
 */
export interface SliceView {
  readonly id: string;
  readonly name: string;
  /** Where the slice starts and ends around the pie, as fractions of a full turn. */
  readonly from: number;
  readonly to: number;
  /** Fraction of the slice still left, between 0 and 1. */
  readonly left: number;
  readonly leftWords: string;
  /** How much of the slice its staples take, when it has any. */
  readonly stapledWords?: string;
  /** Only while the month is running. */
  readonly pace?: Pace;
  readonly eatenWords?: string;
  /** How far eating is ahead of the month (negative when behind), to find the fastest slice. */
  readonly ahead?: number;
}

export interface BiteView {
  readonly id: string;
  readonly note: string;
  readonly sliceName: string;
  readonly portionWords: string;
  readonly eatenAt: string;
}

export interface StapleView {
  readonly id: string;
  readonly sliceId: string;
  readonly note: string;
  readonly sliceName: string;
  readonly portionWords: string;
  /** As a person would type it, to change it. */
  readonly amount: string;
  /** Stocked in the served month: dropping it removes it rather than stopping it. */
  readonly stockedThisMonth: boolean;
  /** The last month it counts in, once it is stopped. */
  readonly endsAfter?: string;
}

export interface PieView {
  /** ISO 4217 code of the pie, e.g. "EUR". */
  readonly currency: string;
  /** The served month, e.g. "2026-10". */
  readonly month: string;
  readonly monthName: string;
  readonly leftoverWords: string;
  readonly slices: readonly SliceView[];
  readonly bites: readonly BiteView[];
  readonly staples: readonly StapleView[];
  /** How much of the month is gone, between 0 and 1. Only while the month is running. */
  readonly gone?: number;
  readonly goneWords?: string;
}

export interface WeighingView {
  readonly sliceName: string;
  readonly ofSlice: string;
  readonly ofLeftover: string;
  readonly ofPie: string;
  readonly leftAfter: string;
  /** How much of the slice its staples already take. */
  readonly stapled: string;
  readonly verdict: Verdict;
}

export interface Served {
  readonly month: Month;
  /** How much of the month is gone; leave it out for a month that is over. */
  readonly gone?: Proportion;
}

export function viewPie(pie: Pie, served: Served): PieView {
  const { gone } = served;

  return {
    currency: pie.currency.code,
    month: served.month.toString(),
    monthName: monthName(served.month),
    leftoverWords: roughly(pie.leftover()),
    slices: viewSlices(pie, gone),
    bites: pie.bites.toReversed().map((bite) => ({
      id: bite.id,
      note: bite.note,
      sliceName: pie.slice(bite.sliceId).name,
      portionWords: roughly(pie.portionOf(bite)),
      eatenAt: bite.eatenAt.toISOString(),
    })),
    staples: pie.staples
      .filter((staple) => !isVoid(staple))
      .map((staple) => viewStaple(pie, staple, served.month)),
    ...(gone && { gone: gone.ratio, goneWords: roughly(gone) }),
  };
}

/** The slices laid around the pie, with their pace while the month is running. */
export function viewSlices(pie: Pie, gone?: Proportion): SliceView[] {
  let from = 0;

  return pie.servings().map((serving) => {
    const to = from + serving.slice.share.ratio;

    const view: SliceView = {
      id: serving.slice.id,
      name: serving.slice.name,
      from,
      to,
      left: Math.min(serving.left.ratio, 1),
      leftWords: roughly(serving.left),
      ...(serving.stapled.ratio > 0 && { stapledWords: roughly(serving.stapled) }),
      ...(gone && {
        pace: paceOf(serving, gone),
        eatenWords: roughly(serving.eaten),
        ahead: aheadOf(serving, gone),
      }),
    };

    from = to;

    return view;
  });
}

export function viewStaple(pie: Pie, staple: Staple, month: Month): StapleView {
  return {
    id: staple.id,
    sliceId: staple.sliceId,
    note: staple.note,
    sliceName: pie.slice(staple.sliceId).name,
    portionWords: roughly(pie.portionOfStaple(staple)),
    amount: staple.amount.toDecimal(),
    stockedThisMonth: staple.since.equals(month),
    ...(staple.until && !isVoid(staple) && { endsAfter: monthName(staple.until.previous()) }),
  };
}

export function viewWeighing(weighing: Weighing): WeighingView {
  return {
    sliceName: weighing.slice.name,
    ofSlice: roughly(weighing.ofSlice),
    ofLeftover: roughly(weighing.ofLeftover),
    ofPie: roughly(weighing.ofPie),
    leftAfter: roughly(weighing.leftAfter),
    stapled: roughly(weighing.stapled),
    verdict: weighing.verdict,
  };
}
