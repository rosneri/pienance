import {
  aheadOf,
  asFraction,
  freeEatenOf,
  isVoid,
  paceOf,
  currencyOf,
  Money,
  roughly,
  sweepSteps,
  sweptBy,
  type Bite,
  type Month,
  type Pace,
  type Pie,
  type Proportion,
  type Staple,
  type Verdict,
  type Weighing,
} from "../domain";
import { viewFocuses, type FocusView } from "./focus-view";
import { monthName } from "./month-words";

/**
 * Plain, serialisable views of the pie. Every surface (web, native, agents)
 * renders these, so the rough wording lives in one place.
 */
export interface SliceView {
  readonly id: string;
  readonly name: string;
  /** Takes no share and draws no wedge; listed only while it has bites this month. */
  readonly retired: boolean;
  /** Where the slice starts and ends around the pie, as fractions of a full turn. */
  readonly from: number;
  readonly to: number;
  /** Fraction of the slice still left, between 0 and 1. */
  readonly left: number;
  readonly leftWords: string;
  /** Fraction of the slice its staples take, between 0 and 1: they come off its end first. */
  readonly stapled: number;
  /** How much of the slice its staples take, when it has any. */
  readonly stapledWords?: string;
  /** Only while the month is running. */
  readonly pace?: Pace;
  /** How much of what the staples leave was eaten: what pace is measured on. */
  readonly eatenWords?: string;
  /** How far eating is ahead of the month (negative when behind), to find the fastest slice. */
  readonly ahead?: number;
}

export interface BiteView {
  readonly id: string;
  readonly sliceId: string;
  readonly note: string;
  readonly sliceName: string;
  /** How much of its slice the bite took, as a simple fraction, e.g. "5/9". */
  readonly portion: string;
  /** The same, in rough words, e.g. "about half". */
  readonly portionWords: string;
  readonly eatenAt: string;
  /** What rounding it up swept, and into which slice, e.g. "a crumb" of "Savings". */
  readonly swept?: { readonly sliceName: string; readonly words: string };
  /** Part of a spread: which one, e.g. "2 of 6", and how many parts are still to come. */
  readonly spread?: { readonly id: string; readonly words: string; readonly toCome: number };
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
  /** Every single view besides this overview: each slice, every month, one time. */
  readonly focuses: readonly FocusView[];
  /** Rounding bites up, when it is on: into which slice, and to the next what. */
  readonly sweep?: { readonly sliceId: string; readonly sliceName: string; readonly step: string };
  /** What this month's sweeps add up to, per slice they went into. */
  readonly swept: readonly { readonly sliceName: string; readonly words: string }[];
  /** Last month's leftover, carried into one slice: which, and from which month. */
  readonly carry?: { readonly sliceId: string; readonly sliceName: string; readonly from: string };
  /** How much of the month is gone, between 0 and 1. Only while the month is running. */
  readonly gone?: number;
  readonly goneWords?: string;
}

export interface WeighingView {
  readonly sliceName: string;
  /** The bite as a simple fraction of its slice, e.g. "1/5". */
  readonly portion: string;
  readonly ofSlice: string;
  readonly ofLeftover: string;
  readonly ofPie: string;
  readonly leftAfter: string;
  /** How much of the slice its staples already take. */
  readonly stapled: string;
  readonly verdict: Verdict;
  /** Weighed as a spread: over how many months, and the whole amount's verdict now. */
  readonly spread?: { readonly months: number; readonly wholeVerdict: Verdict };
  /** The fewest months over which it would fit, when it is too big at once. */
  readonly fitsOver?: number;
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
    bites: pie.bites.toReversed().map((bite) => viewBite(pie, bite)),
    staples: pie.staples
      .filter((staple) => !isVoid(staple))
      .map((staple) => viewStaple(pie, staple, served.month)),
    focuses: viewFocuses(pie),
    ...(pie.sweep && {
      sweep: {
        sliceId: pie.sweep.sliceId,
        sliceName: pie.slice(pie.sweep.sliceId).name,
        step: pie.sweep.step.toDecimal(),
      },
    }),
    swept: viewSwept(pie),
    ...(pie.carry && {
      carry: {
        sliceId: pie.carry.sliceId,
        sliceName: pie.slice(pie.carry.sliceId).name,
        from: monthName(served.month.previous()),
      },
    }),
    ...(gone && { gone: gone.ratio, goneWords: roughly(gone) }),
  };
}

