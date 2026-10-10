import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

declare global {
  // Survives hot reloads in development, so each reload does not open a new pool.
  var pienancePrisma: PrismaClient | undefined;
}

function createClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** One client per process. */
export function prisma(connectionString: string): PrismaClient {
  globalThis.pienancePrisma ??= createClient(connectionString);

  return globalThis.pienancePrisma;
}
