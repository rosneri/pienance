import { radialPath, wedgePath, type SliceView } from "@pienance/core";
import { cn } from "@pienance/ui/lib/utils";
import { crustFill } from "./crust";

const radius = 100;

/**
 * The pie itself. Each slice keeps its full share of the plate; the baked part
 * is what is left, the dashed part is what was eaten. While the month runs, a thin
 * tick in each slice marks where the baked part would end if eaten exactly on pace.
 */
export function PieDiagram({
  slices,
  label,
  gone,
  className,
}: {
  slices: readonly SliceView[];
  /** Read by screen readers; leave it out when something around the pie already names it. */
  label?: string;
  /** How much of the month is gone, 0..1; no ticks without it. */
  gone?: number;
  className?: string;
}) {
  return (
    <svg
      className={cn("h-auto w-full max-w-80 overflow-visible", className)}
      viewBox="0 0 200 200"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {slices.map((slice, index) => {
        const span = slice.to - slice.from;
        const leftUntil = slice.from + span * slice.left;

        return (
          <g
            key={slice.id}
            className="animate-ink-on"
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <path
              className="fill-plate stroke-border [stroke-dasharray:2_4]"
              d={wedgePath(leftUntil, slice.to, radius)}
            />
            <path className={crustFill(index)} d={wedgePath(slice.from, leftUntil, radius)} />
            <path
              className="fill-none stroke-background stroke-3"
              d={wedgePath(slice.from, slice.to, radius)}
            />
            {gone !== undefined && (
              <path
                data-tick
                className="fill-none stroke-muted-foreground stroke-1"
                d={radialPath(slice.from + span * (1 - gone), radius)}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
