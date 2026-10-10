import { Money, Month, PieError, type Weighing } from "../domain";
import type { Ports } from "./ports";

export interface WeighBiteInput {
  readonly sliceId: string;
  readonly amount: number;
}

/** "Is it worth it?": weighs a prospective expense against this month's pie. */
export function weighBite(ports: Ports) {
  return async (input: WeighBiteInput): Promise<Weighing> => {
    const pie = await ports.pies.find(Month.of(ports.now()));

    if (!pie) throw new PieError("Bake a pie first");

    return pie.weigh({ sliceId: input.sliceId, amount: Money.of(input.amount) });
  };
}
