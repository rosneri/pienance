import { Money, Pie, Proportion } from "../domain";
import type { Ports } from "./ports";

/** The well-known 50/30/20 split, a sensible start until slices become editable. */
const defaultSlices = [
  { name: "Needs", share: 0.5 },
  { name: "Wants", share: 0.3 },
  { name: "Savings", share: 0.2 },
] as const;

export interface BakePieInput {
  readonly monthlyIncome: number;
}

export function bakePie(ports: Ports) {
  return async (input: BakePieInput): Promise<Pie> => {
    const pie = Pie.bake({
      id: ports.newId(),
      income: Money.of(input.monthlyIncome),
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
