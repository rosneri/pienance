"use client";

import { describeFocus, type PieView } from "@pienance/core";
import { Button } from "@pienance/ui/components/button";
import { cn } from "@pienance/ui/lib/utils";
import { useFocus } from "./focus";

/**
 * Under the pie: the single views that cut across slices, and the view on screen told
 * in a sentence (or how to read the pie while it shows the overview).
 */
export function FocusStory({ pie }: { pie: PieView }) {
  const { focused, toggle } = useFocus();
  const across = pie.focuses.filter((focus) => focus.kind !== "slice");

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Single views">
        {across.map((focus) => (
          <Button
            key={focus.key}
            variant="outline"
            className={cn("h-11", focused?.key === focus.key && "border-foreground bg-secondary")}
            aria-pressed={focused?.key === focus.key}
            onClick={() => toggle?.(focus.key)}
            data-track="focus"
          >
            {focus.name}
          </Button>
        ))}
      </div>
      <div className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2" role="status">
        {focused ? (
          <>
            <p className="max-w-[60ch]">{describeFocus(focused, pie)}</p>
            <Button
              variant="outline"
              className="h-11"
              onClick={() => toggle?.(null)}
              data-track="show-all"
            >
              Show all
            </Button>
          </>
        ) : (
          <p className="max-w-[60ch] text-sm text-muted-foreground">
            {pie.gone === undefined
              ? "Tap a slice, or every month or one time, to see only its part."
              : "The hatching shows how much of each slice the month has used so far. Tap a slice for its pace, or every month or one time, to see only that part."}
          </p>
        )}
      </div>
    </div>
  );
}
