# Feature specs

Proposed features, one spec each. Every spec names its new terms, the change per core layer,
persistence, web, UX, acceptance criteria and tests, following CLAUDE.md. New terms join the
README's ubiquitous language when a spec is built.

Suggested order: small, independent and visible first, then features that build on them.

| #   | Spec                                         | In one line                                           | Depends on   | Schema change |
| --- | -------------------------------------------- | ----------------------------------------------------- | ------------ | ------------- |
| 1   | [Pace](01-pace.md)                           | Is a slice eaten faster than the month is passing?    | none         | no            |
| 2   | [Put back and move](02-put-back-and-move.md) | Undo or re-file a bite.                               | none         | no            |
| 3   | [Re-slice](03-re-slice.md)                   | Edit income and slices in place.                      | none         | yes           |
| 4   | [Staples](04-staples.md)                     | Monthly expenses counted from day one.                | none         | yes           |
| 5   | [Spread](05-spread.md)                       | Weigh and take an expense over several months.        | 2            | yes           |
| 6   | [Shelf](06-shelf.md)                         | Past months as small pies.                            | none         | no            |
| 7   | [Carry over](07-carry-over.md)               | Put last month's leftover into a slice.               | 6            | yes           |
| 8   | [Appetite](08-appetite.md)                   | How each slice is usually eaten, in a sentence.       | 6            | no            |
| 9   | [Sweep](09-sweep.md)                         | Round bites up and count the difference as saved.     | none         | yes           |
| 10  | [Foreign bites](10-foreign-bites.md)         | Bites in other currencies, converted at a fixed rate. | none         | yes           |
| 11  | [Weigh anywhere](11-weigh-anywhere.md)       | Installable app, shortcut and share target.           | none         | no            |
| 12  | [Agent tools](12-agent-tools.md)             | Tool conventions, catalogue, and `find_room`.         | each feature | no            |
| 13  | [Shared pie](13-shared-pie.md)               | Several people eating from one pie.                   | 2            | yes           |

Specs that touch the same thing say what happens when both are built, under "Interactions" in
their Behaviour section. The later spec in the build order owns the rule.

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
- **Components and tokens.** `@pienance/ui` has `button`, `field`, `input`, `label`,
  `native-select`, `radio-group` and `separator` today. Specs add `checkbox`, `dropdown-menu`,
  `sheet` and `switch` with the shadcn CLI. Colours only from the tokens in `globals.css`
  (`crust-1..3`, `plate`, `berry`, `tight`, `destructive`, `muted-foreground`, `secondary`…).
- **Every state.** Interactive pieces ship default, hover, focus-visible, active, disabled,
  pending, error and success states. Targets are at least 44px (`h-11`).
- **Motion.** Reuse the existing ink-on and `--dur-long`/`--ease-out`; everything appears at
  once under `prefers-reduced-motion`.
- **Audit.** Run `hallmark audit` on each UI change, at 320, 375, 414 and 768px.

## Known facts the specs rely on

- `PieRepository.find` returns the owner's newest pie (by `createdAt`) with only the requested
  month's bites. Months reset by themselves. Baking again hides every earlier bite. Re-slice
  removes the need to bake again.
- Months are UTC calendar months (`Month.of` reads UTC fields, `Ports.now` is the only clock).
  A bite taken late on the 31st local time can land in the next UTC month. Every spec accepts
  this; a viewer time zone is out of scope.
- Slices are mutable rows, so past months are drawn with today's income and shares. Shelf and
  Appetite accept this. Versioned slices are left out until it matters.
- `PrismaPieRepository.save` writes bites with `createMany … skipDuplicates`, so bites are
  insert-only. `InMemoryPieRepository.save` merges stored bites by id, so a bite missing from
  the pie is kept. Put back and move change both.
- `viewPie` computes wedge angles from `share`, not from money. Carry over changes that.
- The `takeBite` server action returns `Outcome<string>` (the bite id) and the weigh form
  treats a take as silent success. Put back and move change both.
- `Money` holds minor units as a safe integer (`Money.ofMinor(number)`); rows store `BigInt`
  and the repository converts. Money never leaves the core as a plain number in a view.
- `Pie.bake` accepts any slice whose shares add up to the whole within 0.001.
  `Money.split` (Dinero `allocate`) accepts a share of none and gives it nothing.
