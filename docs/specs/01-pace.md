# Pace

Status: proposed · Depends on: nothing

## Why

"About half of Wants is left" means one thing on the 3rd and another on the 27th. Pace tells the
person whether they are eating a slice faster or slower than the month is passing.

## Language

| Term     | Meaning                                                                |
| -------- | ---------------------------------------------------------------------- |
| **Pace** | How fast a slice is eaten compared with how much of the month is gone. |
| `fast`   | Eaten well ahead of the month.                                         |
| `steady` | Eaten about as fast as the month passes.                               |
| `slow`   | Eaten well behind the month.                                           |

## Behaviour

- Month gone: the share of the month elapsed at `now`, in time, from `Month.start` (inclusive)
  to `Month.end` (exclusive), clamped to 0..1. Months are UTC, as everywhere.
- A slice is `fast` when `eaten > gone + 0.1`, `slow` when `eaten < gone - 0.1`, else `steady`.
  The 0.1 band avoids flicker on day one and on small bites.
- A slice that overflowed (`eaten` is the whole or more) is always `fast`.
- A slice with nothing eaten is `slow` once more than a tenth of the month is gone, and
  `steady` before that. Nothing special is said about it.
- Examples (Wants, on the 10th of a 30-day month, a third gone):
  - half eaten: "Wants is going fast: about half eaten, about a third of the month gone."
  - a third eaten: steady.
  - a tenth eaten: slow.
- The headline stays the leftover sentence. Pace is a second line under it. It names the
  fastest slice (the one whose `eaten - gone` is largest), or says "Every slice is on pace."
  when none is fast. Slow slices are never called out.
- The line is hidden while less than 0.04 of the month is gone (`roughly(gone)` is "nothing" or
  "a crumb"), so day one has no pace.
- Interactions:
  - Staples (04) count as eaten from day one, so a slice with rent would be `fast` all month.
    Once Staples is built, pace compares the part of the slice not taken by staples:
    `(eaten - stapled) / (1 - stapled)` against `gone`. A slice whose staples take all of it
    is `fast` when anything else was eaten, else `steady`.
  - Carry over (07) makes a slice bigger. `eaten` is already measured against the bigger size.
  - Re-slice (03): retired slices have no pace.
  - Shelf (06): a past month has no pace line and no tick. The month is over.

## Design

### Core

- `domain/month.ts`: `Month.gone(at: Date): Proportion`, clamped to 0..1. Before `start` it is
  `none`; at or after `end` it is `whole`.
- `domain/pace.ts`: `type Pace = "fast" | "steady" | "slow"` and
  `paceOf(serving: Serving, gone: Proportion): Pace`. Pure, no `Pie` change. It compares the
  plain ratios; `Proportion` has no arithmetic and needs none here.
- `presentation/pie-view.ts`: `viewPie(pie, options?: { gone?: Proportion })`. With `gone`,
  `SliceView` gains `pace: Pace` and `eatenWords`, and `PieView` gains `gone` (0..1, for
  drawing) and `goneWords`. Without it (past months, existing tests), nothing is added.
- `presentation/sentences.ts`: `describePace(view: PieView): string | null`. `null` when the
  view has no `gone` or `gone < 0.04`.
- `servePie` is unchanged. The caller passes `Month.of(now).gone(now)`.

### Persistence

None.

### Web

- `PieActionsDeps` gains `now: () => Date`, wired in `app/actions.ts` from the `clock` that
  `pienance.ts` already exports. `readPie` passes `Month.of(now()).gone(now())` to `viewPie`.
  The clock still comes from one place.
- `PieDiagram` draws a thin "today" tick inside each slice at
  `from + (to - from) × (1 - gone)`: where the baked part would end if the slice were eaten
  exactly on pace. It is a line from the centre to the rim, `stroke-muted-foreground`,
  `stroke-1`, drawn after the wedges so it sits on top. Only when `gone` is present.
- `Headline` area: one muted line from `describePace`, rendered only when it is not null.
- `Legend` adds the pace word to fast rows: "about half left · going fast".

### Agent tools

`read_pie` adds `pace: "<sentence>"` (or omits it when hidden) and a per-slice pace word in
each slice line: "Wants: about half left, going fast".

## UX

- **Where.** One muted line under the headline, above the pie. The legend adds the pace word to
  each fast row only. Steady and slow rows are unchanged.
- **Copy.**
  - None fast: "Every slice is on pace."
  - One fast: "Wants is going fast: about half eaten, about a third of the month gone."
  - Several fast: names the fastest, then "and Needs too." For three or more: "and Needs and
    Savings too."
  - Hidden on day one (see Behaviour).
- **Pie.** A short radial tick in each slice marks where the baked part would end on pace. It
  uses `stroke-muted-foreground`, so it reads as a guide, not a warning. When the baked part
  ends before the tick, the slice is fast; the eye sees it without colour.
- **Motion.** The ticks share the slice's `animate-ink-on` group, so they ink on with it and
  appear at once under `prefers-reduced-motion`.
- **Accessibility.** The pie's `aria-label` gains ", about a third of the month gone". Pace is
  always a word in the legend, never only a mark.
- **Mobile.** The line wraps under the headline at `max-w-[60ch]`; nothing new to tap.

## Acceptance criteria

- [ ] `Month.gone` is `none` at the first instant, `whole` at the last millisecond and
      beyond, and about a third on the 11th of a 30-day month at 00:00 UTC.
- [ ] `paceOf` returns `steady` exactly at `gone ± 0.1`, `fast` just above, `slow` just below.
- [ ] An overflowed slice is `fast` on any day.
- [ ] The pace line is absent while less than 0.04 of the month is gone.
- [ ] With no fast slice the line reads "Every slice is on pace."
- [ ] With two fast slices the line names the one furthest ahead first, then "and <other> too."
- [ ] The diagram draws one tick per slice at the on-pace point, in `stroke-muted-foreground`.
- [ ] Fast legend rows carry the words "going fast"; other rows are unchanged.
- [ ] `read_pie` includes the pace sentence and a per-slice pace word.
- [ ] `viewPie(pie)` without `gone` still returns the existing view unchanged.

## Tests

- Unit: `Month.gone` at start, middle, last millisecond, after the end, and across
  February of a leap year.
- Unit: `paceOf` at each band edge, for an overflowed slice, and for an empty slice.
- Unit: `describePace` for hidden, none fast, one fast, several fast (names the fastest).
- Component: tick position for a known `gone`; legend text for a fast slice.
- WebMCP: `read_pie` includes the pace sentence.

## Out of scope

- Weighting pace by known future bites (see Staples).
- Per-slice pace rules (e.g. Savings eaten fast is good). See open questions.

## Open questions

- Savings bites mean money put away, so "fast" there is good news. Either flip the wording for a
  slice marked as savings, or skip pace for it. Both need a slice kind, which does not exist yet.
  Until decided, Savings is paced like any other slice.
