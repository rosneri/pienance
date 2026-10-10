# Spread

Status: proposed · Depends on: Put back and move (bite upserts, deletes, and the row menu)

## Why

A laptop "overflows" Wants this month, but the person would pay it in instalments, or save for
it over a few months. Weighing should answer "what if I spread it?".

## Language

| Term       | Meaning                                                               |
| ---------- | --------------------------------------------------------------------- |
| **Spread** | One expense split into equal bites over several months, starting now. |

## Behaviour

- Weigh takes an optional number of months, 2 to 24. Anything else is refused.
- The amount is split with `Money.split` into equal parts that lose no minor unit. Parts differ
  by at most one minor unit and the first parts carry the remainder, so this month's part is
  never the smallest. In JPY a 10 yen spread over 3 months is 4, 3, 3.
- The first part is weighed against this month.
- The answer compares both: "Too big now. Spread over six months it is about a tenth of Wants
  each month, and fits."
- Later months are assumed to have the same slice size. The answer never claims more than that.
- Taking a spread creates all the bites at once, one per month. The first is dated now; each
  later part is dated the first instant of its month (`Month.next().start`). Because bites are
  loaded by month, each part shows up in its month with no new mechanism.
- Bites of a spread read "Laptop, 2 of 6".
- Putting back one part offers to put back this and every later part too. Earlier parts stay.
- Interactions:
  - Foreign bites (10): the whole amount is converted first, then split.
  - Sweep (09): every part is a bite and sweeps on its own, with the step in force when the
    spread is taken.
  - Shelf (06): past parts show in their months, as "Laptop, 1 of 6".
  - Agent tools (12): `find_room` suggests a spread when nothing fits.

## Design

### Core

- `Pie` gains `month: Month`, the month it is served for. `Pie.bake` takes it; `bakePie` passes
  `Month.of(ports.now())` and repositories pass the requested month. `Pie.take` accepts a
  bite dated in that month or later and refuses earlier ones. `bites` returns the month's
  bites; `laterBites` the rest. `eatenFrom`, `leftover` and `servings` count the month's bites
  only. This keeps later parts inside the aggregate instead of writing them past it.
- `Bite` gains `spread?: { id: string; part: number; of: number }`.
- `Money.split` is unchanged; equal parts are `split(Array(months).fill(Proportion.of(1 / months)))`.
- `Pie.weigh({ sliceId, amount, months? })` returns `Weighing` for this month's part, plus
  `whole?: Weighing` for the full amount when `months` is set.
- `Pie.fewestMonthsToFit(candidate, max): number | null`: the smallest `months` in 2..max at
  which this month's part `fits` or is `tight`, or null.
- Use case `takeSpread(ports)({ ownerId, sliceId, amount, note, months })` builds the parts
  with one `spread.id` from `ports.newId()`, takes them all through the pie and saves once.
- `Pie.putBackSpread(spreadId)` removes this month's parts of that spread and records the id
  in `putBackSpreadIds()`. Use case `putBackSpread(ports)({ ownerId, spreadId })`.
- Presentation: `describeWeighing` handles the spread comparison; `BiteView.spreadWords`
  ("2 of 6") and `BiteView.spreadId`.

### Persistence

- `Bite` gains nullable `spreadId`, `spreadPart`, `spreadOf`, with an index on `spreadId`.
- `save` writes `bites` and `laterBites` alike (upserts, from 02), and for each id in
  `putBackSpreadIds()` deletes `where: { spreadId, eatenAt: { gte: pie.month.start } }`.
  The in-memory repository does the same filter.

### Web

- `weighBite` and `takeBite` server actions gain optional `months`; `takeBite` routes to
  `takeSpread` when set. New `putBackSpread({ spreadId }): Outcome<null>`.
- Weigh form: "Pay over" select (This month, 2, 3, 6, 12, 24 months).
- Bite list shows "2 of 6" and the row menu offers "Put back the rest".

### Agent tools

- `weigh_bite` and `take_bite` gain optional `months` (integer, 2 to 24).
- New `put_back_spread { spreadId }`. `read_pie` bites carry `spreadId` when they have one.

## UX

- **Control.** A "Pay over" select under the price: "This month" (default), 2, 3, 6, 12 or 24
  months. It uses the existing `native-select`, which behaves well on phones.
- **Buttons.** With months chosen, "Take the bite" reads "Take it over 6 months".
- **Answer.** Two sentences, now first, then spread. The tone follows this month's part.
- **Nudge.** When a bite overflows with "This month" chosen, the answer adds a "Spread it to
  fit" button. It picks `fewestMonthsToFit(candidate, 24)`, sets the select to it and weighs
  again. If nothing fits, the button is not shown.
- **Bite row.** "Laptop · 1 of 6 · about a tenth of Wants", with a muted second line
  "5 more months". The last part has no second line.
- **Put back.** The menu says what it does: "Put back this and the 5 to come". On the last
  part it is a plain "Put back". It confirms inline like any put back.

## Acceptance criteria

- [ ] Parts sum to the amount, differ by at most one minor unit, and the first part is the
      largest, in EUR, JPY and KWD.
- [ ] `months` outside 2..24 is refused in core and in the tools.
- [ ] Weighing with months returns this month's part and the whole; the sentence carries both
      verdicts.
- [ ] `fewestMonthsToFit` returns the smallest fitting count or null.
- [ ] Taking a spread writes one bite per month; each month's pie shows only its part.
- [ ] A pie refuses a bite dated before its month.
- [ ] Putting back the rest removes this month's and later parts and leaves earlier ones.
- [ ] The select drives `months`; the second button's label follows it.
- [ ] `put_back_spread` answers with the page's sentence.

## Tests

- Unit: split parts across currencies; weigh with months; both verdicts in the sentence;
  `fewestMonthsToFit`; `Pie.take` refuses earlier months.
- Integration: each part appears in its own month only; putting back the rest leaves past
  parts, in memory and on Postgres.
- Component: select drives the `months` input; nudge button sets it.

## Out of scope

- Interest and fees.
- Spreads that start in a later month ("save up for it").
