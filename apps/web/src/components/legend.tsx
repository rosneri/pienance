import type { SliceView } from "@pienance/core";
import { cn } from "@pienance/ui/lib/utils";
import { crustBackground } from "./crust";

export function Legend({ slices }: { slices: readonly SliceView[] }) {
  return (
    <dl className="grid">
      {slices.map((slice, index) => (
        <div
          key={slice.id}
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b py-3 first:border-t"
        >
          <span className={cn("size-3 rounded-full", crustBackground(index))} aria-hidden />
          <dt className="font-medium">{slice.name}</dt>
          <dd className="text-muted-foreground">{slice.leftWords} left</dd>
        </div>
      ))}
    </dl>
  );
}
