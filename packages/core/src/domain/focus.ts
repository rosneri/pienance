import type { Cut } from "./cut";
import { Money } from "./money";
import type { Food, Pie } from "./pie";
import type { Proportion } from "./proportion";

/** The pie seen through one cut: its food, and how much of the cut's whole it ate. */
export interface Focus {
  readonly cut: Cut;
  readonly food: readonly Food[];
  /** Of the cut's whole: the slice for a slice, the income otherwise. */
  readonly eaten: Proportion;
  readonly left: Proportion;
  /** Of the whole pie, whatever the cut. */
  readonly ofPie: Proportion;
}

export function focusOn(pie: Pie, cut: Cut): Focus {
  const food = pie.food().filter((candidate) => cut.includes(candidate));

  const total = Money.sum(
    food.map(({ item }) => item.amount),
    pie.currency,
  );

  const eaten = total.proportionOf(cut.wholeOf(pie));

  return { cut, food, eaten, left: eaten.complement(), ofPie: total.proportionOf(pie.whole) };
}
