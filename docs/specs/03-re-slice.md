# Re-slice

Status: proposed · Depends on: nothing (Put back and move helps with removed slices)

## Why

Every pie is 50/30/20 and the income can never change. Fixing either means baking a new pie,
and the repository then returns the newest pie, so this month's bites silently disappear.

## Language

| Term         | Meaning                                                                           |
| ------------ | --------------------------------------------------------------------------------- |
| **Re-slice** | Change the pie's income or its slices (names, shares, adding, removing) in place. |
| **Retired**  | A removed slice: it keeps its past bites but no longer takes a share.             |

## Behaviour

- Shares are picked in steps of 5% and must add up to the whole pie (existing `Pie.bake` rule).
  The form shows each share roughly ("about a third") next to the number.
- A preview weighs this month's bites against the new sizes before saving:
  "Wants would be all eaten." / "Every slice still fits."
- Removing a slice retires it. It disappears from the pie once it has no bites in the month
  shown. Its bites this month count against the whole pie until moved.
- Changing the income keeps every bite; proportions are simply recomputed.
- Changes apply to every month served from this pie, past ones included. That is accepted until
  history matters (see open questions).
- Baking again is no longer offered once a pie exists.

## Design

### Core

- `Slice` gains `retired: boolean`. `Pie.bake` accepts retired slices with share none.
- `Pie.reslice({ income?, slices })` returns a new `Pie` with the same id and bites, checking
  every bite still points at a known slice (retired counts).
- `Pie.servings()` skips retired slices with nothing eaten this month.
- Use case `reslicePie(ports)({ ownerId, monthlyIncome?, slices: { id?, name, share }[] })`.
  Missing ids get `ports.newId()`. Ids no longer present become retired.
- Use case `previewReslice` returns servings for the proposed pie without saving.
- Presentation: `describeReslice(servings)` for the preview sentence.

### Persistence

- `Slice.retired Boolean @default(false)`; migration via `moon run db:migrate`.
- `save` already upserts slices; it also writes `retired`.

### Web

- A "Re-slice" view reachable from the masthead: income field, one row per slice (name, share
  radio steps or `native-select`), add slice, retire slice, live preview line.
- The pie diagram on the page renders the preview while editing.

### Agent tools

- `reslice_pie { monthlyIncome?, slices: { name, percent }[] }`, matching existing slices by
  name, plus a read-only `preview_reslice` with the same input.
- `bake_pie` is only registered when there is no pie (unchanged).

## UX

- **Entry.** "Re-slice" in the masthead menu (see the index). It opens `/reslice`, a full page,
  not a dialog, because a form with several rows is miserable in a modal on a phone.
- **Layout.** Mobile: a small live pie (160px) on top, the form below, and a sticky bottom bar
  with the total and "Save the pie". Desktop: the pie sticks in the left column, the form on the
  right.
- **Income.** One field, prefilled, with the currency symbol in the label.
- **Slice rows.** Name input, a stepper "− 30% +" in 5% steps, and the rough words under it
  ("about a third"). The retire button is an icon labelled "Retire Wants".
  - Shares are the one place numbers appear, because people set them exactly. The rough words
    stay beside them.
- **Total.** A live line: "Shares add up to 95%. Place 5% more." Save stays disabled with that
  line as its reason, never a silent grey button.
- **Add a slice.** Appends "New slice" at 0% with the name selected for typing.
- **Retire.** A slice with bites this month stays visible, greyed: "Retired · still has bites
  this month", with "Keep" to undo.
- **Preview.** One line under the total, toned like a verdict: "Every slice still fits." or
  "Wants would be all eaten." The small pie redraws as steppers move.
- **Save.** Returns to the home page, where the pie shows the new cut. "Cancel" is a plain link
  back, with nothing saved.
- **Keyboard.** Steppers respond to arrow keys; each is a labelled spinbutton.

## Tests

- Unit: reslice keeps bites, rejects shares not adding up, retires removed slices, refuses bites
  on unknown slices.
- Integration: re-sliced pie reloads with same bites; retired slice hidden once empty.
- Component: preview updates as shares change; submit disabled until shares add up.

## Out of scope

- Versioned slices so past months keep their old shares.
- Free-form share percentages below 5% steps.

## Open questions

- Should a retired slice's remaining bites be moved automatically into a chosen slice?
