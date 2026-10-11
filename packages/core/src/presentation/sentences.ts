import { Proportion, roughly } from "../domain";
import type { PieView, SliceView, StapleView, WeighingView } from "./pie-view";
import type { AppetiteView, ShelfMonthView } from "./shelf-view";

/** Below this much of the month gone, there is no pace to speak of: "nothing" or "a crumb". */
const paceFrom = 0.04;

/** At most this many appetite sentences, so they stay a glance. */
const appetiteSentences = 2;

/** The headline: how much of the whole pie is left, in words. */
export function describeLeftover(leftoverWords: string): string {
  if (leftoverWords === "nothing") return "Your pie is all eaten.";

  if (leftoverWords === "all") return "Your whole pie is left.";

  return `${capitalise(leftoverWords)} of your pie is left.`;
}

/** The headline of a month that is over. */
export function describePastLeftover(leftoverWords: string, monthName: string): string {
  if (leftoverWords === "nothing") return `${monthName}'s pie was all eaten.`;

  if (leftoverWords === "all") return `${monthName}'s whole pie was left.`;

  return `${capitalise(leftoverWords)} of ${monthName}'s pie was left.`;
}

/** The answer to "is it worth it?", in one or two sentences. */
export function describeWeighing(view: WeighingView): string {
  switch (view.verdict) {
    case "fits":
      return `Fits. It is ${view.ofSlice} of your ${view.sliceName} slice and leaves ${view.leftAfter} of it.`;
    case "tight":
      return `Tight. It fits, but takes ${view.ofLeftover} of what is left of ${view.sliceName}.${staplesClause(view)}`;
    case "overflows":
      return `Too big. It is more than what is left of ${view.sliceName}.${staplesClause(view)}`;
  }
}

/** Names the slice furthest ahead of the month, or null when there is no pace to tell. */
export function describePace(view: PieView): string | null {
  if (view.gone === undefined || view.goneWords === undefined || view.gone < paceFrom) return null;

  const fast = view.slices.filter((slice) => slice.pace === "fast");
  const [fastest] = fast.toSorted((a, b) => (b.ahead ?? 0) - (a.ahead ?? 0));

  if (!fastest) return "Every slice is on pace.";

  const others = fast.filter((slice) => slice !== fastest);

  const sentence = `${fastest.name} is going fast: ${fastest.eatenWords ?? "some"} eaten, ${view.goneWords} of the month gone`;

  if (others.length === 0) return `${sentence}.`;

  return `${sentence}, and ${others.map((slice) => slice.name).join(" and ")} too.`;
}

/**
 * One slice, told on its own: what is left, against how much of the month is still to
 * go, and what its staples take. A month that is over just says what was left.
 */
export function describeSlice(slice: SliceView, view: PieView): string {
  const staples = slice.stapledWords ? ` Staples take ${slice.stapledWords} of it.` : "";

  if (view.gone === undefined) {
    return `${capitalise(slice.leftWords)} of ${slice.name} was left in ${view.monthName}.${staples}`;
  }

  const toGo = roughly(Proportion.of(1 - view.gone));
  const left = `${slice.leftWords} of it is left, with ${toGo} of ${view.monthName} to go`;

  switch (slice.pace ?? "steady") {
    case "fast":
      return `${slice.name} is going fast: ${left}.${staples}`;
    case "slow":
      return `${slice.name} is going slowly: ${left}.${staples}`;
    case "steady":
      return `${slice.name} is on pace: ${left}.${staples}`;
  }
}

/** The answer after stocking a staple. */
export function describeStaple(view: StapleView): string {
  return `Added. ${view.note || "It"} takes ${view.portionWords} of ${view.sliceName} every month.`;
}

/** The answer after dropping a staple. */
export function describeDropped(view: StapleView): string {
  const name = view.note || "It";

  return view.endsAfter
    ? `Stopped. ${name} ends after ${view.endsAfter}.`
    : `Removed. ${name} no longer counts.`;
}

/** One month on the shelf, e.g. "September: about a tenth left". */
export function describeShelfMonth(view: ShelfMonthView): string {
  return `${view.name}: ${view.leftoverWords} left`;
}

export interface AppetiteSentence {
  readonly sentence: string;
  readonly streak?: AppetiteView["streak"];
}

/** At most two sentences: streaks first, then the slice whose usual is furthest from all of it. */
export function describeAppetite(views: readonly AppetiteView[]): AppetiteSentence[] {
  const streaks = views.filter((view) => view.streak);

  const [furthest] = views
    .filter((view) => !view.streak)
    .toSorted((a, b) => Math.abs(1 - b.usual) - Math.abs(1 - a.usual));

  return [...streaks, ...(furthest ? [furthest] : [])].slice(0, appetiteSentences).map((view) => ({
    sentence: appetiteSentence(view),
    ...(view.streak && { streak: view.streak }),
  }));
}

function appetiteSentence(view: AppetiteView): string {
  switch (view.streak) {
    case "overflowing":
      return `${view.sliceName} has overflowed three months running.`;
    case "leftover":
      return `${view.sliceName} usually has more than half left.`;
    case undefined:
      return view.usualWords === "nothing"
        ? `You usually leave ${view.sliceName} untouched.`
        : `You usually eat ${view.usualWords} of ${view.sliceName}.`;
  }
}

function staplesClause(view: WeighingView): string {
  return view.stapled === "nothing" ? "" : ` Staples already take ${view.stapled} of it.`;
}

function capitalise(words: string): string {
  return words.charAt(0).toUpperCase() + words.slice(1);
}
