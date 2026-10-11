import { createHash } from "node:crypto";

type Env = Readonly<Record<string, string | undefined>>;

/**
 * The secret that signs sessions and JWTs. BETTER_AUTH_SECRET wins; otherwise one is
 * derived from the database URL, which is just as secret and only known to the server
 * (whoever holds it can read every pie anyway). Development without either uses a fixed one.
 */
export function authSecretFrom(env: Env, databaseUrl: string | undefined): string {
  if (env.BETTER_AUTH_SECRET) return env.BETTER_AUTH_SECRET;

  if (databaseUrl) {
    return createHash("sha256").update(`pienance-auth:${databaseUrl}`).digest("base64url");
  }

  if (env.NODE_ENV === "production") {
    throw new Error("Set BETTER_AUTH_SECRET (or DATABASE_URL) to sign sessions in production");
  }

  return "pienance-development-secret-not-for-production";
}

function https(host: string | undefined): string | undefined {
  return host ? `https://${host}` : undefined;
}

/** The app's public URL: explicit, else the Vercel production or branch URL, else localhost. */
export function baseUrlFrom(env: Env): string {
  return (
    env.BETTER_AUTH_URL ??
    (env.VERCEL_ENV === "production" ? https(env.VERCEL_PROJECT_PRODUCTION_URL) : undefined) ??
    https(env.VERCEL_BRANCH_URL) ??
    https(env.VERCEL_URL) ??
    "http://localhost:3000"
  );
}

/** Every URL a Vercel deployment answers on, so sign-in works from any of them. */
export function trustedOriginsFrom(env: Env): string[] {
  return [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL].flatMap(
    (host) => https(host) ?? [],
  );
}

/** Share of ordinary traces kept (errors and slow ones always are): TELEMETRY_SAMPLE_RATIO, 0..1. */
export function sampleRatioFrom(env: Env): number {
  const ratio = Number(env.TELEMETRY_SAMPLE_RATIO ?? "1");

  return Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 1;
}

/** Which deployment produced a span or event: Vercel's deployment id, else the git commit. */
export function deploymentFrom(env: Env): string | null {
  return env.VERCEL_DEPLOYMENT_ID ?? env.VERCEL_GIT_COMMIT_SHA ?? null;
}

/** Whether the Vercel AI Gateway can be called: with an API key, or on Vercel with its OIDC token. */
export function aiGatewayFrom(env: Env): boolean {
  return Boolean(env.AI_GATEWAY_API_KEY) || env.VERCEL === "1";
}
