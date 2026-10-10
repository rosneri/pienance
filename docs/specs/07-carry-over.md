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
- The carried amount is last month's whole-pie leftover in money, as served today: income plus
  its own carry, minus bites and staples. An overspent month carries nothing. The first month
  after baking has no last month, so no offer.
- A carry makes its slice bigger this month. Proportions of that slice are measured against the
  bigger size, and the whole pie is income plus carry. Wedge angles follow sizes, so the carried
  slice draws wider.
- One carry per month, into one live slice. It can be undone during that month. The offer
  returns after an undo.
- Interactions:
  - Re-slice (03) refuses to retire the slice holding this month's carry.
  - Pace (01) and Appetite (08) measure against the bigger size without change.
  - Shelf (06): a past month's legend shows the carry it had.
  - Shared pie (13): only the baker carries or undoes.

## Design

### Core

- `domain/carry.ts`: `Carry { sliceId: string, amount: Money }`. The month is the pie's.
- `Pie.bake` takes `carry?: Carry`. Slice sizes stay `income.split(shares)`, plus the carry on
  its slice. `leftover()` measures against income plus carry.
- `Serving` gains `ofPie: Proportion` (the slice's size over the whole), so views can draw
  from sizes.
- `Pie.leftoverMoney(): Money`: income plus carry, minus everything eaten, never below zero
  (`Money.minus` already clamps).
- `Pie.carryOver(carry)` throws `PieError` when a carry exists, the slice is unknown or
  retired, or the amount is zero. `Pie.dropCarry()`.
- Use case `readCarryOffer(ports)({ ownerId })` returns `{ month: Month, leftover: Money } |
  null`: null when this month has a carry, the pie was baked this month, or last month left
  nothing. It reads only.
- Use case `carryOver(ports)({ ownerId, sliceId })`: loads last month's pie, takes its
  `leftoverMoney()`, calls `carryOver` on this month's pie and saves. Fails with `PieError`
  "Already carried this month." or "September left nothing to carry."
- Use case `dropCarry(ports)({ ownerId })`.
- `PieRepository.find` loads the month's carry with the pie; `save` upserts it by
  `(pieId, month)` and deletes it after `dropCarry` (`Pie.carryDropped(): boolean`).
- Presentation: `viewPie` computes `from`/`to` from `Serving.ofPie` instead of `share`.
  `PieView.carry?: { sliceName: string, from: string }` (the month's name) and
  `describeCarryOffer(month: string, leftoverWords: string): string`.

### Persistence

```prisma
model Carry {
  id          String   @id
  pieId       String
  pie         Pie      @relation(fields: [pieId], references: [id], onDelete: Cascade)
  sliceId     String
  slice       Slice    @relation(fields: [sliceId], references: [id], onDelete: Cascade)
  /// First day of the month the carry is added to
  month       DateTime
  currency    String
  amountMinor BigInt

  @@unique([pieId, month])
}
```

### Web

- Server actions `readCarryOffer(): { month: string, leftoverWords: string } | null`,
  `carryOver({ sliceId }): Outcome<PieView>` and `dropCarry(): Outcome<PieView>`, the last
  two with `refresh()`.
- `page.tsx` calls `readCarryOffer` only for the current month and only when `pie.carry` is
  absent.
- A dismissible offer card above the pie. Dismissal is per viewer and per month
  (`localStorage`, key `carry-dismissed:<month>`), never stored. A client component reads it
  after hydration, so the card never flashes for a viewer who dismissed it.
- The legend notes "Savings · with September's leftover".

### Agent tools

- `carry_over { slice }`, `drop_carry`.
- `read_pie` mentions the carry ("Savings holds September's leftover.") and the open offer
  (`carryOffer: "September left about a fifth of your pie."`) when there is one.

## UX

- **Offer.** A bordered block (`border`, `rounded-lg`, `p-4`) under the headline, above the
  pie, while last month left something and no carry exists:
  - "September left about a fifth of your pie."
  - "Carry it into" with slice pills like the weigh form, Savings preselected when it exists,
    else the last live slice.
  - "Carry it" (primary) and "Not this month" (ghost).
- **After carrying.** The block collapses to one answer line: "Carried into Savings. It is
  bigger this month." with an "Undo" text button for the rest of the visit. The Savings wedge
  widens with the usual ink-on motion.
- **Later.** The legend row reads "Savings · with September's leftover". Its options menu
  offers "Undo the carry" for the rest of the month.
- **Dismissing.** "Not this month" hides the block for this viewer only, until next month.
- **Overspent month.** No block. Nothing to carry, nothing to say.

## Acceptance criteria

- [ ] With a carry, the carried slice's size is `share × income + carry` and the whole is
      income plus carry; other slices are unchanged.
- [ ] `leftoverMoney` of an overspent month is zero and the offer is absent.
- [ ] A month after a carried month carries the leftover that includes that carry.
- [ ] A second carry in the same month is refused, in core and by the unique index.
- [ ] Carrying into a retired or unknown slice is refused.
- [ ] `dropCarry` removes the carry after reload and the offer returns.
- [ ] The offer is absent in the pie's first month and on past month pages.
- [ ] The carried wedge is wider than its share; `viewPie` angles come from sizes.
- [ ] Dismissing hides the block for that viewer and month only.
- [ ] `carry_over` and `drop_carry` answer with the page's sentences.

## Tests

- Unit: sizes, angles and leftover with a carry; overspent month carries nothing; chained
  carries; refusals.
- Integration: one carry per month enforced by the repository; drop removes it; the offer
  reads without writing.
- Component: offer shown only when eligible; calls the passed-in action; dismissal.

## Out of scope

- Carrying debt from an overspent month.
- Carrying per slice instead of the whole leftover.
