import { roughly, type Appetite, type Month, type Pie, type Slice } from "../domain";
import { monthName, shortMonthName } from "./month-words";
import { viewSlices, type SliceView } from "./pie-view";

/** One small pie on the shelf. */
export interface ShelfMonthView {
  /** e.g. "2026-09" */
  readonly month: string;
  /** e.g. "Sep" */
  readonly label: string;
  /** e.g. "September" */
  readonly name: string;
  readonly slices: readonly SliceView[];
  readonly leftoverWords: string;
  /** The month on screen. */
  readonly current: boolean;
}

export interface AppetiteView {
  readonly sliceName: string;
  /** How much of the slice is usually eaten, as a plain ratio. */
  readonly usual: number;
  readonly usualWords: string;
  readonly streak?: Appetite["streak"];
}

/** The months in the order given (this month first, then the past, newest first). */
export function viewShelf(
  entries: readonly { readonly month: Month; readonly pie: Pie }[],
  current: Month,
): ShelfMonthView[] {
  return entries.map(({ month, pie }) => ({
    month: month.toString(),
    label: shortMonthName(month),
    name: monthName(month),
    slices: viewSlices(pie),
    leftoverWords: roughly(pie.leftover()),
    current: month.equals(current),
  }));
}

export function viewAppetite(
  entries: readonly { readonly slice: Slice; readonly appetite: Appetite }[],
): AppetiteView[] {
  return entries.map(({ slice, appetite }) => ({
    sliceName: slice.name,
    usual: appetite.usual.ratio,
    usualWords: roughly(appetite.usual),
    ...(appetite.streak && { streak: appetite.streak }),
  }));
}
