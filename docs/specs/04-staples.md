# Staples

Status: proposed · Depends on: nothing

## Why

Rent, utilities and subscriptions eat the same part of a slice every month. Today they must be
typed in each month, and until they are, weighing says a slice has room it does not have.

## Language

| Term       | Meaning                                                                    |
| ---------- | -------------------------------------------------------------------------- |
| **Staple** | A bite that comes back every month, e.g. rent from Needs.                  |
| **Pantry** | All of a pie's staples.                                                    |

## Behaviour

- A staple counts as eaten from its slice for the whole month it is active in, from day one.
  That is the point: weighing on the 2nd already knows rent is coming.
- A staple is active from the month it was stocked until the month it was dropped, inclusive.
  Dropping keeps it in the current month, since it is likely paid already.
- Changing a staple's amount is a drop plus a new staple, so past months keep their old amount.
- The bite list shows staples first, under "Every month", with their portion of the slice.
- Weighing reports against what is left after staples:
  "Tight. Rent already takes about two thirds of Needs."
- Staples do not create bites. Nothing is written when a month starts; no scheduler is needed.

## Design

### Core

- `domain/staple.ts`: `Staple { id, sliceId, amount: Money, note, since: Month, until?: Month }`
  and `isActiveIn(staple, month)`.
- `Month` gains `next()`, `previous()`, `equals()` and `isAfter()`.
- `Pie.bake` takes `staples`. `eatenFrom(slice)` and `leftover()` include them. `Pie.stock()`
  and `Pie.drop(stapleId, month)` mutate the pantry.
- Use cases `stockStaple(ports)({ ownerId, sliceId, amount, note })` and
  `dropStaple(ports)({ ownerId, stapleId })`, both for `Month.of(ports.now())`.
- `PieRepository.find` loads staples active in the requested month (contract stays the same).
- Presentation: `PieView.staples: StapleView[]` with `portionWords`.

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
  /// First day of the month after the last one it counts in; null while active
  until       DateTime?

  @@index([sliceId, since])
}
```

### Web

- "Every month" section above the bite list, with a drop action per staple.
- The take form gets an "Every month" checkbox; checked, it stocks a staple instead of taking a
  bite.

### Agent tools

- `stock_staple { amount, slice, note }`, `drop_staple { stapleId }`.
- `read_pie` lists staples separately from bites.

## Tests

- Unit: active window edges (`since`, `until`, month after drop); servings and weighing include
  staples; drop keeps the current month.
- Integration (in-memory and Postgres): staples load only for months they are active in.
- Component: checkbox switches the action called; drop calls the passed-in action.
- WebMCP: both tools, and staples in `read_pie`.

## Out of scope

- Staples on a set day, yearly or weekly staples.
- Variable staples ("electricity, about this much").
