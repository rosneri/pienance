import { Month, PieError } from "../domain";
import type { Ports } from "./ports";

export interface PutBackSpreadInput {
  readonly ownerId: string;
  readonly spreadId: string;
}

/** Puts back this month's part of a spread and every later one; earlier parts stay. */
export function putBackSpread(ports: Ports) {
  return async (input: PutBackSpreadInput): Promise<void> => {
    const pie = await ports.pies.find(input.ownerId, Month.of(ports.now()));

    if (!pie) throw new PieError("Bake a pie first");

    pie.putBackSpread(input.spreadId);
    await ports.pies.save(pie);
  };
}
