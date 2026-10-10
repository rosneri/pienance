import type { WeighingView } from "./pie-view";

/** The headline: how much of the whole pie is left, in words. */
export function describeLeftover(leftoverWords: string): string {
  if (leftoverWords === "nothing") return "Your pie is all eaten.";

  if (leftoverWords === "all") return "Your whole pie is left.";

  return `${capitalise(leftoverWords)} of your pie is left.`;
}

/** The answer to "is it worth it?", in one or two sentences. */
export function describeWeighing(view: WeighingView): string {
  switch (view.verdict) {
    case "fits":
      return `Fits. It is ${view.ofSlice} of your ${view.sliceName} slice and leaves ${view.leftAfter} of it.`;
    case "tight":
      return `Tight. It fits, but takes ${view.ofLeftover} of what is left of ${view.sliceName}.`;
    case "overflows":
      return `Too big. It is more than what is left of ${view.sliceName}.`;
  }
}

function capitalise(words: string): string {
  return words.charAt(0).toUpperCase() + words.slice(1);
}
