import { Money, Month, PieError, type Weighing } from "../domain";
import type { Ports } from "./ports";

export interface WeighBiteInput {
  readonly ownerId: string;
  readonly sliceId: string;
  /** As typed, in the pie's currency. */
  readonly amount: string;
  /** Spread over this many months, starting with this one. */
  readonly months?: number | undefined;
}

/**
 * "Is it worth it?": weighs a prospective expense against this month's pie. When it is
 * too big at once, it also says over how few months it would fit.
 */
export function weighBite(ports: Ports) {
  return async (input: WeighBiteInput): Promise<Weighing> => {
    const pie = await ports.pies.find(input.ownerId, Month.of(ports.now()));

    if (!pie) throw new PieError("Bake a pie first");

    const candidate = {
      sliceId: input.sliceId,
      amount: Money.parse(input.amount, pie.currency),
      months: input.months,
    };

    const weighing = pie.weigh(candidate);

    if (input.months !== undefined || weighing.verdict !== "overflows") return weighing;

    const fitsOver = pie.fewestMonthsToFit(candidate);

    return fitsOver === null ? weighing : { ...weighing, fitsOver };
  };
}
