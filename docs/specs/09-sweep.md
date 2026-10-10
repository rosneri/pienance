# Sweep

Status: proposed · Depends on: nothing (the Re-slice page is the natural home for its settings)

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
  pie's currency major unit. For a currency without minor units (JPY), a step of 1 can never
  sweep, so the steps are 10, 50 and 100 instead.
- When a bite is taken from another slice, its sweep is recorded on it:
  4.30 with a step of 1 sweeps 0.70.
- The sweep counts as eaten from the target slice, which for Savings means money put away.
  It also counts once against the whole pie. The bite's own slice is unaffected. A sweep never
  refuses: a full target slice simply overflows.
- Bites already on a whole step sweep nothing and record no sweep. Bites into the target slice
  never sweep.
- The answer after a take adds: "Swept a crumb into Savings."
- The month's sweeps show as one line under the bite list: "Swept this month: a sliver of
  Savings."
- The sweep is stored on the bite, so changing or turning off the step later never rewrites
  past bites.
- Pienance only tracks. Moving the money is still up to the person.
- Interactions:
  - Put back and move (02): a put back bite takes its sweep with it; a moved bite keeps the
    sweep it recorded.
  - Spread (05): every part sweeps on its own when the spread is taken.
  - Foreign bites (10): the sweep is computed on the converted amount.
  - Re-slice (03) refuses to retire the target slice while the sweep is on.
  - Shared pie (13): only the baker sets the sweep; everyone's bites sweep.

## Design

### Core

- `Money.roundUpTo(step: Money): Money`, via integer minor units: `ceil(minor / step) × step`.
  `step` must be above zero and in the same currency.
- `Pie` gains `sweep?: { sliceId: string, step: Money }`. `Bite` gains `swept?: Money`, present
  only when more than zero.
- `Pie.take(bite)` is unchanged. `Pie.sweepFor(candidate): Money` gives what a bite would sweep
  (zero when off, on the target slice, or on a whole step); `takeBite` sets `bite.swept` from
  it before taking. `eatenFrom(target)` and `leftover()` add every `swept`.
- `Pie.setSweep(sweep | undefined)` throws `PieError` on an unknown or retired slice, or a
  step that is not above zero.
- Use case `setSweep(ports)({ ownerId, sliceId, step } | { ownerId, off: true })`, `step` as
  typed ("1", "5", "10").
- Presentation: `PieView.sweep?: { sliceName: string, step: string }`,
  `PieView.sweptWords?: string` (of the target slice, absent when nothing was swept),
  `BiteView.sweptWords?: string`. The take answer appends the sweep clause.

### Persistence

- `Pie.sweepSliceId String?`, `Pie.sweepStepMinor BigInt?`, written by the pie upsert.
- `Bite.sweptMinor BigInt?`.

### Web

- Server action `setSweep(input): Outcome<PieView>` with `refresh()`.
- A sweep block in the Re-slice page, or in a small settings `sheet` from the masthead menu
  if Re-slice is not built yet.
- `takeBite` returns the bite's `sweptWords` (in `BiteView`, from 02) so the form can add the
  clause.

### Agent tools

- `set_sweep { slice, step } | { off: true }`.
- `take_bite` result mentions the sweep; `read_pie` reports the setting and `sweptWords`.

## UX

- **Settings.** A "Sweep" block at the end of the Re-slice page, or in a small sheet from the
  masthead menu if Re-slice is not built yet:
  - A switch, "Round bites up".
  - When on: "into" with slice pills, and "to the next" with the three steps as pills, in the
    pie's currency.
  - One example line, in the pie's currency: "A 4.30 € bite sweeps 0.70 € into Savings."
    Rounding is about exact amounts, so this is a place where numbers help. The example uses
    `Money.toDecimal` and `currencySymbol`.
- **Turning off.** Immediate, with "Past sweeps stay." as the answer.
- **After a take.** The answer adds the sweep: "Taken. About a tenth of Wants. Swept a crumb
  into Savings."
- **Bite list.** One muted line under the list: "Swept this month: a sliver of Savings."
- **Components.** shadcn `switch`, added with the CLI.

## Acceptance criteria

- [ ] `roundUpTo` rounds 4.30 EUR to 5.00 with step 1, 430 JPY to 440 with step 10, and
      1.234 KWD to 2.000 with step 1. A whole step stays as it is.
- [ ] A bite on a whole step records no sweep; a bite into the target slice records none.
- [ ] The target slice's eaten and the whole pie's leftover include every sweep once.
- [ ] Turning the sweep off or changing the step leaves existing bites' `swept` unchanged.
- [ ] A put back bite removes its sweep from the target slice.
- [ ] The setting and each bite's sweep survive a reload.
- [ ] JPY pies offer steps 10, 50, 100.
- [ ] `set_sweep` answers with the page's sentence; `take_bite` mentions the sweep.

## Tests

- Unit: `roundUpTo` for JPY (no minor unit), EUR and KWD (three); sweeps skip the target slice
  and whole amounts; leftover counts each sweep once; refusals.
- Integration: sweep survives reload; changing the step leaves old bites as they were.
- Component: switch and pills call the passed-in action; example line follows the step.

## Out of scope

- Sweeping to a slice of another pie or another account.
