import type { VitalName } from "@pienance/telemetry/contract";

const count = new Intl.NumberFormat("en");

const oneDecimal = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

const twoDecimals = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

export function formatCount(value: number): string {
  return count.format(value);
}

/** A duration for people: "84 ms", "1.2 s". */
export function formatDuration(ms: number): string {
  return ms < 1_000 ? `${count.format(Math.round(ms))} ms` : `${oneDecimal.format(ms / 1_000)} s`;
}

/** A share of a whole, "42%"; a dash when there is no whole. */
export function formatShare(part: number, whole: number): string {
  return whole === 0 ? "—" : `${Math.round((part / whole) * 100)}%`;
}

/** A web vital's value in its unit: CLS has none, the others are durations. */
export function formatVital(name: VitalName, value: number): string {
  return name === "CLS" ? twoDecimals.format(value) : formatDuration(value);
}

export type VitalVerdict = "good" | "needs work" | "poor";

/** web.dev's thresholds, judged at the 75th percentile: [good up to, poor above]. */
const thresholds: Record<VitalName, readonly [number, number]> = {
  LCP: [2_500, 4_000],
  INP: [200, 500],
  CLS: [0.1, 0.25],
  FCP: [1_800, 3_000],
  TTFB: [800, 1_800],
};

export function vitalVerdict(name: VitalName, p75: number): VitalVerdict {
  const [good, poor] = thresholds[name];

  if (p75 <= good) return "good";

  return p75 <= poor ? "needs work" : "poor";
}

const time = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** A moment in UTC, "Oct 10, 07:42 UTC": telemetry is compared across time zones. */
export function formatTime(at: Date): string {
  return `${time.format(at)} UTC`;
}
