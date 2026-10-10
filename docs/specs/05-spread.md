# Spread

Status: proposed · Depends on: Put back and move (to cancel a spread)

## Why

A laptop "overflows" Wants this month, but the person would pay it in instalments, or save for
it over a few months. Weighing should answer "what if I spread it?".

## Language

| Term       | Meaning                                                                 |
| ---------- | ----------------------------------------------------------------------- |
| **Spread** | One expense split into equal bites over several months, starting now.   |

## Behaviour

- Weigh takes an optional number of months, 2 to 24.
- The amount is split with `Money.split` into equal parts that lose no minor unit; the first
  part is weighed against this month.
- The answer compares both: "Too big now. Spread over six months it is about a tenth of Wants
  each month, and fits."
- Later months are assumed to have the same slice size. The answer never claims more than that.
- Taking a spread creates all the bites at once, one per month, dated the first instant of each
  later month. Because bites are already loaded by month, each part shows up in its month with
  no new mechanism.
- Bites of a spread read "Laptop, 2 of 6".
- Putting back one part offers to put back the remaining future parts too.

## Design

### Core

- `Bite` gains `spread?: { id: string; part: number; of: number }`.
- `Pie.weigh` takes `{ sliceId, amount, months? }` and returns `Weighing` for this month's part,
  plus `whole?: Weighing` for the full amount when `months` is set.
- Use case `takeSpread(ports)({ ownerId, sliceId, amount, note, months })` takes this month's
  part through the pie and saves later parts directly, since the pie only holds one month.
  That needs `PieRepository.saveBites(pieId, bites)` or a `save` that accepts extra bites.
- Use case `putBackSpread(ports)({ ownerId, spreadId })` removes this and every later part.
- Presentation: `describeWeighing` handles the spread comparison; `BiteView.spreadWords`.

### Persistence

`Bite` gains nullable `spreadId`, `spreadPart`, `spreadOf`, with an index on `spreadId`.

### Web

- Weigh form: "Spread over" select (Now, 2, 3, 6, 12, 24 months).
- Bite list shows "2 of 6" and the menu offers "Put back the rest".

### Agent tools

- `weigh_bite` and `take_bite` gain optional `months`.
- New `put_back_spread { spreadId }`.

## Tests

- Unit: split parts sum to the amount and differ by at most one minor unit; weigh with months;
  both verdicts in the sentence.
- Integration: each part appears in its own month only; putting back the rest leaves past parts.
- Component: select drives the `months` input.

## Out of scope

- Interest and fees.
- Spreads that start in a later month ("save up for it").
