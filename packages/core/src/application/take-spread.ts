import { Money, Month, PieError, spreadOver, type Bite } from "../domain";
import type { Ports } from "./ports";

export interface TakeSpreadInput {
  readonly ownerId: string;
  readonly sliceId: string;
  /** As typed, in the pie's currency: the whole expense. */
  readonly amount: string;
  readonly note: string;
  readonly months: number;
}

/**
 * Takes an expense in equal parts, one bite per month from this one on. Each later part is
 * dated the first instant of its month, so it shows up there with nothing else to do.
 */
export function takeSpread(ports: Ports) {
  return async (input: TakeSpreadInput): Promise<Bite> => {
    const now = ports.now();
    const pie = await ports.pies.find(input.ownerId, Month.of(now));

    if (!pie) throw new PieError("Bake a pie first");

    const spreadId = ports.newId();
    const parts = spreadOver(Money.parse(input.amount, pie.currency), input.months);
    let month = pie.month;

    // Every part sweeps on its own, with the step in force now.
    const bites = parts.map((amount, index): Bite => {
      const eatenAt = index === 0 ? now : (month = month.next()).start;
      const swept = pie.sweepOf({ sliceId: input.sliceId, amount });

      return {
        id: ports.newId(),
        sliceId: input.sliceId,
        amount,
        note: input.note.trim(),
        eatenAt,
        spread: { id: spreadId, part: index + 1, of: parts.length },
        ...(swept && { swept }),
      };
    });

    const [first] = bites;

    if (!first) throw new PieError("Nothing to spread");

    for (const bite of bites) pie.take(bite);

    await ports.pies.save(pie);

    return first;
  };
}
