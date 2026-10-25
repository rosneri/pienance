import type { Money } from "./money";
import { Proportion } from "./proportion";

/** The fewest and most months an expense can be spread over. */
export const spreadMonths = { fewest: 2, most: 24 } as const;

/** Which part of a spread a bite is: part 2 of 6. */
export interface SpreadPart {
  readonly id: string;
  /** From 1. */
  readonly part: number;
  readonly of: number;
}

/**
 * Equal parts of an expense, one per month, losing no minor unit. The first parts carry
 * the remainder, so this month's part is never the smallest.
 */
export function spreadOver(amount: Money, months: number): Money[] {
  if (!Number.isInteger(months) || months < spreadMonths.fewest || months > spreadMonths.most) {
    throw new RangeError(`Spread it over ${spreadMonths.fewest} to ${spreadMonths.most} months.`);
  }

  return amount.split(Array.from({ length: months }, () => Proportion.of(1 / months)));
}
