import type { Month } from "../domain";

const long = new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" });

const short = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });

/** "October" */
export function monthName(month: Month): string {
  return long.format(month.start);
}

/** "Oct" */
export function shortMonthName(month: Month): string {
  return short.format(month.start);
}
