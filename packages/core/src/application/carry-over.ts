import { Month, PieError, type Pie, type Proportion } from "../domain";
import type { Ports } from "./ports";

export interface CarryOfferInput {
  readonly ownerId: string;
}

/** Last month's leftover, offered to this month. */
export interface CarryOffer {
  readonly month: Month;
  /** How much of last month's whole pie was left. */
  readonly leftover: Proportion;
}

export interface CarryOverInput {
  readonly ownerId: string;
  readonly sliceId: string;
}

/**
 * Whether last month left something this month can carry: not in the month the pie was
 * baked, not once carried, and not after an overspent month. It only reads.
 */
export function readCarryOffer(ports: Ports) {
  return async (input: CarryOfferInput): Promise<CarryOffer | null> => {
    const month = Month.of(ports.now());
    const pie = await ports.pies.find(input.ownerId, month);

    if (!pie || pie.carry || !month.isAfter(Month.of(pie.bakedAt))) return null;

    const last = await ports.pies.find(input.ownerId, month.previous());

    if (!last || last.leftoverMoney().minor === 0) return null;

    return { month: last.month, leftover: last.leftover() };
  };
}

/** Adds last month's leftover to one slice of this month's pie. */
export function carryOver(ports: Ports) {
  return async (input: CarryOverInput): Promise<Pie> => {
    const month = Month.of(ports.now());
    const pie = await ports.pies.find(input.ownerId, month);

    if (!pie) throw new PieError("Bake a pie first");

    if (pie.carry) throw new PieError("Already carried this month.");

    // The month the pie was baked in has no last month to carry from.
    const last = month.isAfter(Month.of(pie.bakedAt))
      ? await ports.pies.find(input.ownerId, month.previous())
      : null;

    const leftover = last?.leftoverMoney();

    if (!leftover || leftover.minor === 0) {
      throw new PieError("Last month left nothing to carry.");
    }

    pie.carryOver({ sliceId: input.sliceId, amount: leftover });
    await ports.pies.save(pie);

    return pie;
  };
}

/** Undoes this month's carry; the offer comes back. */
export function dropCarry(ports: Ports) {
  return async (input: CarryOfferInput): Promise<Pie> => {
    const pie = await ports.pies.find(input.ownerId, Month.of(ports.now()));

    if (!pie) throw new PieError("Bake a pie first");

    pie.dropCarry();
    await ports.pies.save(pie);

    return pie;
  };
}
