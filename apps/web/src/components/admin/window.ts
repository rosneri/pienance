/** How far back the admin pages look. Telemetry keeps 14 days of raw data. */
export const adminWindows = [
  { id: "1d", label: "Day", days: 1 },
  { id: "7d", label: "Week", days: 7 },
  { id: "14d", label: "Two weeks", days: 14 },
] as const;

export type AdminWindow = (typeof adminWindows)[number];

/** The window a `?window=` value asks for; a day when it asks for nothing known. */
export function adminWindowOf(id: string | undefined): AdminWindow {
  return adminWindows.find((window) => window.id === id) ?? adminWindows[0];
}

export function windowStart(window: AdminWindow, now: Date): Date {
  return new Date(now.getTime() - window.days * 24 * 60 * 60 * 1000);
}
