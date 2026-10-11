"use client";

import { wedgePath, type SliceView } from "@pienance/core";
import { cn } from "@pienance/ui/lib/utils";
import { useId } from "react";
import { crustFill } from "./crust";
import { useFocus } from "./focus";

const radius = 100;

/** Below this much of the month gone there is no pace to show. */
const paceFrom = 0.04;

/**
 * The pie itself. Each slice keeps its full share of the plate; the baked part
 * is what is left, the dashed part is what was eaten. While the month runs, a light
 * hatch covers the share of each slice the month has used so far: eaten past the
 * hatch means eaten faster than the month. Tapping a slice focuses it.
 */
export function PieDiagram({
  slices,
  label,
  gone,
  interactive = false,
  className,
}: {
  slices: readonly SliceView[];
  /** Read by screen readers; leave it out when something around the pie already names it. */
  label?: string;
  /** How much of the month is gone, 0..1; no hatch without it. */
  gone?: number;
  /** Tapping a slice focuses it (the legend does the same for keyboards). */
  interactive?: boolean;
  className?: string;
}) {
  const hatch = useId();
  const { focused, toggle } = useFocus();
  const paced = gone !== undefined && gone >= paceFrom;

  return (
    <svg
      className={cn("h-auto w-full max-w-80 overflow-visible", className)}
      viewBox="0 0 200 200"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {paced && (
        <defs>
          <pattern
            id={hatch}
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="5" className="stroke-foreground/35 stroke-[1.5]" />
          </pattern>
        </defs>
      )}
      {slices.map((slice, index) => {
        const span = slice.to - slice.from;
        const leftUntil = slice.from + span * slice.left;
        // Only a slice's own view isolates it; views across slices leave the pie whole.
        const dimmed = focused?.kind === "slice" && focused.sliceId !== slice.id;

        return (
          <g
            key={slice.id}
            data-slice={slice.id}
            className={cn(
              "animate-ink-on transition-opacity duration-200",
              dimmed && "opacity-25",
              interactive && "cursor-pointer",
            )}
            style={{ animationDelay: `${index * 90}ms` }}
            {...(interactive && toggle && { onClick: () => toggle(`slice:${slice.id}`) })}
          >
            <path
              className="fill-plate stroke-border [stroke-dasharray:2_4]"
              d={wedgePath(leftUntil, slice.to, radius)}
            />
            <path className={crustFill(index)} d={wedgePath(slice.from, leftUntil, radius)} />
            {paced && (
              <path
                data-pace
                fill={`url(#${hatch})`}
                d={wedgePath(slice.from + span * (1 - (gone ?? 0)), slice.to, radius)}
              />
            )}
            <path
              className="fill-none stroke-background stroke-3"
              d={wedgePath(slice.from, slice.to, radius)}
            />
          </g>
        );
      })}
    </svg>
  );
}
