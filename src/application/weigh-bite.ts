import { Money, Month, PieError, type PieRepository, type Weighing } from "@/domain";

export interface WeighBiteInput {
  readonly sliceId: string;
  readonly amount: number;
}

/** "Is it worth it?": weighs a prospective expense against this month's pie. */
export function weighBite(pies: PieRepository) {
  return async ({ sliceId, amount }: WeighBiteInput): Promise<Weighing> => {
    const pie = await pies.find(Month.current());
    if (!pie) throw new PieError("Bake a pie first");
    return pie.weigh({ sliceId, amount: Money.of(amount) });
  };
}
