import { describeShelfMonth, type ShelfMonthView } from "@pienance/core";
import { cn } from "@pienance/ui/lib/utils";
import Link from "next/link";
import { PieDiagram } from "./pie-diagram";

/**
 * Past months as small pies, this month first so there is always a way back.
 * One sideways-scrolling row on mobile; it wraps on wider screens.
 */
export function Shelf({ months }: { months: readonly ShelfMonthView[] }) {
  if (months.length === 0) return null;

  return (
    <section className="grid min-w-0 gap-3" aria-labelledby="shelf-heading">
      <h2 id="shelf-heading" className="text-2xl">
        Past months
      </h2>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {months.map((month, index) => (
          <li key={month.month} className="shrink-0 snap-start">
            <Link
              href={index === 0 ? "/" : `/?month=${month.month}`}
              aria-current={month.current ? "page" : undefined}
              aria-label={describeShelfMonth(month)}
              className="group grid w-14 justify-items-center gap-1 rounded-md text-sm text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current=page]:text-foreground"
            >
              <PieDiagram slices={month.slices} className="size-14" />
              <span
                className={cn(
                  "underline-offset-4 group-hover:underline",
                  month.current && "underline decoration-2",
                )}
              >
                {month.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
