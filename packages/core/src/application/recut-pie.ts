import { Month, PieError, Proportion, type Pie, type Slice } from "../domain";
import type { Ports } from "./ports";

/** A slice as the person sets it: a kept slice by its id, a new one without. */
export interface SliceCutInput {
  readonly id?: string | undefined;
  readonly name: string;
  /** Whole percent of the pie, as typed: "30". */
  readonly percent: string;
}

export interface RecutPieInput {
  readonly ownerId: string;
  readonly slices: readonly SliceCutInput[];
}

const wholePercent = /^\d{1,3}$/;

/** The longest slice name: it has to fit a legend and a select. */
const longestName = 40;

function percentOf(typed: string): number {
  const text = typed.trim().replace(/%$/, "");
  const percent = Number(text);

  if (!wholePercent.test(text) || percent < 1 || percent > 100) {
    throw new RangeError(`"${typed}" is not a whole percent from 1 to 100`);
  }

  return percent;
}

/**
 * Cuts the pie into the person's own slices: rename, resize, add or remove them. A removed
 * slice takes everything eaten from it, in every month, along.
 */
export function recutPie(ports: Ports) {
  return async (input: RecutPieInput): Promise<Pie> => {
    const pie = await ports.pies.find(input.ownerId, Month.of(ports.now()));

    if (!pie) throw new PieError("Bake a pie first");

    const known = new Set(pie.slices.map((slice) => slice.id));

    const percents = input.slices.map((slice) => percentOf(slice.percent));
    const total = percents.reduce((sum, percent) => sum + percent, 0);

    if (total !== 100) throw new PieError(`Slices must add up to 100%, got ${total}%`);

    const slices = input.slices.map((slice, index): Slice => {
      const name = slice.name.trim();

      if (name === "") throw new PieError("Each slice needs a name");

      if (name.length > longestName) {
        throw new PieError(`Keep slice names under ${longestName} characters`);
      }

      if (slice.id !== undefined && !known.has(slice.id)) {
        throw new PieError(`No slice ${slice.id} in this pie`);
      }

      return {
        id: slice.id ?? ports.newId(),
        name,
        share: Proportion.of((percents[index] ?? 0) / 100),
      };
    });

    const recut = pie.recut(slices);

    await ports.pies.save(recut);

    return recut;
  };
}
