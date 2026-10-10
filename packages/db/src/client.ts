import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

declare global {
  // Survives hot reloads in development, so each reload does not open a new pool.
  var pienancePrisma: PrismaClient | undefined;
}

export type { PrismaClient };

export function createPrismaClient(
  connectionString: string,
  maxConnections?: number,
): PrismaClient {
  const pool =
    maxConnections === undefined ? { connectionString } : { connectionString, max: maxConnections };

  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

/** One client per process. */
export function prisma(connectionString: string): PrismaClient {
  globalThis.pienancePrisma ??= createPrismaClient(connectionString);

  return globalThis.pienancePrisma;
}
