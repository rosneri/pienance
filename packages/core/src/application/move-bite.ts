import { Month, PieError, type Bite } from "../domain";
import type { Ports } from "./ports";

export interface MoveBiteInput {
  readonly ownerId: string;
  readonly biteId: string;
  readonly sliceId: string;
}

/** Moves one of this month's bites into another slice of the pie. */
export function moveBite(ports: Ports) {
  return async (input: MoveBiteInput): Promise<Bite> => {
    const pie = await ports.pies.find(input.ownerId, Month.of(ports.now()));

    if (!pie) throw new PieError("Bake a pie first");

    const moved = pie.move(input.biteId, input.sliceId);

    await ports.pies.save(pie);

    return moved;
  };
}
