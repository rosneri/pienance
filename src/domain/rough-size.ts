import type { Proportion } from "./proportion";

/**
 * The heart of pienance: proportions are spoken about roughly, never as exact numbers.
 * Ordered from smallest to largest; the first size whose upper bound fits wins.
 */
const roughSizes: ReadonlyArray<readonly [upTo: number, words: string]> = [
  [0, "nothing"],
  [0.04, "a crumb"],
  [0.08, "a sliver"],
  [0.15, "about a tenth"],
  [0.22, "about a fifth"],
  [0.29, "about a quarter"],
  [0.41, "about a third"],
  [0.59, "about half"],
  [0.71, "about two thirds"],
  [0.85, "about three quarters"],
  [0.99, "almost all"],
  [1.01, "all"],
  [1.5, "more than all"],
  [Number.POSITIVE_INFINITY, "way more than all"],
];

export function roughly(proportion: Proportion): string {
  const match = roughSizes.find(([upTo]) => proportion.ratio <= upTo);
  return match?.[1] ?? "way more than all";
}
