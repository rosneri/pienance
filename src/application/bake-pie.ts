import { Money, Pie, Proportion, type PieRepository } from "@/domain";

/** The well-known 50/30/20 split, a sensible start until slices become editable. */
const defaultSlices = [
  { name: "Needs", share: 0.5 },
  { name: "Wants", share: 0.3 },
  { name: "Savings", share: 0.2 },
] as const;

export interface BakePieInput {
  readonly monthlyIncome: number;
}

export function bakePie(pies: PieRepository) {
  return async ({ monthlyIncome }: BakePieInput): Promise<Pie> => {
    const pie = Pie.bake({
      id: crypto.randomUUID(),
      income: Money.of(monthlyIncome),
      slices: defaultSlices.map(({ name, share }) => ({
        id: crypto.randomUUID(),
        name,
        share: Proportion.of(share),
      })),
    });
    await pies.save(pie);
    return pie;
  };
}
