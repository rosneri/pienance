# Agent tools

Status: proposed · Depends on: each feature for its tools

## Why

CLAUDE.md requires WebMCP tools to mirror the UI. As features land, the tool surface needs one
consistent shape, and agents need one tool the UI does not have yet: finding where an expense
fits best.

## Conventions

- Tool names are verbs from the ubiquitous language in snake case: `take_bite`, `put_back_bite`.
- Slices are named by name, never id, from the page's live slices. Bites, staples and spreads
  are named by id, which `read_pie` returns.
- Results lead with the same sentence the UI shows, from `@pienance/core/presentation`, then
  structured fields. Errors are the `Outcome` error text, never thrown.
- Read-only tools carry `annotations: { readOnlyHint: true }`.
- Tools are registered from the page state, as today: only valid tools for that state exist.
  No pie: `bake_pie`. A past month (06): `read_pie` and `read_shelf`. A guest (13): no
  `reslice_pie`, `preview_reslice`, `carry_over`, `drop_carry` or `set_sweep`.
- Every tool calls the same server action as the UI, so `refresh()` re-renders the page.

## Catalogue

| Tool              | Spec               | Read-only |
| ----------------- | ------------------ | --------- |
| `bake_pie`        | existing           | no        |
| `read_pie`        | existing, extended | yes       |
| `weigh_bite`      | existing, extended | yes       |
| `take_bite`       | existing, extended | no        |
| `find_room`       | this spec          | yes       |
| `put_back_bite`   | Put back and move  | no        |
| `move_bite`       | Put back and move  | no        |
| `reslice_pie`     | Re-slice           | no        |
| `preview_reslice` | Re-slice           | yes       |
| `stock_staple`    | Staples            | no        |
| `drop_staple`     | Staples            | no        |
| `put_back_spread` | Spread             | no        |
| `read_shelf`      | Shelf, Appetite    | yes       |
| `carry_over`      | Carry over         | no        |
| `drop_carry`      | Carry over         | no        |
| `set_sweep`       | Sweep              | no        |

Extensions to existing tools: `read_pie` gains `month` (06), pace (01), bites as objects with
ids and `spreadId` (02, 05), staples (04), carry and offer (07), sweep (09), `takenBy` (13);
`weigh_bite` and `take_bite` gain `months` (05) and `currency` (10). Shared pie (13) adds no
tool: inviting stays a human action.

## find_room

"Can I afford a 200 jacket?" without naming a slice.

- Input: `{ amount, currency?, months? }` (`currency` with 10, `months` with 05).
- Weighs the amount against every live slice and answers with the best fit: `fits` before
  `tight` before `overflows`; within a verdict, the most `leftAfter`; ties keep slice order.
- "It fits best in Wants, leaving about half of it. It would be tight in Needs." The second
  sentence names the next best slice when its verdict differs; otherwise it is omitted.
- When nothing fits: "It does not fit in any slice this month." With Spread built, it adds
  "Over 6 months it would fit in Wants." using `fewestMonthsToFit` on the best slice.

### Core

- `Pie.findRoom(amount): Weighing[]`, every live slice weighed, sorted best first.
- Use case `findRoom(ports)({ ownerId, amount, currency?, months? })`.
- Presentation: `describeRoom(views: WeighingView[], spreadHint?: string): string`.

### Web

- Server action `findRoom(input): Outcome<WeighingView[]>`.
- Also offered in the weigh form: a "Not sure" pill that makes "Weigh it" call `findRoom`.

## UX

- **Same words.** Agents and the page say the same sentences, so a person reading an agent's
  reply recognises the app's voice.
- **Same page.** Every tool goes through the server actions, so the page refreshes after an
  agent acts. No separate "done by your assistant" marker.
- **Which slice?** The weigh form's slice pills gain a first option, "Not sure". With it, "Weigh
  it" calls `findRoom`. The answer names the best slice and selects its pill, so "Take the
  bite" then takes from it. "Take the bite" with "Not sure" still selected weighs instead,
  and the answer asks: "Pick a slice first."
  - "It fits best in Wants, leaving about half of it. It would be tight in Needs."
  - "It does not fit in any slice this month." With Spread, a "Spread it to fit" button follows.
- **Default.** "Not sure" is not preselected. The first slice stays the default, as today.

## Acceptance criteria

- [ ] `findRoom` orders `fits` before `tight` before `overflows`, then by most left after, then
      slice order; retired slices are skipped.
- [ ] The sentence names the best slice and, when it differs in verdict, the next best.
- [ ] When nothing fits the sentence says so, with the spread hint once Spread exists.
- [ ] Every tool in the catalogue is registered only in the page states listed above, with
      `readOnlyHint` on the read-only ones.
- [ ] Every tool answers with the page's sentence and returns errors as text.
- [ ] "Not sure" routes "Weigh it" to `findRoom` and selects the best slice's pill.

## Tests

- Unit: ordering rules, ties broken by slice order, nothing fits, retired slices skipped.
- WebMCP: one test per tool registered for each page state, through the existing
  `pie-tools.test.tsx` harness with plain functions as actions.
- Component: "Not sure" pill calls `findRoom` and selects the answer's slice.
