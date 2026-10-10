# Appetite

Status: proposed · Depends on: Shelf

## Why

One month is noise; three months are a habit. Appetite turns the shelf into one or two honest
sentences about how each slice is usually eaten.

## Language

| Term         | Meaning                                                           |
| ------------ | ----------------------------------------------------------------- |
| **Appetite** | How much of a slice is usually eaten by the end of a month.       |

## Behaviour

- Looks at the last three complete months only. With fewer, no appetite is shown.
- Per slice, the median eaten proportion is spoken roughly:
  "You usually eat about three quarters of Needs."
- Streaks win over medians when they apply:
  - every month overflowed: "Wants has overflowed three months running."
  - every month left more than half: "Savings is usually half left."
- At most two sentences are shown, streaks first, then the slice furthest from "all".
- Appetite never gives advice. It states the pattern; the person decides.

## Design

### Core

- `domain/appetite.ts`: `appetiteOf(eaten: readonly Proportion[]): Appetite` where
  `Appetite = { usual: Proportion; streak?: "overflowing" | "leftover"; months: number }`.
- Use case `readAppetite(ports)({ ownerId })` reuses `shelvePie` for three months and builds one
  appetite per current slice, matched by slice id.
- Presentation: `describeAppetite(slices)` returns the chosen sentences.

### Persistence

None.

### Web

- Shown under the shelf as plain sentences, `text-muted-foreground`.

### Agent tools

`read_shelf` appends the appetite sentences.

## Tests

- Unit: median with odd and even counts; each streak; fewer than three months yields nothing;
  sentence selection order.
- Integration: built from real months in the in-memory repository.

## Out of scope

- Predictions for the current month (Pace covers the present).
- Per-bite categories or merchants.
