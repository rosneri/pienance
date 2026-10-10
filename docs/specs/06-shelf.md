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
- Tapping one opens that month read-only: pie, legend and bites, with a "Back to <month>" link.
  No weigh or take form.
- Past months are drawn with today's income and slices. See Re-slice.

## Design

### Core

- `Pie` gains `bakedAt: Date`, so `Month.of(pie.bakedAt)` bounds the shelf.
- `Month.parse("2026-09")`, `Month.toString()`, `Month.previous()`.
- `servePie(ports)(ownerId, month?)` serves any month; defaults to the current one.
- Use case `shelvePie(ports)({ ownerId, months })` returns `{ month, pie }[]` for past months.
  It calls `find` once per month. A batched repository method can come later if needed.
- Presentation: `viewShelf(entries)` → `{ month: string, label: string, slices, leftoverWords }[]`.

### Persistence

- `bakedAt` maps from the existing `Pie.createdAt` column. No migration.

### Web

- `/?month=2026-09` renders a past month; invalid or future months fall back to now.
- `Shelf` component: horizontal scroll on mobile, wraps on desktop. Each pie is a link.
- The masthead shows the served month's name.

### Agent tools

- `read_pie` gains optional `month` ("2026-09").
- New `read_shelf` returning one line per month: "September: about a tenth left".

## UX

- **Where.** A "Past months" section under the legend, in the pie's column. It is hidden until
  the first month has passed.
- **Row.** Small pies, 56px, with the short month under each ("Sep"). The current month comes
  first, so there is always a way back.
  - Mobile: one row that scrolls sideways inside itself, with scroll snapping. The last pie is
    cut by the edge so the row looks scrollable. The page itself never scrolls sideways.
  - Desktop: the row wraps.
- **Selected.** The month on screen is marked with `aria-current="page"` and an underline under
  its label, not colour alone.
- **Past month page.** The headline turns to the past tense: "About a tenth of September's pie
  was left." The weigh form and bite menus are gone. A line above the pie says
  "You are looking at September. Back to October."
- **Accessibility.** Each pie is a link labelled "September: about a tenth left".
- **States.** Rendered on the server; no spinners. An unknown month quietly shows this month.

## Tests

- Unit: `Month.parse` rejects junk; shelf stops at the baking month.
- Integration: bites appear only in their month; current month unaffected.
- Component: shelf links; read-only page hides forms.
- WebMCP: `read_pie` with `month`, `read_shelf`.

## Out of scope

- Charts or totals across months (see Appetite).
- Keeping each month's income and shares as they were.
