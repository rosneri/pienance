import { Month, PieError } from "../domain";
import type { Ports } from "./ports";

export interface PutBackBiteInput {
  readonly ownerId: string;
  readonly biteId: string;
}

/** Removes one of this month's bites, as if it was never taken. */
export function putBackBite(ports: Ports) {
  return async (input: PutBackBiteInput): Promise<void> => {
    const pie = await ports.pies.find(input.ownerId, Month.of(ports.now()));

    if (!pie) throw new PieError("Bake a pie first");

    pie.putBack(input.biteId);
    await ports.pies.save(pie);
  };
}
