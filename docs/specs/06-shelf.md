# Shelf

Status: proposed · Depends on: nothing

## Why

The month resets on the 1st and the past is gone from view. The person cannot answer "how did
last month go?" even though every bite is still stored.

## Language

| Term      | Meaning                                                    |
| --------- | ---------------------------------------------------------- |
| **Shelf** | The past months of a pie, each shown as its own small pie. |

## Behaviour

- Under the main pie, a row of small pies, one per past month, newest first, up to 12.
- Months before the pie was baked are not shown. Months with no bites are shown, untouched.
- Each small pie uses the same geometry and crust colours, labelled with the month's short name
  and its leftover words for screen readers.
- Tapping one opens that month read-only: pie, legend and bites, with a way back. No weigh or
  take form, no bite menus, no pace line.
- Past months are drawn with today's income and slices. See Re-slice and the index.
- A month in the URL that is not on the shelf (junk, before baking, the future) shows this
  month, quietly.
- Interactions:
  - Staples (04): a past month shows the staples that were active then.
  - Carry over (07): a past month shows its own carry in the legend.
  - Spread (05): parts appear in their months.
  - Shared pie (13): the shelf is the pie's, so everyone sees the same months.

## Design

### Core

- `Pie` gains `bakedAt: Date`, so `Month.of(pie.bakedAt)` bounds the shelf. `Pie.bake` takes
  it; `bakePie` passes `ports.now()`.
- `Month.parse(text: string): Month | null` for "2026-09" only, and `Month.toString()` giving
  the same form. `Month.previous()` if Staples (04) did not add it yet.
- `servePie(ports)(ownerId, month?: Month)` serves any month; defaults to the current one.
- Use case `shelvePie(ports)({ ownerId, months })` returns `{ month: Month, pie: Pie }[]` for
  the past months, newest first, stopping at the baking month. It calls `find` once per
  month. A batched repository method can come later if needed.
- Presentation: `viewShelf(entries, current: Month)` gives
  `{ month: string, label: string, slices: SliceView[], leftoverWords: string, current: boolean }[]`,
  the current month first. `describeLeftover` gains a past form: "About a tenth of September's
  pie was left."

### Persistence

- `bakedAt` maps from the existing `Pie.createdAt` column. No migration.

### Web

- `/?month=2026-09` renders a past month. `page.tsx` parses it with `Month.parse`, checks it
  is on the shelf, and falls back to now.
- `readPie(month?)` in `pie-actions`. For a past month it passes no `gone` to `viewPie`
  (see Pace).
- `Shelf` component: horizontal scroll on mobile, wraps on desktop. Each pie is a link.
- The masthead shows the served month's name.
- `PieTools` on a past month registers `read_pie` and `read_shelf` only.

### Agent tools

- `read_pie` gains optional `month` ("2026-09"); an unknown month answers "That month is not
  on the shelf."
- New `read_shelf`, read-only, returning one line per month: "September: about a tenth left".

## UX

- **Where.** A "Past months" section under the legend, in the pie's column. It is hidden until
  the first month after baking has begun.
- **Row.** Small pies, 56px, with the short month under each ("Sep"). The current month comes
  first, so there is always a way back.
  - Mobile: one row that scrolls sideways inside itself, with scroll snapping. The last pie is
    cut by the edge so the row looks scrollable. The page itself never scrolls sideways.
  - Desktop: the row wraps.
- **Selected.** The month on screen is marked with `aria-current="page"` and an underline under
  its label, not colour alone.
- **Past month page.** The headline turns to the past tense: "About a tenth of September's pie
  was left." The weigh form and bite menus are gone. A line above the pie says
  "You are looking at September. Back to October." where "Back to October" is a link to `/`.
- **Accessibility.** Each pie is a link labelled "September: about a tenth left".
- **States.** Rendered on the server; no spinners.

## Acceptance criteria

- [ ] `Month.parse` accepts "2026-09" and rejects "2026-9", "09-2026", "2026-13" and junk.
- [ ] The shelf lists past months newest first, stops at the baking month, and holds at most 12.
- [ ] A month with no bites appears as a whole pie.
- [ ] `/?month=` with junk, a month before baking or a future month renders this month.
- [ ] A past month page has no weigh form, no bite menus, no pace line, and a link back.
- [ ] The current month is first in the row and marked `aria-current="page"`.
- [ ] `read_pie { month }` serves that month; `read_shelf` lists one line per past month.

## Tests

- Unit: `Month.parse` rejects junk; shelf stops at the baking month and at 12.
- Integration: bites appear only in their month; current month unaffected.
- Component: shelf links; read-only page hides forms.
- WebMCP: `read_pie` with `month`, `read_shelf`.

## Out of scope

- Charts or totals across months (see Appetite).
- Keeping each month's income and shares as they were.
