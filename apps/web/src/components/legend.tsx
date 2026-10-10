import type { SliceView } from "@pienance/core";
import { crustOf } from "./pie-diagram";

export function Legend({ slices }: { slices: readonly SliceView[] }) {
  return (
    <dl className="legend">
      {slices.map((slice, index) => (
        <div key={slice.id} className="legend__row">
          <span className="swatch" style={{ background: crustOf(index) }} aria-hidden />
          <dt>{slice.name}</dt>
          <dd>{slice.leftWords} left</dd>
        </div>
      ))}
    </dl>
  );
}
