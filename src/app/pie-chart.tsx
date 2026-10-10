import type { Serving } from "@/domain";

const colors = ["var(--needs)", "var(--wants)", "var(--savings)", "var(--extra)"];

/** Each slice is drawn at its share of the pie; the eaten part of it is faded. */
export function PieChart({ servings }: { servings: readonly Serving[] }) {
  const stops = servings.flatMap((serving, index) => {
    const from = servings.slice(0, index).reduce((sum, s) => sum + s.slice.share.ratio * 100, 0);
    const to = from + serving.slice.share.ratio * 100;
    const leftUntil = from + Math.min(serving.left.ratio, 1) * (to - from);
    const color = colors[index % colors.length];
    return [`${color} ${from}% ${leftUntil}%`, `var(--eaten) ${leftUntil}% ${to}%`];
  });

  return (
    <div
      className="pie"
      role="img"
      aria-label="Pie of what is left per slice"
      style={{ background: `conic-gradient(${stops.join(", ")})` }}
    />
  );
}
