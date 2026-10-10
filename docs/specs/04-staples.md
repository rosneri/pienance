# Staples

Status: proposed · Depends on: nothing

## Why

Rent, utilities and subscriptions eat the same part of a slice every month. Today they must be
typed in each month, and until they are, weighing says a slice has room it does not have.

## Language

| Term       | Meaning                                                   |
| ---------- | --------------------------------------------------------- |
| **Staple** | A bite that comes back every month, e.g. rent from Needs. |
| **Pantry** | All of a pie's staples.                                   |

## Behaviour

- A staple counts as eaten from its slice for the whole month it is active in, from day one.
  That is the point: weighing on the 2nd already knows rent is coming.
- A staple is active from the month it was stocked (`since`) up to, but not including, the
  month it stops in (`until`). Dropping it in October sets `until` to November, so October
  keeps it, since it is likely paid already.
- Dropping a staple in the month it was stocked sets `until` to `since`: it was never active.
  That makes a mistake one tap to undo.
- Changing a staple's amount is a drop plus a new staple, so past months keep their old amount.
- The amount is in the pie's currency and above zero. The slice must be live.
- The bite list shows staples first, under "Every month", with their portion of the slice.
- Staples count in `eatenFrom(slice)` and `leftover()`, so weighing, servings and the
  headline include them without a special case.
- Weighing adds a clause when staples matter: "Tight. It fits, but takes about half of what is
  left of Needs. Staples already take about two thirds of it."
- Staples do not create bites. Nothing is written when a month starts; no scheduler is needed.
- Interactions:
  - Pace (01) compares the part of the slice not taken by staples. See that spec.
  - Re-slice (03) refuses to retire a slice with an active staple.
  - Shelf (06) shows each past month with the staples that were active then.
  - Carry over (07) measures last month's leftover money after staples, by construction.
  - Shared pie (13): anyone in the pie can stock and drop staples.

## Design

### Core

- `domain/staple.ts`: `Staple { id, sliceId, amount: Money, note, since: Month, until?: Month }`
  (`until` exclusive) and `isActiveIn(staple, month): boolean`.
- `Month` gains `next()`, `previous()`, `equals(other)` and `isAfter(other)`.
- `Pie.bake` takes `staples?: readonly Staple[]`, in the pie's currency and on known slices.
  `eatenFrom(slice)` and `leftover()` add the active staples. The repository loads only the
  staples active in the served month, so `Pie` adds every staple it holds.
- `Pie.stock(staple)` and `Pie.drop(stapleId, month)` mutate the pantry; unknown ids throw
  `PieError`.
- `Serving` gains `stapled: Proportion` (how much of the slice its staples take).
  `Weighing` gains `stapled: Proportion` for the same slice.
- Use cases `stockStaple(ports)({ ownerId, sliceId, amount, note })` and
  `dropStaple(ports)({ ownerId, stapleId })`, both for `Month.of(ports.now())`. `stockStaple`
  returns the `Staple`.
- `PieRepository.find` loads the staples active in the requested month, and `save` upserts
  every staple the pie holds (a drop only changes `until`). The port's signatures stay.
- Presentation: `PieView.staples: StapleView[]` with
  `{ id, note, sliceName, portionWords, endsAfter?: string }` (`endsAfter` is the month name
  when `until` is set). `SliceView.stapledWords`. `describeWeighing` appends the staples
  clause when the verdict is `tight` or `overflows` and `stapled` is more than nothing.

### Persistence

```prisma
model Staple {
  id          String    @id
  sliceId     String
  slice       Slice     @relation(fields: [sliceId], references: [id], onDelete: Cascade)
  currency    String
  amountMinor BigInt
  note        String
  /// First day of the first month it counts in
  since       DateTime
  /// First day of the first month it no longer counts in; null while active
  until       DateTime?

  @@index([sliceId, since])
}
```

`Slice` gains `staples Staple[]`. `find` filters `since <= month.start` and
(`until` is null or `until > month.start`).

### Web

- Server actions `stockStaple(input): Outcome<StapleView>` and
  `dropStaple({ stapleId }): Outcome<null>`, both with `refresh()`.
- "Every month" section above the bite list, with a drop action per staple.
- The weigh form gets an "Every month" checkbox; checked, "Take the bite" stocks a staple
  instead. Add shadcn `checkbox` via the CLI.

### Agent tools

- `stock_staple { amount, slice, note }`, `drop_staple { stapleId }`.
- `read_pie` lists `staples` separately from bites, each with its `id`.

## UX

- **Adding.** The weigh form gains an "Every month" checkbox under the slice choice. Checked,
  the second button reads "Add to every month" instead of "Take the bite". "Weigh it" still
  weighs one month.
- **Answer.** "Added. Rent takes about two thirds of Needs every month."
- **Section.** "Every month" sits between the weigh form and "Eaten this month", one row per
  staple: "Rent · about two thirds of Needs". It is hidden while the pantry is empty.
- **Discovery.** The empty bite list says: "Not a crumb yet. Rent or subscriptions? Tick
  “Every month” and they count from the 1st."
- **Stopping.** Each row has an options button (44px, like bite rows) with "Stop after
  October". It confirms inline, like putting back a bite. A stopped staple stays in the list,
  muted, as "Ends after October". A staple stocked this month reads "Remove" instead and
  disappears.
- **Changing an amount.** Stop it and add a new one. The options menu offers "Change amount",
  which does exactly that: it scrolls to the weigh form prefilled with the note, slice and
  amount, with "Every month" ticked, and stops the old staple when the new one is added.
- **Weighing.** The clause from Behaviour, in the same answer line and tone.
- **Legend.** A slice with staples adds "about two thirds staples" after its left words.
- **Pie.** Staples are simply eaten; the diagram draws no special mark for them.

## Acceptance criteria

- [ ] A staple stocked in October is active in October and November, and not in September.
- [ ] Dropping in November sets `until` to December; November still counts it.
- [ ] Dropping in the month it was stocked makes it inactive everywhere.
- [ ] Servings, leftover and weighing include active staples; a slice whose staples take all
      of it has nothing left and every bite overflows.
- [ ] The weigh answer carries the staples clause only for `tight` or `overflows` with staples.
- [ ] Reload (in-memory and Postgres) returns only the staples active in the served month.
- [ ] Stocking on a retired slice, in another currency, or with zero is refused.
- [ ] The checkbox switches the second button's label and the action called.
- [ ] `read_pie` lists staples with ids; `stock_staple` and `drop_staple` answer with the
      page's sentences.

## Tests

- Unit: active window edges (`since`, `until`, month after drop, same-month drop); servings and
  weighing include staples; `Month.next/previous/equals/isAfter` across December and January.
- Integration (in-memory and Postgres): staples load only for months they are active in.
- Component: checkbox switches the action called; drop calls the passed-in action.
- WebMCP: both tools, and staples in `read_pie`.

## Out of scope

- Staples on a set day, yearly or weekly staples.
- Variable staples ("electricity, about this much").
