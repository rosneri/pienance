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
packages/ui     @pienance/ui    Shared shadcn/ui components + design system (Tailwind v4).
packages/auth   @pienance/auth  Better Auth: email + password, JWT sessions, JWKS. Server only.
apps/web        @pienance/web   Next.js app (Vercel): UI, server actions, WebMCP tools.
tools/oxlint    anti-slop       Vendored Oxlint rules (github.com/dmmulroy/anti-slop).
.claude/skills  hallmark, install-anti-slop   Vendored agent skills for design and lint upkeep.
```

`@pienance/core` holds everything a future native app needs: the domain (`Pie`, `Slice`, `Bite`,
`Money`, `Currency`, `Proportion`, `roughly()`), the use cases wired through `Ports` (repository, ids, clock),
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

## Authentication

[Better Auth](https://www.better-auth.com) (`packages/auth`), with email and password accounts.
Sessions are cached in a signed **JWT** cookie, and the JWT plugin issues JWTs at
`GET /api/auth/token` and publishes their public keys at `GET /api/auth/jwks`, so APIs and a
future native app (Better Auth has an Expo client) can verify users without calling back. Users,
sessions and keys live in Postgres next to the pies; every pie belongs to a user, and the core's
use cases take that `ownerId` explicitly.

## Money and currencies

Every pie has an ISO 4217 currency, chosen when it is baked; its bites are in the same currency.
`Money` in the core is a thin domain wrapper around [Dinero.js](https://dinerojs.com) v2, which
does the real work: currency definitions with the right minor units (JPY has none, KWD has
three), exact integer arithmetic, rounding, and `allocate` to cut the income into slices without
losing a cent. Amounts are stored in minor units with their currency code. Converting between
currencies (Dinero's `convert` plus a rates port) is the natural next step when a bite is paid in
another currency.

## Design

Components are [shadcn/ui](https://ui.shadcn.com), shared from `packages/ui`. The UI follows [Hallmark](https://github.com/Nutlope/hallmark) (vendored in `.claude/skills/hallmark`):
a custom "cakes and pies, clean, minimalist" theme — cream paper, crust-tone slices, one berry
accent, Fraunces + Geist — on a mobile-first Map / Diagram layout where the pie is the page. The
system is stamped in `packages/ui/src/styles/globals.css`, using shadcn's token names
(`--background`, `--primary`, `--ring`…) so shadcn components pick it up unchanged.

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
cp packages/db/.env.example packages/db/.env    # DATABASE_URL, for migrations
cp apps/web/.env.example apps/web/.env.local    # DATABASE_URL, BETTER_AUTH_SECRET
moon run db:migrate
moon run web:dev
```

## Tests

Vitest everywhere, `moon run :test` (or `moon ci`) runs them all. No module mocking (anti-slop
forbids it): dependencies are passed in, so tests hand in real in-memory adapters or plain
functions instead.

| Project | Unit                                                                         | Integration                                                                            |
| ------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| core    | Money, Currency, Proportion, Month, roughly, Pie, views, sentences, geometry | use cases with the in-memory repository                                                |
| db      | —                                                                            | `PrismaPieRepository` against a real Postgres                                          |
| auth    | —                                                                            | sign up/in/out, JWT cookie, `/token` JWTs verified with the JWKS (`jose`), on Postgres |
| ui      | shadcn components (variants, states, form posting)                           | —                                                                                      |
| web     | components and forms (Testing Library + jsdom), WebMCP tools                 | server actions with auth + Postgres users                                              |

Integration tests get a throwaway Postgres from `@pienance/db/testing`: PGlite runs in-process,
served over the Postgres wire protocol, with the real migrations applied. No Docker needed.

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
2. Connect a Prisma Postgres database (Storage tab / Marketplace) so `DATABASE_URL` is set, and
   add `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) to the project's environment variables.
3. Deploy. Vercel runs `vercel-build`: `prisma migrate deploy`, then `next build`.
