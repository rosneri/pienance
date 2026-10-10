import { Money, Month, PieError, type Weighing } from "../domain";
import type { Ports } from "./ports";

export interface WeighBiteInput {
  readonly ownerId: string;
  readonly sliceId: string;
  /** As typed, in the pie's currency. */
  readonly amount: string;
}

/** "Is it worth it?": weighs a prospective expense against this month's pie. */
export function weighBite(ports: Ports) {
  return async (input: WeighBiteInput): Promise<Weighing> => {
    const pie = await ports.pies.find(input.ownerId, Month.of(ports.now()));

    if (!pie) throw new PieError("Bake a pie first");

    return pie.weigh({ sliceId: input.sliceId, amount: Money.parse(input.amount, pie.currency) });
  };
}
