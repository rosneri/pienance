import { wedgePath, type SliceView } from "@pienance/core";
import { crustFill } from "./crust";

const radius = 100;

/**
 * The pie itself. Each slice keeps its full share of the plate; the baked part
 * is what is left, the dashed part is what was eaten.
 */
export function PieDiagram({ slices, label }: { slices: readonly SliceView[]; label: string }) {
  return (
    <svg
      className="h-auto w-full max-w-80 overflow-visible"
      viewBox="0 0 200 200"
      role="img"
      aria-label={label}
    >
      {slices.map((slice, index) => {
        const leftUntil = slice.from + (slice.to - slice.from) * slice.left;

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
          </g>
        );
      })}
    </svg>
  );
}
