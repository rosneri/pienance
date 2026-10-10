import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { createPrismaClient, type PrismaClient } from "../client";

const migrations = join(import.meta.dirname, "../../prisma/migrations");

export interface TestDatabase {
  readonly prisma: PrismaClient;
  readonly connectionString: string;
  stop(): Promise<void>;
}

/** Every migration's SQL, in the order Prisma applies them. */
function migrationSql(): string {
  return readdirSync(migrations, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted()
    .map((name) => readFileSync(join(migrations, name, "migration.sql"), "utf8"))
    .join("\n");
}

/**
 * A real, throwaway Postgres for integration tests: PGlite runs in-process and is
 * served over the Postgres wire protocol on a free port, so the app's own Prisma
 * adapter talks to it. The project's migrations are applied first. No Docker needed.
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  const pglite = await PGlite.create();

  await pglite.exec(migrationSql());

  // Port 0 lets the OS pick a free port, so test files and packages can run side by side.
  const server = new PGLiteSocketServer({ db: pglite, port: 0, host: "127.0.0.1" });

  await server.start();

  const connectionString = `postgresql://postgres:postgres@${server.getServerConn()}/postgres?sslmode=disable`;
  const prisma = createPrismaClient(connectionString, 1);

  return {
    prisma,
    connectionString,
    async stop() {
      await prisma.$disconnect();
      await server.stop();
      await pglite.close();
    },
  };
}
