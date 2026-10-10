import { roughly, type Pie, type Verdict, type Weighing } from "../domain";

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
}

export interface BiteView {
  readonly id: string;
  readonly note: string;
  readonly sliceName: string;
  readonly portionWords: string;
  readonly eatenAt: string;
}

export interface PieView {
  /** ISO 4217 code of the pie, e.g. "EUR". */
  readonly currency: string;
  readonly leftoverWords: string;
  readonly slices: readonly SliceView[];
  readonly bites: readonly BiteView[];
}

export interface WeighingView {
  readonly sliceName: string;
  readonly ofSlice: string;
  readonly ofLeftover: string;
  readonly ofPie: string;
  readonly leftAfter: string;
  readonly verdict: Verdict;
}

export function viewPie(pie: Pie): PieView {
  let from = 0;

  const slices = pie.servings().map((serving) => {
    const to = from + serving.slice.share.ratio;

    const view: SliceView = {
      id: serving.slice.id,
      name: serving.slice.name,
      from,
      to,
      left: Math.min(serving.left.ratio, 1),
      leftWords: roughly(serving.left),
    };

    from = to;

    return view;
  });

  return {
    currency: pie.currency.code,
    leftoverWords: roughly(pie.leftover()),
    slices,
    bites: pie.bites.toReversed().map((bite) => ({
      id: bite.id,
      note: bite.note,
      sliceName: pie.slice(bite.sliceId).name,
      portionWords: roughly(pie.portionOf(bite)),
      eatenAt: bite.eatenAt.toISOString(),
    })),
  };
}

export function viewWeighing(weighing: Weighing): WeighingView {
  return {
    sliceName: weighing.slice.name,
    ofSlice: roughly(weighing.ofSlice),
    ofLeftover: roughly(weighing.ofLeftover),
    ofPie: roughly(weighing.ofPie),
    leftAfter: roughly(weighing.leftAfter),
    verdict: weighing.verdict,
  };
}
