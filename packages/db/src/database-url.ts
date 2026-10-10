/**
 * Names under which hosts publish a Postgres connection string, in order of preference.
 * Prisma Postgres on Vercel sets some of these depending on how it was connected.
 */
const candidates = ["DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "DATABASE_URL_UNPOOLED"];

/** The first direct postgres:// connection string in the environment, if any. */
export function databaseUrlFrom(
  env: Readonly<Record<string, string | undefined>>,
): string | undefined {
  return candidates
    .map((name) => env[name])
    .find((value) => value?.startsWith("postgres://") || value?.startsWith("postgresql://"));
}
