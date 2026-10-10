# pienance

Your money as a pie. Instead of numbers and budgets, pienance talks in rough proportions:
_"that is about a third of your Wants slice and would leave about two thirds of it."_

It answers two questions:

1. **Is this expense worth it?** Weigh it against what is left before buying.
2. **How am I doing?** See past expenses and how much of the pie is left this month.

## Ubiquitous language

| Term           | Meaning                                                                 |
| -------------- | ----------------------------------------------------------------------- |
| **Pie**        | The monthly income. The aggregate root.                                 |
| **Slice**      | A named share of the pie (Needs 50%, Wants 30%, Savings 20%).           |
| **Bite**       | An expense, taken from one slice.                                       |
| **Weigh**      | Consider a bite without taking it: how big is it, what would be left?   |
| **Verdict**    | `fits`, `tight` (leaves only crumbs) or `overflows` (more than left).   |
| **Serving**    | A slice with how much of it is eaten and left this month.               |
| **Leftover**   | What is left of the whole pie this month.                               |
| **Proportion** | A ratio, always shown _roughly_ ("about a quarter"), never as a number. |
| **Bake**       | Create the pie from a monthly income.                                   |

These words are used as-is in code, UI and conversation.

## Architecture

Domain-driven, layered, dependencies point inwards only (enforced by `oxlint`):

```
src/
  domain/          Pure model: Pie, Slice, Bite, Money, Proportion, Month, roughly(). No frameworks.
  application/     Use cases (bakePie, servePie, weighBite, takeBite). Depend on domain ports only.
  infrastructure/  Adapters: Prisma repository, in-memory repository, composition root (container.ts).
  app/             Next.js App Router UI and server actions. Calls use cases through the container.
prisma/            Schema and migrations.
```

- **Ports and adapters**: `PieRepository` is declared in the domain and implemented by
  `PrismaPieRepository` and `InMemoryPieRepository`. New storage = new adapter, nothing else changes.
- **Use cases** are plain functions taking their dependencies: `weighBite(pies)(input)`.
- **Composition root** (`src/infrastructure/container.ts`) is the only place that wires things.
- **YAGNI**: one pie, default 50/30/20 slices, one currency, no auth. Each is a deliberate next step,
  not an omission to work around.

## Stack

Next.js (App Router, server actions) · React · TypeScript 7 · Prisma 7 + Prisma Postgres ·
Vitest · oxlint · oxfmt · pnpm · Vercel.

## Getting started

```sh
pnpm install
pnpm dev            # runs in memory when DATABASE_URL is not set
```

With a database:

```sh
cp .env.example .env   # set DATABASE_URL to your Prisma Postgres connection string
pnpm db:migrate        # apply migrations in development
pnpm dev
```

## Scripts

| Script            | Does                                    |
| ----------------- | --------------------------------------- |
| `pnpm check`      | lint + format check + typecheck + tests |
| `pnpm lint`       | oxlint                                  |
| `pnpm format`     | oxfmt (write); `format:check` to verify |
| `pnpm typecheck`  | tsc                                     |
| `pnpm test`       | vitest                                  |
| `pnpm db:migrate` | create/apply a migration in development |

## Deploying to Vercel

1. Import the repository in Vercel.
2. Connect a Prisma Postgres database (Storage tab / Marketplace) so `DATABASE_URL` is set.
3. Deploy. Vercel runs `vercel-build`: `prisma generate && prisma migrate deploy && next build`.
