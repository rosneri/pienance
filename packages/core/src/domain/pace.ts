import type { Proportion } from "./proportion";
import type { Serving } from "./pie";

/**
 * How fast a slice is eaten compared with how much of the month is gone:
 * well ahead of the month, about as fast as it passes, or well behind it.
 */
export type Pace = "fast" | "steady" | "slow";

/** How far eating may stray from the month before it counts; avoids flicker on day one. */
const band = 0.1;

/**
 * Staples count as eaten from day one, so pace compares only the part of the slice
 * they leave free.
 */
export function paceOf(serving: Serving, gone: Proportion): Pace {
  const eaten = serving.eaten.ratio;
  const stapled = serving.stapled.ratio;

  if (stapled >= 1) return eaten > stapled ? "fast" : "steady";

  if (eaten >= 1) return "fast";

  // Rounded so the band's edges hold despite floating point (0.4 - 0.3 is not quite 0.1).
  const ahead = Math.round(aheadOf(serving, gone) * 1e9) / 1e9;

  if (ahead > band) return "fast";

  return ahead < -band ? "slow" : "steady";
}

/** How far eating of the free part of the slice is ahead of the month (negative when behind). */
export function aheadOf(serving: Serving, gone: Proportion): number {
  const stapled = Math.min(serving.stapled.ratio, 1);

  if (stapled >= 1) return serving.eaten.ratio - stapled;

  return (serving.eaten.ratio - stapled) / (1 - stapled) - gone.ratio;
}
