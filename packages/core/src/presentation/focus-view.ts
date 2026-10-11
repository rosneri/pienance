import { cutsOf, focusOn, RecurrenceCut, roughly, SliceCut, type Cut, type Pie } from "../domain";

/** A single view of the pie, through one cut, as plain data. */
export interface FocusView {
  /** The cut's key, e.g. "slice:wants". */
  readonly key: string;
  readonly kind: "slice" | "recurrence";
  readonly name: string;
  /** The slice it is, for a slice. */
  readonly sliceId?: string;
  /** Of the cut's whole: the slice for a slice, the whole pie otherwise. */
  readonly eatenWords: string;
  readonly leftWords: string;
  readonly ofPieWords: string;
  readonly biteIds: readonly string[];
  readonly stapleIds: readonly string[];
}

/** Every single view the pie offers besides the overview. */
export function viewFocuses(pie: Pie): FocusView[] {
  return cutsOf(pie).flatMap((cut) => {
    const kind = kindOf(cut);

    if (!kind) return [];

    const focus = focusOn(pie, cut);

    return [
      {
        key: cut.key,
        kind,
        name: cut.name,
        ...(cut instanceof SliceCut && { sliceId: cut.slice.id }),
        eatenWords: roughly(focus.eaten),
        leftWords: roughly(focus.left),
        ofPieWords: roughly(focus.ofPie),
        biteIds: focus.food.flatMap(({ kind: food, item }) => (food === "bite" ? [item.id] : [])),
        stapleIds: focus.food.flatMap(({ kind: food, item }) =>
          food === "staple" ? [item.id] : [],
        ),
      },
    ];
  });
}

function kindOf(cut: Cut): FocusView["kind"] | null {
  if (cut instanceof SliceCut) return "slice";

  if (cut instanceof RecurrenceCut) return "recurrence";

  return null;
}
