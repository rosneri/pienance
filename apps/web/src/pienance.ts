import { InMemoryPieRepository, pienance as wire, type PieRepository } from "@pienance/core";
import { PrismaPieRepository, prisma } from "@pienance/db";

declare global {
  // Shared by every server bundle (pages, actions) when running without a database.
  var pienanceMemory: InMemoryPieRepository | undefined;
}

/**
 * Composition root of the web app: the only place that picks adapters.
 * Without DATABASE_URL the app runs in memory, handy for a quick look.
 */
function pieRepository(): PieRepository {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) return new PrismaPieRepository(prisma(databaseUrl));

  globalThis.pienanceMemory ??= new InMemoryPieRepository();

  return globalThis.pienanceMemory;
}

/** The app's one clock, shared by the use cases and the pages. */
export const clock = (): Date => new Date();

export const pienance = wire({
  pies: pieRepository(),
  newId: () => crypto.randomUUID(),
  now: clock,
});
