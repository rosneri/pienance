# Re-slice

Status: proposed · Depends on: nothing (Put back and move helps empty a retired slice)

## Why

Every pie is 50/30/20 and the income can never change. Fixing either means baking a new pie,
and the repository then returns the newest pie, so this month's bites silently disappear.

## Language

| Term         | Meaning                                                                           |
| ------------ | --------------------------------------------------------------------------------- |
| **Re-slice** | Change the pie's income or its slices (names, shares, adding, removing) in place. |
| **Retired**  | A removed slice: it keeps its past bites but no longer takes a share.             |

## Behaviour

- Shares are picked in steps of 5% and must add up to the whole pie (the existing `Pie.bake`
  rule). The form shows each share roughly ("about a third") next to the number.
- Names are trimmed, 1 to 30 characters, and unique within the pie. A pie keeps at least one
  live slice.
- The income is any amount the pie's currency can hold, above zero. The currency cannot change.
- A preview weighs this month's bites against the new sizes before saving:
  "Wants would be all eaten." / "Every slice still fits."
- Removing a slice retires it. A retired slice takes no share and draws no wedge. It stays in
  the legend only while it has bites in the month shown, as "Retired · still has bites this
  month". Those bites still count against the whole pie until moved or put back.
- Nothing can be weighed or taken from a retired slice: "Wants is retired. Pick another slice."
- Retiring is refused while the slice has an active staple (04), holds this month's carry (07)
  or collects the sweep (09): "Stop Wants's staples first." / "Undo the carry first." /
  "Turn the sweep off first."
- Changing the income keeps every bite; proportions are simply recomputed.
- Changes apply to every month served from this pie, past ones included. That is accepted until
  history matters (see Out of scope).
- Baking again is already not offered once a pie exists; that stays.

## Design

### Core

- `Slice` gains `retired: boolean`. `Pie.bake` accepts retired slices only with share `none`.
  `Money.split` gives a share of none nothing, so a retired slice's size is zero.
- `Pie.reslice({ income?, slices })` returns a new `Pie` with the same id and bites, checking
  every bite still points at a known slice (retired counts) and that at least one slice is
  live. `Pie.weigh` and `Pie.take` throw `PieError` on a retired slice.
- `Serving` gains `retired: boolean`. For a retired slice `eaten` and `left` are `none`
  (there is no size to measure against). `Pie.servings()` skips retired slices with nothing
  eaten this month.
- Use case `reslicePie(ports)({ ownerId, monthlyIncome?, slices: { id?, name, percent }[] })`.
  `percent` is a whole number of 5s; the use case turns it into `Proportion.of(percent / 100)`.
  Missing ids get `ports.newId()`. Known ids not present become retired. Unknown ids throw.
- Use case `previewReslice(ports)(same input)` returns `Serving[]` for the proposed pie without
  saving.
- Presentation: `SliceView` gains `retired`; a retired slice has `from === to` so the diagram
  draws nothing. `describeReslice(servings): string` for the preview sentence: "Every slice
  still fits." when every live slice has something left, else "Wants would be all eaten."
  naming the first slice with nothing left.

### Persistence

- `Slice.retired Boolean @default(false)`; migration via `moon run db:migrate`.
- `save` already upserts slices and the pie's income; it also writes `retired`.

### Web

- Server actions `reslicePie(input): Outcome<PieView>` (with `refresh()`) and
  `previewReslice(input): Outcome<string>` (the sentence).
- A `/reslice` page reachable from the masthead: income field, one row per live slice (name,
  share stepper), add slice, retire slice, live preview line.
- The page's small pie redraws from the shares on the client (angles are shares). The preview
  sentence comes from `previewReslice`, called 300ms after the last change, with "Weighing…"
  meanwhile. Nothing is saved until "Save the pie".
- `WeighForm` and the bite menu (02) list live slices only.
- Masthead: the "Menu" button and `sheet` from the index's UX principles land here.

### Agent tools

- `reslice_pie { monthlyIncome?, slices: { name, percent }[] }`, matching existing slices by
  name (a new name adds a slice, a missing name retires one), plus a read-only
  `preview_reslice` with the same input.
- `bake_pie` is only registered when there is no pie (unchanged).

## UX

- **Entry.** "Re-slice" in the masthead menu (see the index). It opens `/reslice`, a full page,
  not a dialog, because a form with several rows is miserable in a modal on a phone.
- **Layout.** Mobile: a small live pie (160px) on top, the form below, and a sticky bottom bar
  with the total and "Save the pie". Desktop: the pie sticks in the left column, the form on the
  right.
- **Income.** One field, prefilled with `Money.toDecimal()`, with the currency symbol in the
  label, as the weigh form does.
- **Slice rows.** Name input, a stepper "− 30% +" in 5% steps, and the rough words under it
  ("about a third"). The retire button is an icon button labelled "Retire Wants".
  - Shares are the one place numbers appear, because people set them exactly. The rough words
    stay beside them.
- **Total.** A live line: "Shares add up to 95%. Place 5% more." / "Shares add up to 105%.
  Take 5% away." Save stays disabled with that line as its reason, never a silent grey button.
- **Add a slice.** Appends "New slice" at 0% with the name selected for typing. There are three
  crust tones; a fourth slice reuses the first, and the background stroke between wedges keeps
  neighbours apart.
- **Retire.** A slice with bites this month stays visible, greyed: "Retired · still has bites
  this month", with "Keep" to undo before saving. A refused retire shows its reason under the
  row.
- **Preview.** One line under the total, toned like a verdict: "Every slice still fits." or
  "Wants would be all eaten." The small pie redraws as steppers move.
- **Save.** Returns to the home page, where the pie shows the new cut. "Cancel" is a plain link
  back, with nothing saved. Errors from the action land in the answer line above Save.
- **Keyboard.** Steppers respond to arrow keys; each is a labelled spinbutton.

## Acceptance criteria

- [ ] Re-slicing keeps the pie id and every bite; a changed income changes every portion word.
- [ ] Shares that do not add up to 100% are refused, in core and in the form (Save disabled
      with the reason shown).
- [ ] A slice left out of the input becomes retired, keeps its bites, draws no wedge and shows
      in the legend only while it has bites this month.
- [ ] Weighing or taking from a retired slice fails with "Wants is retired. Pick another slice."
- [ ] Retiring the last live slice is refused.
- [ ] Duplicate or empty names are refused.
- [ ] After reload the re-sliced pie has the new income, names, shares and retired flags.
- [ ] The preview sentence updates after changes without saving anything.
- [ ] The weigh form and bite menu never offer a retired slice.
- [ ] `reslice_pie` and `preview_reslice` match slices by name and answer with the page's
      sentences.

## Tests

- Unit: reslice keeps bites, rejects shares not adding up, retires removed slices, refuses bites
  on unknown slices, refuses weigh and take on retired slices, keeps one live slice.
- Integration: re-sliced pie reloads with same bites; retired slice hidden once empty.
- Component: preview updates as shares change; submit disabled until shares add up; retire
  row shows "Keep".
- WebMCP: both tools.

## Out of scope

- Versioned slices so past months keep their old shares.
- Free-form share percentages below 5% steps.
- Changing the pie's currency.

## Open questions

- Should a retired slice's remaining bites be moved automatically into a chosen slice? Until
  decided, they stay and count against the whole pie, and Put back and move (02) handles them.
