# Feature specs

Proposed features, one spec each. Every spec names its new terms, the change per core layer,
persistence, web, WebMCP tools and tests, following CLAUDE.md. New terms join the README's
ubiquitous language when a spec is built.

Suggested order: small, independent and visible first, then features that build on them.

| #   | Spec                                         | In one line                                              | Depends on            | Schema change |
| --- | -------------------------------------------- | -------------------------------------------------------- | --------------------- | ------------- |
| 1   | [Pace](01-pace.md)                           | Is a slice eaten faster than the month is passing?       | —                     | no            |
| 2   | [Put back and move](02-put-back-and-move.md) | Undo or re-file a bite.                                  | —                     | no            |
| 3   | [Re-slice](03-re-slice.md)                   | Edit income and slices in place.                         | —                     | yes           |
| 4   | [Staples](04-staples.md)                     | Monthly expenses counted from day one.                   | —                     | yes           |
| 5   | [Spread](05-spread.md)                       | Weigh and take an expense over several months.           | 2                     | yes           |
| 6   | [Shelf](06-shelf.md)                         | Past months as small pies.                               | —                     | no            |
| 7   | [Carry over](07-carry-over.md)               | Put last month's leftover into a slice.                  | 6                     | yes           |
| 8   | [Appetite](08-appetite.md)                   | How each slice is usually eaten, in a sentence.          | 6                     | no            |
| 9   | [Sweep](09-sweep.md)                         | Round bites up and count the difference as saved.        | —                     | yes           |
| 10  | [Foreign bites](10-foreign-bites.md)         | Bites in other currencies, converted at a fixed rate.    | —                     | yes           |
| 11  | [Weigh anywhere](11-weigh-anywhere.md)       | Installable app, shortcut and share target.              | —                     | no            |
| 12  | [Agent tools](12-agent-tools.md)             | Tool conventions, catalogue, and `find_room`.            | each feature          | no            |
| 13  | [Shared pie](13-shared-pie.md)               | Several people eating from one pie.                      | 2                     | yes           |

## Known issues the specs rely on

- `PieRepository.find` returns the owner's newest pie with that month's bites. Baking again
  hides every earlier bite. Re-slice removes the need to bake again.
- Slices are mutable rows, so past months are drawn with today's income and shares. Shelf and
  Appetite accept this. Versioned slices are left out until it matters.
- `PrismaPieRepository.save` treats bites as insert-only. Put back and move change that.
