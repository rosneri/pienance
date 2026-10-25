import type { ShelfMonthView } from "@pienance/core";
import Link from "next/link";

function hrefOf(months: readonly ShelfMonthView[], index: number): string {
  return index === 0 ? "/" : `/?month=${months[index]?.month ?? ""}`;
}

/**
 * Steps a month back or forward through the shelf: this month first, then the past
 * ones newest first. Nothing to step through before a month has passed.
 */
export function MonthNav({ months, month }: { months: readonly ShelfMonthView[]; month: string }) {
  const index = months.findIndex((shelved) => shelved.month === month);

  if (index === -1) return null;

  const older = months[index + 1];
  const newer = index > 0 ? months[index - 1] : undefined;

  return (
    <nav aria-label="Months" className="flex items-center gap-4 text-sm">
      {older && (
        <Link
          href={hrefOf(months, index + 1)}
          className="inline-flex min-h-11 items-center underline decoration-berry underline-offset-4"
          data-track="month-older"
        >
          ← {older.name}
        </Link>
      )}
      {newer && (
        <Link
          href={hrefOf(months, index - 1)}
          className="ms-auto inline-flex min-h-11 items-center underline decoration-berry underline-offset-4"
          data-track="month-newer"
        >
          {newer.name} →
        </Link>
      )}
    </nav>
  );
}
