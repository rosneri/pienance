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

/** Denominators up to ten keep a fraction readable at a glance. */
const largestDenominator = 10;

/** Below a tenth, or within a tenth of the whole, a unit fraction is clearer: 1/30, 29/30. */
const edge = 1 / largestDenominator;

/**
 * A simple fraction, e.g. "5/9": still a proportion, never an amount. Small parts are told
 * as one in so many ("1/30"), and nearly whole ones as all but one ("29/30"). The simplest
 * fraction wins a tie, so "2/4" is always said as "1/2".
 */
export function asFraction(proportion: Proportion): string {
  const { ratio } = proportion;

  if (!Number.isFinite(ratio)) return "more than all";

  if (ratio === 0) return "nothing";

  if (ratio === 1) return "all";

  if (ratio < edge) return `1/${Math.round(1 / ratio)}`;

  if (ratio < 1 && 1 - ratio < edge / 2) {
    const denominator = Math.round(1 / (1 - ratio));

    return `${denominator - 1}/${denominator}`;
  }

  let best = { numerator: 0, denominator: 1, error: ratio };

  for (let denominator = 2; denominator <= largestDenominator; denominator++) {
    const numerator = Math.round(ratio * denominator);
    const error = Math.abs(ratio - numerator / denominator);

    if (error < best.error - 1e-9) best = { numerator, denominator, error };
  }

  if (best.numerator === best.denominator) return "all";

  return `${best.numerator}/${best.denominator}`;
}

/** A part of a slice, as people read it: "1/30 (Wants)". */
export function portionOf(fraction: string, sliceName: string): string {
  return `${fraction} (${sliceName})`;
}
