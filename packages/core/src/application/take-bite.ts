import { Money, Month, PieError, type Bite } from "../domain";
import type { Ports } from "./ports";

export interface TakeBiteInput {
  readonly ownerId: string;
  readonly sliceId: string;
  /** As typed, in the pie's currency. */
  readonly amount: string;
  readonly note: string;
}

/** Records an expense in this month's pie. */
export function takeBite(ports: Ports) {
  return async (input: TakeBiteInput): Promise<Bite> => {
    const eatenAt = ports.now();
    const pie = await ports.pies.find(input.ownerId, Month.of(eatenAt));

    if (!pie) throw new PieError("Bake a pie first");

    const bite: Bite = {
      id: ports.newId(),
      sliceId: input.sliceId,
      amount: Money.parse(input.amount, pie.currency),
      note: input.note.trim(),
      eatenAt,
    };

    pie.take(bite);
    await ports.pies.save(pie);

    return bite;
  };
}
