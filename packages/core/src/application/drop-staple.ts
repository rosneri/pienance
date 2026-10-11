import { Month, PieError, type Staple } from "../domain";
import type { Ports } from "./ports";

export interface DropStapleInput {
  readonly ownerId: string;
  readonly stapleId: string;
}

/** Stops a staple after this month, or removes it if it was stocked this month. */
export function dropStaple(ports: Ports) {
  return async (input: DropStapleInput): Promise<Staple> => {
    const month = Month.of(ports.now());
    const pie = await ports.pies.find(input.ownerId, month);

    if (!pie) throw new PieError("Bake a pie first");

    const dropped = pie.drop(input.stapleId, month);

    await ports.pies.save(pie);

    return dropped;
  };
}
