import type { SliceView } from "@pienance/core";
import { cn } from "@pienance/ui/lib/utils";
import { crustBackground } from "./crust";

/** "about half left · about two thirds staples · going fast" */
function describeRow(slice: SliceView): string {
  return [
    `${slice.leftWords} left`,
    slice.stapledWords && `${slice.stapledWords} staples`,
    slice.pace === "fast" && "going fast",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function Legend({ slices }: { slices: readonly SliceView[] }) {
  return (
    <dl className="grid">
      {slices.map((slice, index) => (
        <div
          key={slice.id}
          className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 border-b py-3 first:border-t"
        >
          <span className={cn("size-3 rounded-full", crustBackground(index))} aria-hidden />
          <dt className="font-medium">{slice.name}</dt>
          <dd className="text-end text-muted-foreground">{describeRow(slice)}</dd>
        </div>
      ))}
    </dl>
  );
}
