# pienance

Your money as a pie. Instead of numbers and budgets, pienance talks in rough proportions:
_"Fits. It is about a fifth of your Wants slice and leaves about two thirds of it."_

It answers two questions:

1. **Is this expense worth it?** Weigh it against what is left before buying.
2. **How am I doing?** See this month's bites and how much of the pie is left.

## Ubiquitous language

| Term           | Meaning                                                                 |
| -------------- | ----------------------------------------------------------------------- |
| **Pie**        | The monthly income. The aggregate root.                                 |
| **Slice**      | A named share of the pie (Needs 50%, Wants 30%, Savings 20%).           |
| **Bite**       | An expense, taken from one slice.                                       |
| **Bake**       | Create the pie from a monthly income.                                   |
| **Weigh**      | Consider a bite without taking it: how big is it, what would be left?   |
| **Verdict**    | `fits`, `tight` (leaves only crumbs) or `overflows` (more than left).   |
| **Serving**    | A slice with how much of it is eaten and left this month.               |
| **Leftover**   | What is left of the whole pie this month.                               |
| **Proportion** | A ratio, always shown _roughly_ ("about a quarter"), never as a number. |

These words are used as-is in code, UI, agent tools and conversation.

## Monorepo

Managed with [moon](https://moonrepo.dev) (tasks, project graph, boundaries, CI) and
[proto](https://moonrepo.dev/proto) (tool versions, pinned in `.prototools`), on pnpm workspaces.

```
packages/core   @pienance/core  Pure TypeScript: domain, use cases, views. No Node, DOM or framework.
packages/db     @pienance/db    Prisma Postgres adapter for the PieRepository port. Server only.
apps/web        @pienance/web   Next.js app (Vercel): UI, server actions, WebMCP tools.
tools/oxlint    anti-slop       Vendored Oxlint rules (github.com/dmmulroy/anti-slop).
.claude/skills  hallmark, install-anti-slop   Vendored agent skills for design and lint upkeep.
```

`@pienance/core` holds everything a future native app needs: the domain (`Pie`, `Slice`, `Bite`,
`Money`, `Proportion`, `roughly()`), the use cases wired through `Ports` (repository, ids, clock),
serialisable views, the sentences users read, and the SVG geometry of the pie. Its `tsconfig.json`
has no DOM or Node types, so anything platform-specific fails to compile.

Boundaries are enforced three ways:

- **moon**: layers (`application` → `library`) and tags (`portable` only depends on `portable`).
- **oxlint**: `no-restricted-imports` per package (core imports no framework, Node or sibling).
- **TypeScript**: core compiles against plain ES2024 only.

### Why Next.js

Pienance is an app, not a content site: it reads and writes data on every interaction. Next.js
server actions keep that simple, and React carries over to React Native when the native app comes.
Astro shines for content-first sites, which this isn't.

## Design

The UI follows [Hallmark](https://github.com/Nutlope/hallmark) (vendored in `.claude/skills/hallmark`):
a custom "cakes and pies, clean, minimalist" theme — cream paper, crust-tone slices, one berry
accent, Fraunces + Geist — on a mobile-first Map / Diagram layout where the pie is the page. The
system is stamped in `apps/web/src/app/tokens.css`; every colour and font goes through those tokens.

## AI agents (WebMCP)

The web app registers [WebMCP](https://github.com/webmachinelearning/webmcp) tools so in-browser
agents can use pienance directly: `bake_pie` before a pie exists, then `read_pie`, `weigh_bite`
(read-only) and `take_bite`. They call the same server actions as the UI, so the page stays in sync.

## Getting started

```sh
proto use           # installs node, pnpm and moon from .prototools
pnpm install
moon run web:dev    # runs in memory when DATABASE_URL is not set
```

With a database:

```sh
cp packages/db/.env.example packages/db/.env   # DATABASE_URL (Prisma Postgres)
moon run db:migrate
moon run web:dev
```

## Tasks

Every project inherits `lint` (oxlint + anti-slop), `format` (oxfmt) and `typecheck` from
`.moon/tasks/all.yml`; projects tagged `tested` also get `test` (Vitest).

| Command               | Does                                      |
| --------------------- | ----------------------------------------- |
| `moon check --all`    | every task of every project               |
| `moon ci`             | only what a change affects (used in CI)   |
| `moon run :lint`      | lint everything                           |
| `moon run core:test`  | test the core                             |
| `moon run web:build`  | production build                          |
| `moon run db:migrate` | create/apply a migration in development   |
| `moon project-graph`  | see how the projects depend on each other |

moon installs a pre-commit hook that lints and format-checks staged changes.

## Pull requests

`.github/workflows/standards.yml` checks every PR:

1. **Checks** — `moon ci`: lint with anti-slop, format, typecheck, tests and build of affected projects.
2. **Review** — Claude reviews architecture (DDD, purity of core, KISS/YAGNI), anti-slop intent and,
   for UI changes, runs a Hallmark audit. Needs the `ANTHROPIC_API_KEY` repository secret; skipped
   on drafts.

## Deploying to Vercel

1. Import the repository in Vercel and set the **Root Directory** to `apps/web`.
2. Connect a Prisma Postgres database (Storage tab / Marketplace) so `DATABASE_URL` is set.
3. Deploy. Vercel runs `vercel-build`: `prisma migrate deploy`, then `next build`.
