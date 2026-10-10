# Feature specs

Proposed features, one spec each. Every spec names its new terms, the change per core layer,
persistence, web, UX, WebMCP tools and tests, following CLAUDE.md. New terms join the README's
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

## UX principles

Every spec's UX section follows these, so they are not repeated there.

- **Mobile first.** One column below `lg`: headline, pie, legend, then forms and lists. Two
  columns on desktop, pie on the left, as today.
- **Words, not numbers.** Proportions are always spoken with `roughly`. Numbers appear only
  where the person types them: amounts, shares while re-slicing, and the sweep step.
- **One answer line.** Each form answers in its `Answer` line (`role="status"`), toned like a
  verdict. No toasts, no snackbars.
- **No modals for small things.** Destructive actions confirm inline, in the row, with focus
  on the safe choice. Undo offers stay until the next action, never on a timer.
- **Never colour alone.** Every tone has words: "going fast", "tight", "overflowed".
- **Masthead menu.** The first spec that needs more than "Sign out" (Re-slice) replaces it
  with one "Menu" button opening a shadcn `sheet`: Re-slice, Share pie, Add to home screen,
  Sign out. Items appear only when they apply.
- **Components and tokens.** shadcn components added with the CLI into `@pienance/ui`
  (`dropdown-menu`, `sheet`, `switch`). Colours only from the tokens in `globals.css`
  (`crust-*`, `plate`, `berry`, `tight`, `destructive`, `muted-foreground`…).
- **Every state.** Interactive pieces ship default, hover, focus-visible, active, disabled,
  pending, error and success states. Targets are at least 44px (`h-11`).
- **Motion.** Reuse the existing ink-on and `--dur-long`/`--ease-out`; everything appears at
  once under `prefers-reduced-motion`.
- **Audit.** Run `hallmark audit` on each UI change, at 320, 375, 414 and 768px.

## Known issues the specs rely on

- `PieRepository.find` returns the owner's newest pie with that month's bites. Baking again
  hides every earlier bite. Re-slice removes the need to bake again.
- Slices are mutable rows, so past months are drawn with today's income and shares. Shelf and
  Appetite accept this. Versioned slices are left out until it matters.
- `PrismaPieRepository.save` treats bites as insert-only. Put back and move change that.
