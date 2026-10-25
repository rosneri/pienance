import { Money, Month, PieError, type Pie } from "../domain";
import type { Ports } from "./ports";

/** Round bites up into a slice to the next step, or stop. */
export type SweepChoice =
  | {
      readonly sliceId: string;
      /** As typed, in the pie's currency: "1", "5" or "10". */
      readonly step: string;
    }
  | { readonly off: true };

export type SetSweepInput = SweepChoice & { readonly ownerId: string };

/** Turns rounding bites up on, changes its slice or step, or turns it off. */
export function setSweep(ports: Ports) {
  return async (input: SetSweepInput): Promise<Pie> => {
    const pie = await ports.pies.find(input.ownerId, Month.of(ports.now()));

    if (!pie) throw new PieError("Bake a pie first");

    pie.setSweep(
      "off" in input
        ? undefined
        : { sliceId: input.sliceId, step: Money.parse(input.step, pie.currency) },
    );
    await ports.pies.save(pie);

    return pie;
  };
}