/** The slices laid around the pie, with their pace while the month is running. */
export function viewSlices(pie: Pie, gone?: Proportion): SliceView[] {
  let from = 0;

  return pie.servings().map((serving) => {
    // Angles follow sizes, so a slice holding a carry draws wider than its share.
    const to = from + serving.ofPie.ratio;

    const view: SliceView = {
      id: serving.slice.id,
      name: serving.slice.name,
      retired: serving.retired,
      from,
      to,
      left: Math.min(serving.left.ratio, 1),
      leftWords: roughly(serving.left),
      stapled: Math.min(serving.stapled.ratio, 1),
      ...(serving.stapled.ratio > 0 && { stapledWords: roughly(serving.stapled) }),
      ...(gone &&
        !serving.retired && {
          pace: paceOf(serving, gone),
          eatenWords: roughly(freeEatenOf(serving)),
          ahead: aheadOf(serving, gone),
        }),
    };

    from = to;

    return view;
  });
}

export function viewBite(pie: Pie, bite: Bite): BiteView {
  const portion = pie.portionOf(bite);
  const slice = pie.slice(bite.sliceId);

  return {
    id: bite.id,
    sliceId: bite.sliceId,
    note: bite.note,
    // A retired slice has no size: its bites are told against the whole pie.
    sliceName: slice.retired ? "the pie" : slice.name,
    portion: asFraction(portion),
    portionWords: roughly(portion),
    eatenAt: bite.eatenAt.toISOString(),
    ...(bite.swept && {
      swept: {
        sliceName: pie.slice(bite.swept.sliceId).name,
        words: roughly(bite.swept.amount.proportionOf(pie.sizeOf(pie.slice(bite.swept.sliceId)))),
      },
    }),
    ...(bite.spread && {
      spread: {
        id: bite.spread.id,
        words: `${bite.spread.part} of ${bite.spread.of}`,
        toCome: bite.spread.of - bite.spread.part,
      },
    }),
  };
}

export function viewStaple(pie: Pie, staple: Staple, month: Month): StapleView {
  const slice = pie.slice(staple.sliceId);

  return {
    id: staple.id,
    sliceId: staple.sliceId,
    note: staple.note,
    sliceName: slice.retired ? "the pie" : slice.name,
    portionWords: roughly(pie.portionOfStaple(staple)),
    amount: staple.amount.toDecimal(),
    stockedThisMonth: staple.since.equals(month),
    ...(staple.until && !isVoid(staple) && { endsAfter: monthName(staple.until.previous()) }),
  };
}

export function viewWeighing(weighing: Weighing): WeighingView {
  return {
    sliceName: weighing.slice.name,
    portion: asFraction(weighing.ofSlice),
    ofSlice: roughly(weighing.ofSlice),
    ofLeftover: roughly(weighing.ofLeftover),
    ofPie: roughly(weighing.ofPie),
    leftAfter: roughly(weighing.leftAfter),
    stapled: roughly(weighing.stapled),
    verdict: weighing.verdict,
    ...(weighing.spread && {
      spread: { months: weighing.spread.months, wholeVerdict: weighing.spread.whole.verdict },
    }),
    ...(weighing.fitsOver !== undefined && { fitsOver: weighing.fitsOver }),
  };
}

/** Last month's leftover, as the offer to carry it tells it. */
export interface CarryOfferView {
  /** e.g. "2026-09" */
  readonly month: string;
  readonly monthName: string;
  readonly leftoverWords: string;
}

/** Last month, and how much of its whole pie it left. */
export function viewCarryOffer(offer: { month: Month; leftover: Proportion }): CarryOfferView {
  return {
    month: offer.month.toString(),
    monthName: monthName(offer.month),
    leftoverWords: roughly(offer.leftover),
  };
}

/** This month's sweeps, added up per slice they went into, against that slice's size. */
function viewSwept(pie: Pie): PieView["swept"] {
  const bySlice = new Map<string, Money>();

  for (const { swept } of pie.bites) {
    if (!swept) continue;

    const sofar = bySlice.get(swept.sliceId);

    bySlice.set(swept.sliceId, sofar ? sofar.plus(swept.amount) : swept.amount);
  }

  return [...bySlice].map(([sliceId, amount]) => {
    const slice = pie.slice(sliceId);

    return { sliceName: slice.name, words: roughly(amount.proportionOf(pie.sizeOf(slice))) };
  });
}

/** An example bite and what it sweeps, as exact amounts: rounding is where numbers help. */
export interface SweepExample {
  readonly bite: string;
  readonly swept: string;
}

export function sweepExample(currencyCode: string, step: string): SweepExample {
  const currency = currencyOf(currencyCode);
  const stepMoney = Money.parse(step, currency);
  // 4.3 steps: a bite that is plainly not on a whole step.
  const bite = Money.ofMinor(Math.round((stepMoney.minor * 43) / 10), currency);

  return { bite: bite.toDecimal(), swept: sweptBy(bite, stepMoney).toDecimal() };
}

/** The steps a pie in this currency offers, as typed. */
export function viewSweepSteps(currencyCode: string): string[] {
  return sweepSteps(currencyOf(currencyCode)).map((step) => step.toDecimal());
}
