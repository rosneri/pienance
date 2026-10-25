import { isVoid, sweepSteps, type Pie } from "../domain";

/** A live slice as the re-slice form starts it. */
export interface ResliceSliceView {
  readonly id: string;
  readonly name: string;
  /** Its share, in whole percent. */
  readonly percent: number;
  /** Something was eaten from it this month: retired, it stays listed until that is moved. */
  readonly eaten: boolean;
  /** It has a staple that is not stopped, so it cannot be retired yet. */
  readonly stocked: boolean;
}

/** What the re-slice form starts from: the income as typed, and every live slice. */
export interface ResliceView {
  readonly currency: string;
  /** As a person would type it, e.g. "3000.00". */
  readonly income: string;
  readonly slices: readonly ResliceSliceView[];
  /** Rounding bites up, when it is on: into which slice, and to the next what, as typed. */
  readonly sweep?: { readonly sliceId: string; readonly step: string };
  /** The steps the pie's currency offers, as typed. */
  readonly sweepSteps: readonly string[];
}

export function viewReslice(pie: Pie): ResliceView {
  const counted = pie.staples.filter((staple) => !isVoid(staple));

  return {
    currency: pie.currency.code,
    income: pie.income.toDecimal(),
    slices: pie.liveSlices.map((slice) => ({
      id: slice.id,
      name: slice.name,
      percent: slice.share.percent,
      eaten:
        pie.bites.some((bite) => bite.sliceId === slice.id) ||
        counted.some((staple) => staple.sliceId === slice.id),
      stocked: counted.some((staple) => staple.sliceId === slice.id && !staple.until),
    })),
    ...(pie.sweep && {
      sweep: { sliceId: pie.sweep.sliceId, step: pie.sweep.step.toDecimal() },
    }),
    sweepSteps: sweepSteps(pie.currency).map((step) => step.toDecimal()),
  };
}
