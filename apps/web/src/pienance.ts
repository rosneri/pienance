import { createAuth, type Auth } from "@pienance/auth";
import { InMemoryPieRepository, pienance as wire, type PieRepository } from "@pienance/core";
import { PrismaPieRepository, prisma } from "@pienance/db";
import { memoryAdapter } from "better-auth/adapters/memory";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

declare global {
  // Shared by every server bundle (pages, actions, routes) when running without a database.
  var pienanceMemory:
    | { pies: InMemoryPieRepository; auth: Parameters<typeof memoryAdapter>[0] }
    | undefined;
}

/**
 * Composition root of the web app: the only place that picks adapters.
 * Without DATABASE_URL the app runs in memory, handy for a quick look.
 */
const databaseUrl = process.env.DATABASE_URL;

function memory() {
  globalThis.pienanceMemory ??= {
    pies: new InMemoryPieRepository(),
    auth: { user: [], session: [], account: [], verification: [], jwks: [] },
  };

  return globalThis.pienanceMemory;
}

function pieRepository(): PieRepository {
  return databaseUrl ? new PrismaPieRepository(prisma(databaseUrl)) : memory().pies;
}

function authSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;

  if (secret) return secret;

  if (process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_SECRET is not set");

  return "pienance-development-secret-not-for-production";
}

function baseURL(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return "http://localhost:3000";
}

/** The app's one clock, shared by the use cases and the pages. */
export const clock = (): Date => new Date();

export const pienance = wire({
  pies: pieRepository(),
  newId: () => crypto.randomUUID(),
  now: clock,
});

let authInstance: Auth | undefined;

/** Created on first use, so building the app does not need runtime secrets. */
export function auth(): Auth {
  authInstance ??= createAuth({
    database: databaseUrl
      ? prismaAdapter(prisma(databaseUrl), { provider: "postgresql" })
      : memoryAdapter(memory().auth),
    secret: authSecret(),
    baseURL: baseURL(),
    plugins: [nextCookies()],
  });

  return authInstance;
}
