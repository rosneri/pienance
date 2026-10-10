# Carry over

Status: proposed · Depends on: Shelf (`Month.previous`, serving any month)

## Why

What is left at the end of a month simply vanishes on the 1st. People who under-spend want that
rewarded, usually by putting it into Savings.

## Language

| Term      | Meaning                                                        |
| --------- | -------------------------------------------------------------- |
| **Carry** | Last month's leftover, added to one slice of this month's pie. |

## Behaviour

- During the month, if last month left something and nothing was carried yet, the page asks:
  "September left about a fifth of your pie. Carry it into Savings?" with a slice choice.
- Carrying is explicit. Nothing happens if the person ignores the question, and nothing is
  written when a page is only read.
- The carried amount is last month's whole-pie leftover in money, including any carry it got.
  An overspent month carries nothing.
- A carry makes its slice bigger this month. Proportions of that slice are measured against the
  bigger size, and the whole pie is income plus carry.
- One carry per month. It can be undone during that month.

## Design

### Core

- `domain/carry.ts`: `Carry { month: Month, sliceId, amount: Money }`.
- `Pie.bake` takes an optional carry. Slice sizes become `share × income`, plus the carry on its
  slice. `leftover()` measures against income plus carry.
- `Pie.leftoverMoney()`: what is left in money, never below zero.
- Use case `carryOver(ports)({ ownerId, sliceId })`: loads last month, reads its leftover money,
  stores the carry on this month. Fails with `PieError` if already carried or nothing is left.
- Use case `dropCarry(ports)({ ownerId })`.
- `PieRepository.find` loads the month's carry with the pie.
- Presentation: `PieView.carry?: { sliceName, words }` and `describeCarryOffer(...)`.

### Persistence

```prisma
model Carry {
  id          String   @id
  pieId       String
  pie         Pie      @relation(fields: [pieId], references: [id], onDelete: Cascade)
  sliceId     String
  /// First day of the month the carry is added to
  month       DateTime
  currency    String
  amountMinor BigInt

  @@unique([pieId, month])
}
```

### Web

- A dismissible offer card above the pie, shown while no carry exists and last month left
  something. Dismissal is per-viewer (`localStorage`), not stored.
- The legend notes "Savings, with September's leftover".

### Agent tools

- `carry_over { slice }`, `drop_carry`.
- `read_pie` mentions the carry and whether an offer is open.

## UX

- **Offer.** A bordered card under the headline, above the pie, while last month left something
  and no carry exists:
  - "September left about a fifth of your pie."
  - "Carry it into" with slice pills like the weigh form, Savings preselected.
  - "Carry it" (primary) and "Not this month" (ghost).
- **After carrying.** The card collapses to one answer line: "Carried into Savings. It is
  bigger this month." with an "Undo" text button for the rest of the visit. The Savings wedge
  widens with the usual ink-on motion: slice angles follow sizes, so `viewPie` must compute them
  from sizes instead of shares once a carry exists.
- **Later.** The legend row reads "Savings · with September's leftover". Its options menu offers
  "Undo the carry" for the rest of the month.
- **Dismissing.** "Not this month" hides the card for this viewer only.
- **Overspent month.** No card. Nothing to carry, nothing to say.

## Tests

- Unit: sizes and leftover with a carry; overspent month carries nothing; chained carries.
- Integration: one carry per month enforced by the repository; drop removes it.
- Component: offer shown only when eligible; calls the passed-in action.

## Out of scope

- Carrying debt from an overspent month.
- Carrying per slice instead of the whole leftover.
