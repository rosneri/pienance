import { asFraction, portionOf, Proportion, roughly, type Serving, type Verdict } from "../domain";
import type { FocusView } from "./focus-view";
import type {
  BiteView,
  CarryOfferView,
  PieView,
  SliceView,
  StapleView,
  WeighingView,
} from "./pie-view";
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

const nowWords: Record<Verdict, string> = {
  fits: "Fits now.",
  tight: "Tight now.",
  overflows: "Too big now.",
};

const eachMonthWords: Record<Verdict, string> = {
  fits: "and fits",
  tight: "and fits, but tightly",
  overflows: "and is still too big",
};

/** The answer to "is it worth it?", in one or two sentences. */
export function describeWeighing(view: WeighingView): string {
  if (view.spread) {
    return `${nowWords[view.spread.wholeVerdict]} Spread over ${view.spread.months} months it is ${portionOf(view.ofSlice, view.sliceName)} each month, ${eachMonthWords[view.verdict]}.`;
  }

  switch (view.verdict) {
    case "fits":
      return `Fits. It is ${portionOf(view.ofSlice, view.sliceName)} and leaves ${view.leftAfter} of it.`;
    case "tight":
      return `Tight. It fits, but takes ${view.ofLeftover} of what is left (${view.sliceName}).${staplesClause(view)}`;
    case "overflows":
      return `Too big. It is more than what is left of ${view.sliceName}.${staplesClause(view)}`;
  }
}

/** The verdict alone, for a bite being typed: its portion is shown beside it. */
export function describeVerdict(view: WeighingView): string {
  if (view.spread) {
    return `${nowWords[view.spread.wholeVerdict]} Over ${view.spread.months} months it ${monthlyVerdict(view)}.`;
  }

  switch (view.verdict) {
    case "fits":
      return `Fits: leaves ${portionOf(view.leftAfter, view.sliceName)}.`;
    case "tight":
      return `Tight: it takes ${view.ofLeftover} of what is left (${view.sliceName}).${staplesClause(view)}`;
    case "overflows":
      return `Too big: more than what is left of ${view.sliceName}.${staplesClause(view)}`;
  }
}

/** Names the slice furthest ahead of the month, or null when there is no pace to tell. */
export function describePace(view: PieView): string | null {
  if (view.gone === undefined || view.goneWords === undefined || view.gone < paceFrom) return null;

  const fast = view.slices.filter((slice) => slice.pace === "fast");
  const [fastest] = fast.toSorted((a, b) => (b.ahead ?? 0) - (a.ahead ?? 0));

  if (!fastest) return "Every slice is on pace.";

  const others = fast.filter((slice) => slice !== fastest);

  const afterStaples = fastest.stapledWords ? " after staples" : "";
  const sentence = `${fastest.name} is going fast: ${fastest.eatenWords ?? "some"} eaten${afterStaples}, ${view.goneWords} of the month gone`;

  if (others.length === 0) return `${sentence}.`;

  return `${sentence}, and ${others.map((slice) => slice.name).join(" and ")} too.`;
}

/**
 * One slice, told on its own: what is left, against how much of the month is still to
 * go, and what its staples take. A month that is over just says what was left.
 */
