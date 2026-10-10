import { wedgePath, type SliceView } from "@pienance/core";

const radius = 100;

const crusts = ["var(--color-crust-1)", "var(--color-crust-2)", "var(--color-crust-3)"];

export function crustOf(index: number): string {
  return crusts[index % crusts.length] ?? "var(--color-crust-1)";
}

/**
 * The pie itself. Each slice keeps its full share of the plate; the baked part
 * is what is left, the dashed part is what was eaten.
 */
export function PieDiagram({ slices, label }: { slices: readonly SliceView[]; label: string }) {
  return (
    <svg className="pie" viewBox="0 0 200 200" role="img" aria-label={label}>
      {slices.map((slice, index) => {
        const leftUntil = slice.from + (slice.to - slice.from) * slice.left;

        return (
          <g key={slice.id} className="pie__wedge" style={{ animationDelay: `${index * 90}ms` }}>
            <path className="pie__crumbs" d={wedgePath(leftUntil, slice.to, radius)} />
            <path fill={crustOf(index)} d={wedgePath(slice.from, leftUntil, radius)} />
            <path className="pie__gap" d={wedgePath(slice.from, slice.to, radius)} />
          </g>
        );
      })}
    </svg>
  );
}
