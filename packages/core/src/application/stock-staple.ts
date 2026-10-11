import { Money, Month, PieError, type Staple } from "../domain";
import type { Ports } from "./ports";

export interface StockStapleInput {
  readonly ownerId: string;
  readonly sliceId: string;
  /** As typed, in the pie's currency. */
  readonly amount: string;
  readonly note: string;
  /** A staple this one replaces, to change an amount without touching past months. */
  readonly replaces?: string;
}

/** Adds a bite that comes back every month, counted from this month on. */
export function stockStaple(ports: Ports) {
  return async (input: StockStapleInput): Promise<Staple> => {
    const month = Month.of(ports.now());
    const pie = await ports.pies.find(input.ownerId, month);

    if (!pie) throw new PieError("Bake a pie first");

    const staple: Staple = {
      id: ports.newId(),
      sliceId: input.sliceId,
      amount: Money.parse(input.amount, pie.currency),
      note: input.note.trim(),
      since: month,
    };

    if (input.replaces) pie.replace(input.replaces, staple);
    else pie.stock(staple);

    await ports.pies.save(pie);

    return staple;
  };
}
