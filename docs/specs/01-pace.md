# Pace

Status: proposed · Depends on: nothing

## Why

"About half of Wants is left" means one thing on the 3rd and another on the 27th. Pace tells the
person whether they are eating a slice faster or slower than the month is passing.

## Language

| Term     | Meaning                                                                          |
| -------- | -------------------------------------------------------------------------------- |
| **Pace** | How fast a slice is eaten compared with how much of the month is gone.           |
| `fast`   | Eaten well ahead of the month.                                                   |
| `steady` | Eaten about as fast as the month passes.                                         |
| `slow`   | Eaten well behind the month.                                                     |

## Behaviour

- Month gone: the share of the month elapsed at `now`, from `Month.start` to `Month.end`, in time.
- A slice is `fast` when `eaten > gone + 0.1`, `slow` when `eaten < gone − 0.1`, else `steady`.
  The 0.1 band avoids flicker on day one and on small bites.
- A slice that overflowed is always `fast`.
- Examples (Wants, on the 10th of a 30-day month, a third gone):
  - half eaten → "Wants is going fast: about half eaten, about a third of the month gone."
  - a third eaten → "Wants is steady."
  - a tenth eaten → "Wants is going slow."
- The headline stays the leftover sentence. Pace is a second line under it, naming only the
  fastest slice, or "Every slice is on pace." when none is fast.

## Design

### Core

- `domain/month.ts`: `Month.gone(at: Date): Proportion`, clamped to 0..1.
- `domain/pace.ts`: `type Pace = "fast" | "steady" | "slow"` and
  `paceOf(serving: Serving, gone: Proportion): Pace`. Pure, no `Pie` change.
- `presentation/pie-view.ts`: `viewPie(pie, { gone })`. `SliceView` gains `pace: Pace` and
  `eatenWords`. `PieView` gains `goneWords` and `gone` (0..1, for drawing).
- `presentation/sentences.ts`: `describePace(view: PieView): string`.
- `servePie` is unchanged. The caller passes `Month.of(now).gone(now)` to `viewPie`, so the
  clock still comes only from `Ports.now`.

### Persistence

None.

### Web

- `pie-actions.readPie` passes `gone` from the injected clock.
- `PieDiagram` draws a thin "today" tick inside each slice at
  `from + (to − from) × (1 − gone)`: the point where the baked part would end if eaten exactly on
  pace. Token colour only; no new hue.
- `Headline` area: one muted line from `describePace`.
- `Legend` marks fast slices with a word ("going fast"), never colour alone.

### Agent tools

`read_pie` adds `pace: "<sentence>"` and a per-slice pace word.

## Tests

- Unit: `Month.gone` at start, middle, last millisecond, and across February/leap years.
- Unit: `paceOf` at each band edge and for an overflowed slice.
- Unit: `describePace` for none fast, one fast, several fast (names the fastest).
- Component: tick position for a known `gone`; legend text for a fast slice.
- WebMCP: `read_pie` includes the pace sentence.

## Out of scope

- Weighting pace by known future bites (see Staples).
- Per-slice pace rules (e.g. Savings eaten fast is good). See open questions.

## Open questions

- Savings bites mean money put away, so "fast" there is good news. Either flip the wording for a
  slice marked as savings, or skip pace for it. Both need a slice kind, which does not exist yet.
