import type { Money } from "./money";
import type { Food, Pie } from "./pie";
import type { Slice } from "./slice";

/**
 * A way to cut the pie for a single view: which food it holds, and what that food is
 * measured against. The overview is the whole pie; a focus is any narrower cut.
 * Categories (#22) will join as another cut.
 */
export abstract class Cut {
  /** Stable, e.g. "slice:wants" or "recurrence:every-month". */
  abstract readonly key: string;
  abstract readonly name: string;

  abstract includes(food: Food): boolean;

  /** The money this cut's food is a part of. */
  abstract wholeOf(pie: Pie): Money;
}

/** The overview: everything, against the whole income. */
export class WholeCut extends Cut {
  readonly key = "whole";
  readonly name = "Your pie";

  includes(): boolean {
    return true;
  }

  wholeOf(pie: Pie): Money {
    return pie.whole;
  }
}

/** One slice of the budget (Needs, Wants, Savings), against that slice's share. */
export class SliceCut extends Cut {
  readonly key: string;
  readonly name: string;

  constructor(readonly slice: Slice) {
    super();
    this.key = `slice:${slice.id}`;
    this.name = slice.name;
  }

  includes(food: Food): boolean {
    return food.item.sliceId === this.slice.id;
  }

  wholeOf(pie: Pie): Money {
    return pie.sizeOf(this.slice);
  }
}

export type Recurrence = "every-month" | "one-time";

const recurrenceNames: Record<Recurrence, string> = {
  "every-month": "Every month",
  "one-time": "One time",
};

/** Staples (every month) or bites (one time), across slices, against the whole income. */
export class RecurrenceCut extends Cut {
  readonly key: string;
  readonly name: string;

  constructor(readonly recurrence: Recurrence) {
    super();
    this.key = `recurrence:${recurrence}`;
    this.name = recurrenceNames[recurrence];
  }

  includes(food: Food): boolean {
    return (food.kind === "staple") === (this.recurrence === "every-month");
  }

  wholeOf(pie: Pie): Money {
    return pie.whole;
  }
}

/** Every single view a pie offers: the overview, each slice, then each recurrence. */
export function cutsOf(pie: Pie): Cut[] {
  return [
    new WholeCut(),
    ...pie.liveSlices.map((slice) => new SliceCut(slice)),
    new RecurrenceCut("every-month"),
    new RecurrenceCut("one-time"),
  ];
}
