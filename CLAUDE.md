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
- Money goes through `Money` (Dinero.js underneath) with an ISO 4217 `Currency`; never do money
  arithmetic with plain numbers. Ratios are `Proportion`; users see `roughly(proportion)`.
- Server actions return `Outcome<T>` values instead of throwing expected errors.
- DDD, SOLID, KISS and YAGNI: add only what a feature needs now, keep it easy to extend.
- Lint is oxlint with the vendored anti-slop rules (`tools/oxlint/anti-slop`); fix findings,
  never suppress them. A type assertion needs a `SAFETY:` comment, and usually a better design.
- UI is built from shadcn/ui components in `@pienance/ui` (add new ones with the shadcn CLI, which
  routes them there) and Tailwind utilities on the shared tokens. It follows Hallmark
  (`.claude/skills/hallmark`): mobile first, tokens only (`packages/ui/src/styles/globals.css`),
  no slop-test failures. Run `hallmark audit` on UI changes.
- Authentication is Better Auth via `@pienance/auth`; pages and actions get the user with
  `ownerOf(auth(), headers)`. Business code never reads sessions: it receives an `ownerId`.
- Every feature ships with Vitest tests: unit tests for logic, integration tests across real
  adapters (in-memory, or Postgres via `@pienance/db/testing`). No `vi.mock`: pass dependencies
  in. UI components take their actions as props so tests can hand in plain functions.
- WebMCP tools (`apps/web/src/components/pie-tools.tsx`) mirror the UI's actions; keep them in
  sync when use cases change.

## Commands

- `moon check --all` before committing (lint, format, typecheck, tests, build).
- `moon run db:migrate` after editing `packages/db/prisma/schema.prisma`.
- Tool versions live in `.prototools`; bump them there, not in CI.
