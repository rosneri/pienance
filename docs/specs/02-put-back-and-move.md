# Put back and move a bite

Status: proposed · Depends on: nothing

## Why

Bites cannot be corrected today. A typo in the amount or the wrong slice stays in the month for
good, and the pie lies from then on.

## Language

| Term         | Meaning                                                    |
| ------------ | ---------------------------------------------------------- |
| **Put back** | Remove a bite from the pie, as if it was never taken.      |
| **Move**     | Take a bite out of one slice and into another of the same pie. |

Editing a bite is a put back followed by a new bite. No separate "edit" verb.

## Behaviour

- Only bites of the month being served can be put back or moved. Past months are read-only.
- Putting back a bite that does not exist fails with "That bite is not in this month's pie."
- Moving into the bite's own slice is a no-op, not an error.
- After taking a bite, the page offers "Put back" for a few seconds, so an accidental take is one
  tap to undo.
- The answer after a move restates the destination: "Moved. It is about a tenth of Needs."

## Design

### Core

- `Pie.putBack(biteId)` and `Pie.move(biteId, sliceId)`, throwing `PieError` on unknown ids.
- The aggregate records what changed since it was loaded, so the repository can persist it
  without diffing whole months: `pie.putBackIds(): readonly string[]`. A moved bite is just a
  bite with a new `sliceId`.
- Use cases `putBackBite(ports)({ ownerId, biteId })` and
  `moveBite(ports)({ ownerId, biteId, sliceId })`, both loading `Month.of(ports.now())`.
- `InMemoryPieRepository` honours both.

### Persistence

- `PrismaPieRepository.save`:
  - deletes `pie.putBackIds()` within the same transaction;
  - upserts bites instead of `createMany … skipDuplicates`, so a changed `sliceId` is written.
    The upsert updates `sliceId` only; amounts and dates stay immutable.
- No schema change.

### Web

- Server actions `putBackBite`, `moveBite` returning `Outcome<PieView>`.
- `BiteList` rows get a small menu: "Move to…" (slice list) and "Put back". Add shadcn
  `dropdown-menu` via the CLI.
- After `takeBite`, the answer area shows "Taken." with a "Put back" button bound to the new
  bite id, until the next action.

### Agent tools

- `read_pie` bites include their `id`.
- New `put_back_bite { biteId }` and `move_bite { biteId, slice }`.

## Tests

- Unit: `Pie.putBack` / `Pie.move` update servings and leftover; unknown ids throw.
- Integration (in-memory and Postgres): put back and move survive a reload; other months
  untouched; amounts unchanged after a move.
- Component: menu calls the passed-in actions; undo button after a take.
- WebMCP: both tools, plus error text for an unknown id.

## Out of scope

- Correcting past months.
- Undo history beyond the last take.
