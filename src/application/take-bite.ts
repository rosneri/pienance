import { Money, Month, PieError, type Bite, type PieRepository } from "@/domain";

export interface TakeBiteInput {
  readonly sliceId: string;
  readonly amount: number;
  readonly note: string;
}

/** Records an expense in this month's pie. */
export function takeBite(pies: PieRepository) {
  return async ({ sliceId, amount, note }: TakeBiteInput): Promise<Bite> => {
    const pie = await pies.find(Month.current());
    if (!pie) throw new PieError("Bake a pie first");
    const bite: Bite = {
      id: crypto.randomUUID(),
      sliceId,
      amount: Money.of(amount),
      note: note.trim(),
      eatenAt: new Date(),
    };
    pie.take(bite);
    await pies.save(pie);
    return bite;
  };
}
