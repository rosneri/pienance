# Re-slice

Status: proposed · Depends on: nothing (Put back and move helps with removed slices)

## Why

Every pie is 50/30/20 and the income can never change. Fixing either means baking a new pie,
and the repository then returns the newest pie, so this month's bites silently disappear.

## Language

| Term         | Meaning                                                                        |
| ------------ | ------------------------------------------------------------------------------ |
| **Re-slice** | Change the pie's income or its slices (names, shares, adding, removing) in place. |
| **Retired**  | A removed slice: it keeps its past bites but no longer takes a share.          |

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
