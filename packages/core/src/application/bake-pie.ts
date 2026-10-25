import { currencyOf, Money, Month, Pie, Proportion } from "../domain";
import type { Ports } from "./ports";

/** The well-known 50/30/20 split, a sensible start; `reslicePie` makes the slices one's own. */
const defaultSlices = [
  { name: "Needs", share: 0.5 },
  { name: "Wants", share: 0.3 },
  { name: "Savings", share: 0.2 },
] as const;

export interface BakePieInput {
  readonly ownerId: string;
  /** As typed, e.g. "3000" or "2450,50". */
  readonly monthlyIncome: string;
  /** ISO 4217 code, e.g. "EUR". */
  readonly currency: string;
}

export function bakePie(ports: Ports) {
  return async (input: BakePieInput): Promise<Pie> => {
    const pie = Pie.bake({
      id: ports.newId(),
      ownerId: input.ownerId,
      bakedAt: ports.now(),
      month: Month.of(ports.now()),
      income: Money.parse(input.monthlyIncome, currencyOf(input.currency)),
      slices: defaultSlices.map((slice) => ({
        id: ports.newId(),
        name: slice.name,
        share: Proportion.of(slice.share),
      })),
    });

    await ports.pies.save(pie);

    return pie;
  };
}
