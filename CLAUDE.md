# pienance

Finance app that shows money as proportions of a monthly pie. See README.md for the ubiquitous
language and layout; use those terms (Pie, Slice, Bite, Bake, Weigh, Verdict, Serving, Leftover)
in code, UI and agent tools.

## Standards

- **Business logic lives in `@pienance/core`**, in pure TypeScript: no Node, DOM, framework or
  sibling imports (TypeScript, oxlint and moon all enforce it). It must stay usable from a future
  React Native app. Apps only compose, render and adapt.
- Inside core: `domain/` depends on nothing; `application/` (use cases, `Ports`) on the domain;
  `presentation/` turns domain objects into plain views and sentences; `adapters/` implement ports.
- Use cases are `useCase(ports)(input)`; wiring happens only in a composition root
  (`apps/web/src/pienance.ts`).
- Money is integer cents (`Money`); ratios are `Proportion`; users see `roughly(proportion)`.
- Server actions return `Outcome<T>` values instead of throwing expected errors.
- DDD, SOLID, KISS and YAGNI: add only what a feature needs now, keep it easy to extend.
- Lint is oxlint with the vendored anti-slop rules (`tools/oxlint/anti-slop`); fix findings,
  never suppress them. A type assertion needs a `SAFETY:` comment, and usually a better design.
- UI follows Hallmark (`.claude/skills/hallmark`): mobile first, tokens only (from
  `apps/web/src/app/tokens.css`), no slop-test failures. Run `hallmark audit` on UI changes.
- WebMCP tools (`apps/web/src/components/pie-tools.tsx`) mirror the UI's actions; keep them in
  sync when use cases change.

## Commands

- `moon check --all` before committing (lint, format, typecheck, tests, build).
- `moon run db:migrate` after editing `packages/db/prisma/schema.prisma`.
- Tool versions live in `.prototools`; bump them there, not in CI.