export function describeSlice(slice: SliceView, view: PieView): string {
  if (view.gone === undefined) {
    const staples = slice.stapledWords ? ` Staples took ${slice.stapledWords} of it.` : "";

    return `${capitalise(slice.leftWords)} of ${slice.name} was left in ${view.monthName}.${staples}`;
  }

  const staples = slice.stapledWords
    ? ` Staples take ${slice.stapledWords} of it, so pace counts only the rest: ${slice.eatenWords ?? "nothing"} of it eaten.`
    : "";

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

/** A single view, told in a sentence: a slice tells its pace, a recurrence its share of the pie. */
export function describeFocus(focus: FocusView, view: PieView): string {
  const slice = view.slices.find((candidate) => candidate.id === focus.sliceId);

  if (slice) return describeSlice(slice, view);

  const past = view.gone === undefined;
  const share = focus.ofPieWords;

  if (focus.key === "recurrence:every-month") {
    if (focus.stapleIds.length === 0) return "Nothing comes back every month yet.";

    return `Every month, ${count(focus.stapleIds.length, "staple")} ${past ? "took" : focus.stapleIds.length === 1 ? "takes" : "take"} ${share} of your pie.`;
  }

  if (focus.biteIds.length === 0) {
    return past
      ? `Nothing was eaten once in ${view.monthName}.`
      : "Nothing eaten once this month yet.";
  }

  return `${capitalise(count(focus.biteIds.length, "bite"))} taken once ${past ? `in ${view.monthName} ate` : "this month ate"} ${share} of your pie.`;
}

/** The answer after taking a bite; for a spread, this month's part. */
export function describeTaken(view: BiteView): string {
  const swept = view.swept ? ` Swept ${portionOf(view.swept.portion, view.swept.sliceName)}.` : "";

  if (view.spread) {
    return `Taken over ${view.spread.toCome + 1} months. ${portionOf(view.portion, view.sliceName)} this month.${swept}`;
  }

  return `Taken. ${portionOf(view.portion, view.sliceName)}.${swept}`;
}

/** "Swept this month: a sliver of Savings.", or null when nothing was swept. */
export function describeSwept(view: PieView): string | null {
  if (view.swept.length === 0) return null;

  return `Swept this month: ${view.swept.map((swept) => portionOf(swept.portion, swept.sliceName)).join(" and ")}.`;
}

/** The answer after changing the sweep. */
export function describeSweep(view: PieView): string {
  return view.sweep
    ? `Bites now round up to the next ${view.sweep.step} into ${view.sweep.sliceName}.`
    : "The sweep is off. Past sweeps stay.";
}

/** The answer after moving a bite, restating where it went. */
export function describeMoved(view: BiteView): string {
  return `Moved. ${portionOf(view.portion, view.sliceName)}.`;
}

/** The answer after putting a bite back. */
export const putBackSentence = "Put back.";

/** What new slice sizes would do to this month's bites, before they are saved. */
export interface ReslicePreview {
  readonly verdict: Extract<Verdict, "fits" | "overflows">;
  readonly sentence: string;
}

/** "Every slice still fits.", or names the first slice the new sizes would leave all eaten. */
export function describeReslice(servings: readonly Serving[]): ReslicePreview {
  const eaten = servings.find((serving) => !serving.retired && serving.left.ratio === 0);

  return eaten
    ? { verdict: "overflows", sentence: `${eaten.slice.name} would be all eaten.` }
    : { verdict: "fits", sentence: "Every slice still fits." };
}

/** The offer to carry last month's leftover. */
export function describeCarryOffer(view: CarryOfferView): string {
  return `${view.monthName} left ${view.leftoverWords} of your pie.`;
}

/** The answer after carrying last month's leftover. */
export function describeCarried(sliceName: string): string {
  return `Carried into ${sliceName}. It is bigger this month.`;
}

/** Where last month's leftover went: "Savings holds September's leftover." */
export function describeCarry(carry: NonNullable<PieView["carry"]>): string {
  return `${carry.sliceName} holds ${carry.from}'s leftover.`;
}

/** The answer after undoing a carry. */
export const droppedCarrySentence = "Undone. The leftover is back on offer.";

/** The answer after stocking a staple. */
export function describeStaple(view: StapleView): string {
  return `Added. ${view.note || "It"}: ${portionOf(view.portion, view.sliceName)} every month.`;
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
        : `You usually eat ${portionOf(asFraction(Proportion.of(view.usual)), view.sliceName)}.`;
  }
}

/** How a spread's part sits in this month: "fits and leaves about half of Wants". */
function monthlyVerdict(view: WeighingView): string {
  switch (view.verdict) {
    case "fits":
      return `fits and leaves ${portionOf(view.leftAfter, view.sliceName)}`;
    case "tight":
      return "fits, but tightly";
    case "overflows":
      return "is still too big";
  }
}

function staplesClause(view: WeighingView): string {
  return view.stapled === "nothing" ? "" : ` Staples already take ${view.stapled} of it.`;
}

function count(n: number, noun: string): string {
  return n === 1 ? `one ${noun}` : `${n} ${noun}s`;
}

function capitalise(words: string): string {
  return words.charAt(0).toUpperCase() + words.slice(1);
}
