import { Month, type Pie } from "../domain";
import type { Ports } from "./ports";

export interface ShelvePieInput {
  readonly ownerId: string;
  /** At most this many past months. */
  readonly months: number;
}

export interface Shelved {
  readonly month: Month;
  readonly pie: Pie;
}

/** The pie's past months, newest first, back to the month it was baked in. */
export function shelvePie(ports: Ports) {
  return async (input: ShelvePieInput): Promise<Shelved[]> => {
    const current = Month.of(ports.now());
    const pie = await ports.pies.find(input.ownerId, current);

    if (!pie) return [];

    const baked = Month.of(pie.bakedAt);
    const months: Month[] = [];

    for (
      let month = current.previous();
      months.length < input.months && !baked.isAfter(month);
      month = month.previous()
    ) {
      months.push(month);
    }

    // One read per month keeps the port small; a batched read can come when it is needed.
    const pies = await Promise.all(months.map((month) => ports.pies.find(input.ownerId, month)));

    return months.flatMap((month, index) => {
      const past = pies[index];

      return past ? [{ month, pie: past }] : [];
    });
  };
}
