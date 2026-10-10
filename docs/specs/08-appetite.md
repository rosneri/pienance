# Appetite

Status: proposed · Depends on: Shelf

## Why

One month is noise; three months are a habit. Appetite turns the shelf into one or two honest
sentences about how each slice is usually eaten.

## Language

| Term         | Meaning                                                     |
| ------------ | ----------------------------------------------------------- |
| **Appetite** | How much of a slice is usually eaten by the end of a month. |

## Behaviour

- Looks at the last three complete months only (the three before the current one). With fewer
  since baking, no appetite is shown.
- Per live slice, the median eaten proportion is spoken roughly:
  "You usually eat about three quarters of Needs." The median of three is the middle value.
- Streaks win over medians when they apply:
  - every month overflowed (`eaten` is the whole or more): "Wants has overflowed three months
    running."
  - every month left more than half: "Savings usually has more than half left."
- At most two sentences are shown: streaks first, in slice order, then the slice whose usual
  eaten is furthest from "all" (largest `|1 - usual|`), in slice order on ties.
- Appetite never gives advice. It states the pattern; the person decides.
- Interactions:
  - Re-slice (03): past months are measured with today's shares (see the index). Slices
    retired today are skipped; a slice added this month has no history and is skipped.
  - Carry over (07) and Staples (04): eaten is whatever those months served, nothing more.

## Design

### Core

- `domain/appetite.ts`: `appetiteOf(eaten: readonly Proportion[]): Appetite | null` where
  `Appetite = { usual: Proportion; streak?: "overflowing" | "leftover" }`. Null with fewer
  than three values. Overflowing: every value is not less than the whole. Leftover: every
  value is less than half.
- Use case `readAppetite(ports)({ ownerId })` reuses `shelvePie` for the three months before
  the current one and builds one appetite per live current slice, matched by slice id.
  Returns `{ slice: Slice, appetite: Appetite }[]`, or an empty list before three months.
- Presentation: `describeAppetite(entries: { sliceName, usualWords, streak? }[]): string[]`
  returns the chosen sentences (at most two).

### Persistence

None.

### Web

- `page.tsx` calls a `readAppetite` server action on the current month only.
- Shown under the shelf as plain sentences.

### Agent tools

`read_shelf` appends the appetite sentences under `usually`.

## UX

- **Where.** Under the shelf, as a short "Usually" heading and up to two sentences.
- **Tone.** Plain foreground text. An overflow streak uses the `tight` tone, and the word
  "overflowed" carries the meaning on its own.
- **Before three months.** One muted line: "After three months, pienance tells you how each
  slice is usually eaten." Hidden before the shelf has its first month.
- **Past month pages.** Not shown, so it never reads as a verdict on one old month.
- **No interaction.** Nothing to tap. It is a sentence to read, not a chart.

## Acceptance criteria

- [ ] With fewer than three complete months since baking, no sentence and the muted line.
- [ ] The median of three eaten values is the middle one, spoken with `roughly`.
- [ ] Three overflowed months give the overflow streak sentence in the `tight` tone.
- [ ] Three months each leaving more than half give the leftover streak sentence.
- [ ] At most two sentences, streaks first, then the slice furthest from "all".
- [ ] Retired and newly added slices are skipped.
- [ ] Past month pages show nothing.
- [ ] `read_shelf` includes the sentences.

## Tests

- Unit: median with three values; each streak; fewer than three months yields nothing;
  sentence selection order and tie-break.
- Integration: built from real months in the in-memory repository, with the clock moved.

## Out of scope

- Predictions for the current month (Pace covers the present).
- Per-bite categories or merchants.
- Medians over more than three months.
