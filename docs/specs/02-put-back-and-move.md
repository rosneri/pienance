# Put back and move a bite

Status: proposed · Depends on: nothing

## Why

Bites cannot be corrected today. A typo in the amount or the wrong slice stays in the month for
good, and the pie lies from then on.

## Language

| Term         | Meaning                                                        |
| ------------ | -------------------------------------------------------------- |
| **Put back** | Remove a bite from the pie, as if it was never taken.          |
| **Move**     | Take a bite out of one slice and into another of the same pie. |

Editing a bite is a put back followed by a new bite. No separate "edit" verb.

## Behaviour

- Only bites of the month being served can be put back or moved. Past months are read-only.
  Because the pie only ever holds the served month's bites, a past bite's id is simply unknown.
- Putting back or moving a bite that is not in the pie fails with "That bite is not in this
  month's pie."
- Moving into the bite's own slice is a no-op, not an error. The answer still reads "Moved."
- Moving keeps the bite's amount, note and `eatenAt`. Only `sliceId` changes.
- After taking a bite, the page offers "Put back" until the next weigh or take, so an
  accidental take is one tap to undo.
- The answer after a move restates the destination: "Moved. It is about a tenth of Needs."
- Interactions:
  - Spread (05): putting back one part offers to put back the later parts too. Moving one
    part moves only that part.
  - Sweep (09): a put back bite takes its sweep with it. A moved bite keeps the sweep it
    recorded, even when moved into the sweep's target slice.
  - Shared pie (13): guests put back and move only their own bites.

## Design

### Core

- `Pie.putBack(biteId): void` and `Pie.move(biteId, sliceId): void`, throwing `PieError` on an
  unknown bite or slice. `move` into the same slice returns without change.
- The aggregate remembers what it removed since it was loaded, so repositories persist it
  without diffing whole months: `Pie.putBackIds(): readonly string[]`. A moved bite is just a
  bite with a new `sliceId`; `save` writes the bite again.
- `Pie.bite(biteId): Bite` for the use cases and views; throws `PieError` when unknown.
- Use cases `putBackBite(ports)({ ownerId, biteId })` and
  `moveBite(ports)({ ownerId, biteId, sliceId })`, both loading `Month.of(ports.now())`.
  `moveBite` returns the moved `Bite`.
- `InMemoryPieRepository.save` drops `pie.putBackIds()` from the stored bites and replaces
  stored bites by id, instead of keeping every stored bite it does not know.

### Persistence

- `PrismaPieRepository.save`, in the same transaction:
  - `bite.deleteMany({ where: { id: { in: pie.putBackIds() } } })` when the list is not empty;
  - one `bite.upsert` per bite instead of `createMany … skipDuplicates`. The `update` branch
    writes `sliceId` only; amount, note and `eatenAt` stay immutable.
- No schema change.

### Web

- Server actions `putBackBite({ biteId }): Outcome<null>` and
  `moveBite({ biteId, sliceId }): Outcome<BiteView>`, both calling `refresh()`.
- `takeBite` now returns `Outcome<BiteView>` instead of `Outcome<string>`, so the answer can
  say how big the bite was and bind "Put back" to its id. `pie-tools` `take_bite` keeps its
  sentence.
- `WeighForm` loses `key={pie.bites.length}` in `page.tsx`; it resets its own fields after a
  successful take. Otherwise the remount would wipe the "Put back" offer.
- `BiteList` takes `actions: Pick<PieActions, "putBackBite" | "moveBite">` and `slices` as
  props. Each row gets a small menu: "Move to…" (one item per other slice) and "Put back". Add
  shadcn `dropdown-menu` via the CLI.

### Agent tools

- `read_pie` bites become objects: `{ id, note, slice, portion }`, so agents can name a bite.
- New `put_back_bite { biteId }` and `move_bite { biteId, slice }`. Both answer with the same
  sentences as the page.

## UX

- **Bite row.** Each row gets a trailing options button, 44px square, labelled
  "Options for Running shoes" ("Options for Something" when the note is empty). It opens a
  menu:
  - "Move to Needs", "Move to Savings": one item per other slice, no submenu, so it works on a
    phone.
  - A separator, then "Put back" in the destructive tone.
- **Put back.** No modal. The row turns into an inline question:
  "Put back Running shoes? [Put back] [Keep]". Focus lands on "Keep". Confirming removes the row
  and moves focus to the next row's options button, or to the "Eaten this month" heading when
  the list is empty.
- **Move.** Applies at once; the row's slice words change in place. A polite live region in
  the list says "Moved. It is about a tenth of Needs."
- **Undo a take.** After "Take the bite", the answer line reads "Taken. About a tenth of Wants."
  with a "Put back" text button beside it. It stays until the next weigh or take. No timer, so
  nobody has to race it.
- **Pending.** The row dims and carries `aria-busy`; its options button is disabled.
- **Errors.** One destructive line under the row, e.g. "That bite is not in this month's pie."
- **Components.** shadcn `dropdown-menu`, added with the CLI into `@pienance/ui`.

## Acceptance criteria

- [ ] `Pie.putBack` removes the bite from `bites`, servings and leftover, and records its id.
- [ ] `Pie.move` changes only `sliceId`; amount, note and `eatenAt` are identical afterwards.
- [ ] Unknown bite or slice ids throw `PieError` with the sentence above.
- [ ] Moving into the same slice changes nothing and does not throw.
- [ ] After reload (in-memory and Postgres) a put back bite is gone and a moved bite is in its
      new slice. Bites of other months are untouched.
- [ ] A put back bite from a past month is refused as unknown.
- [ ] The weigh form keeps its "Taken. … Put back" line after the page refreshes.
- [ ] The row menu lists every other slice and "Put back"; put back confirms inline with focus
      on "Keep".
- [ ] `read_pie` bites carry an `id`; `put_back_bite` and `move_bite` answer with the page's
      sentences, and an unknown id yields the error text, not a throw.

## Tests

- Unit: `Pie.putBack` / `Pie.move` update servings and leftover; unknown ids throw; move into
  the same slice is a no-op.
- Integration (in-memory and Postgres): put back and move survive a reload; other months
  untouched; amounts unchanged after a move.
- Component: menu calls the passed-in actions; undo button after a take; form fields reset
  after a take.
- WebMCP: both tools, plus error text for an unknown id.

## Out of scope

- Correcting past months.
- Undo history beyond the last take.
