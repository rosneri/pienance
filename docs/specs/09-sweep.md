# Sweep

Status: proposed · Depends on: nothing

## Why

Rounding purchases up and saving the difference is an easy habit. Pienance can show those
leftovers piling up in Savings, in proportions.

## Language

| Term      | Meaning                                                                      |
| --------- | ---------------------------------------------------------------------------- |
| **Sweep** | The difference between a bite and its rounded-up amount, put into one slice. |

"Crumb" stays a rough size word, so it is not reused here.

## Behaviour

- Off by default. Turning it on picks a target slice (Savings) and a step: 1, 5 or 10 of the
  pie's currency major unit.
- When a bite is taken from another slice, its sweep is recorded on it:
  4.30 with a step of 1 sweeps 0.70.
- The sweep counts as eaten from the target slice, which for Savings means money put away.
  It also counts once against the whole pie. The bite's own slice is unaffected.
- Bites already on a whole step sweep nothing. Bites into the target slice never sweep.
- The answer after a take adds: "Swept a crumb into Savings."
- The month's sweeps show as one line under the bite list: "Swept this month: a sliver of
  Savings."
- The sweep is stored on the bite, so changing the step later never rewrites past months.
- Pienance only tracks. Moving the money is still up to the person.

## Design

### Core

- `Money.roundUpTo(step: Money): Money`, via integer minor units inside `Money`.
- `Pie` gains `sweep?: { sliceId, step: Money }`. `Bite` gains `swept?: Money`.
- `Pie.take` computes `swept` when a sweep is set. `eatenFrom(target)` and `leftover()` include
  sweeps.
- Use case `setSweep(ports)({ ownerId, sliceId, step } | { ownerId, off: true })`.
- Presentation: `PieView.sweptWords`, sweep clause in the take answer.

### Persistence

- `Pie.sweepSliceId String?`, `Pie.sweepStepMinor BigInt?`.
- `Bite.sweptMinor BigInt?`.

### Web

- A sweep toggle with slice and step in the Re-slice view, or in a small settings sheet if
  Re-slice is not built yet.

### Agent tools

- `set_sweep { slice, step } | { off: true }`.
- `take_bite` result mentions the sweep.

## UX

- **Settings.** A "Sweep" block at the end of the Re-slice page, or in a small sheet from the
  masthead menu if Re-slice is not built yet:
  - A switch, "Round bites up".
  - When on: "into" with slice pills, and "to the next" with 1, 5 or 10 of the currency.
  - One example line, in the pie's currency: "A 4.30 € bite sweeps 0.70 € into Savings."
    Rounding is about exact amounts, so this is a place where numbers help.
- **Turning off.** Immediate, with "Past sweeps stay." as the answer.
- **After a take.** The answer adds the sweep: "Taken. Swept a crumb into Savings."
- **Bite list.** One muted line under the list: "Swept this month: a sliver of Savings."
- **Components.** shadcn `switch`, added with the CLI.

## Tests

- Unit: `roundUpTo` for JPY (no minor unit), EUR and KWD (three); sweeps skip the target slice
  and whole amounts; leftover counts each sweep once.
- Integration: sweep survives reload; changing the step leaves old bites as they were.

## Out of scope

- Sweeping to a slice of another pie or another account.
