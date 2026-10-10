import { createAuth, type Auth } from "@pienance/auth";
import { InMemoryPieRepository, pienance as wire, type PieRepository } from "@pienance/core";
import { databaseUrlFrom, PrismaPieRepository, prisma } from "@pienance/db";
import { memoryAdapter } from "better-auth/adapters/memory";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { authSecretFrom, baseUrlFrom, trustedOriginsFrom } from "./environment";

declare global {
  // Shared by every server bundle (pages, actions, routes) when running without a database.
  var pienanceMemory:
    | { pies: InMemoryPieRepository; auth: Parameters<typeof memoryAdapter>[0] }
    | undefined;
}

/**
 * Composition root of the web app: the only place that picks adapters.
 * Without a database URL the app runs in memory, handy for a quick look.
 */
const databaseUrl = databaseUrlFrom(process.env);

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
    secret: authSecretFrom(process.env, databaseUrl),
    baseURL: baseUrlFrom(process.env),
    trustedOrigins: trustedOriginsFrom(process.env),
    plugins: [nextCookies()],
  });

  return authInstance;
}
