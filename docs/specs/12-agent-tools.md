# Agent tools

Status: proposed · Depends on: each feature for its tools

## Why

CLAUDE.md requires WebMCP tools to mirror the UI. As features land, the tool surface needs one
consistent shape, and agents need one tool the UI does not have yet: finding where an expense
fits best.

## Conventions

- Tool names are verbs from the ubiquitous language in snake case: `take_bite`, `put_back_bite`.
- Slices are named by name, never id. Bites, staples and spreads are named by id, which
  `read_pie` returns.
- Results lead with the same sentence the UI shows, from `@pienance/core/presentation`, then
  structured fields. Errors are the `Outcome` error text, never thrown.
- Read-only tools carry `readOnlyHint: true`.
- Tools are registered from the page state, as today: only valid tools for that state exist.

## Catalogue

| Tool               | Spec                 | Read-only |
| ------------------ | -------------------- | --------- |
| `bake_pie`         | existing             | no        |
| `read_pie`         | existing, extended   | yes       |
| `weigh_bite`       | existing, extended   | yes       |
| `take_bite`        | existing, extended   | no        |
| `find_room`        | this spec            | yes       |
| `put_back_bite`    | Put back and move    | no        |
| `move_bite`        | Put back and move    | no        |
| `reslice_pie`      | Re-slice             | no        |
| `preview_reslice`  | Re-slice             | yes       |
| `stock_staple`     | Staples              | no        |
| `drop_staple`      | Staples              | no        |
| `put_back_spread`  | Spread               | no        |
| `read_shelf`       | Shelf, Appetite      | yes       |
| `carry_over`       | Carry over           | no        |
| `drop_carry`       | Carry over           | no        |
| `set_sweep`        | Sweep                | no        |

Extensions to existing tools: `read_pie` gains `month`, pace, staples, carry and bite ids;
`weigh_bite` and `take_bite` gain `months` and `currency`.

## find_room

"Can I afford a 200 jacket?" without naming a slice.

- Input: `{ amount, currency? }`.
- Weighs the amount against every slice and answers with the best fit: the slice that fits and
  keeps the most left after, preferring `fits` over `tight`.
- "It fits best in Wants, leaving about half of it. It would be tight in Needs."
- When nothing fits: "It does not fit in any slice this month." plus the spread hint if Spread
  exists.

### Core

- `Pie.findRoom(amount): Weighing[]`, every slice weighed, sorted best first.
- Use case `findRoom(ports)({ ownerId, amount })`.
- Presentation: `describeRoom(views)`.

### Web

Also offered in the weigh form: a "Which slice?" option in the slice select that calls
`findRoom` instead of `weighBite`.

## Tests

- Unit: ordering rules, ties broken by slice order, nothing fits.
- WebMCP: one test per tool registered for each page state, through the existing
  `pie-tools.test.tsx` harness with plain functions as actions.
