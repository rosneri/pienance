# pienance

Finance app that shows money as proportions of a monthly pie. See README.md for the ubiquitous
language and architecture; use those terms (Pie, Slice, Bite, Weigh, Verdict, Serving, Leftover) in
code and UI.

## Rules

- `src/domain` is pure TypeScript: no Next, React, Prisma or outer-layer imports (oxlint enforces).
- `src/application` depends on the domain only; use cases are `useCase(deps)(input)` functions.
- Wiring happens only in `src/infrastructure/container.ts`.
- Money is integer cents (`Money`); ratios are `Proportion`; users see `roughly(proportion)`, not numbers.
- KISS and YAGNI: add only what a feature needs now.
- Before committing run `pnpm check` (lint, format check, typecheck, tests).
- Schema changes: edit `prisma/schema.prisma`, then `pnpm db:migrate` to create a migration.
