"use client";

import type { SliceView } from "@pienance/core";
import { cn } from "@pienance/ui/lib/utils";
import { crustBackground } from "./crust";
import { useFocus } from "./focus";

/** "about half left · about two thirds staples · going fast" */
function describeRow(slice: SliceView): string {
  if (slice.retired) return "Retired · still has bites this month";

  return [
    `${slice.leftWords} left`,
    slice.stapledWords && `${slice.stapledWords} staples`,
    slice.pace === "fast" && "going fast",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** One row per slice; each row focuses its slice, like tapping it in the pie. */
export function Legend({ slices }: { slices: readonly SliceView[] }) {
  const { focused, toggle } = useFocus();

  return (
    <ul className="grid">
      {slices.map((slice, index) => (
        <li key={slice.id} className="border-b first:border-t">
          <button
            type="button"
            aria-pressed={focused?.sliceId === slice.id}
            disabled={!toggle || slice.retired}
            onClick={() => toggle?.(`slice:${slice.id}`)}
            data-track="focus-slice"
            className={cn(
              "grid min-h-11 w-full grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 py-3 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default enabled:cursor-pointer",
              ((focused?.kind === "slice" && focused.sliceId !== slice.id) || slice.retired) &&
                "opacity-50",
            )}
          >
            <span className={cn("size-3 rounded-full", crustBackground(index))} aria-hidden />
            <span className="font-medium">{slice.name}</span>
            <span className="text-end text-muted-foreground">{describeRow(slice)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
