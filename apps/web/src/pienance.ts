import { trace } from "@opentelemetry/api";
import { createAuth, type Auth } from "@pienance/auth";
import {
  InMemoryPieRepository,
  noAdvice,
  pienance as wire,
  type Pienance,
  type PieRepository,
} from "@pienance/core";
import { databaseUrlFrom, PrismaPieRepository, prisma } from "@pienance/db";
import type { ProductEvent } from "@pienance/telemetry/contract";
import {
  discardingWriter,
  PostgresTelemetryReader,
  PostgresTelemetryWriter,
  productEventRow,
  startTracing,
  TailSampler,
  telemetryPool,
  traced,
  WriterSpanExporter,
  type Queryable,
  type TelemetryReader,
  type TelemetryWriter,
} from "@pienance/telemetry/server";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import { attachDatabasePool, waitUntil } from "@vercel/functions";
import { memoryAdapter } from "better-auth/adapters/memory";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { after } from "next/server";
import { decisionAdvisor } from "./import/decision-advisor";
import {
  aiGatewayFrom,
  authSecretFrom,
  baseUrlFrom,
  deploymentFrom,
  sampleRatioFrom,
  trustedOriginsFrom,
} from "./environment";

declare global {
  // Shared by every server bundle (pages, actions, routes) when running without a database.
  var pienanceMemory:
    | { pies: InMemoryPieRepository; auth: Parameters<typeof memoryAdapter>[0] }
    | undefined;

  // One small telemetry pool per instance, shared by instrumentation, actions and routes.
  var pienanceTelemetryPool: ReturnType<typeof telemetryPool> | undefined;
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

const app = wire({
  pies: pieRepository(),
  // Statements are read by rules alone until the AI Gateway is reachable.
  advisor: aiGatewayFrom(process.env) ? decisionAdvisor() : noAdvice,
  newId: () => crypto.randomUUID(),
  now: clock,
});

/** The use cases, each in its own span so traces show what the app did, not just the route. */
export const pienance: Pienance = {
  bakePie: traced("pienance.bakePie", app.bakePie),
  servePie: traced("pienance.servePie", app.servePie),
  weighBite: traced("pienance.weighBite", app.weighBite),
  takeBite: traced("pienance.takeBite", app.takeBite),
  readStatement: traced("pienance.readStatement", app.readStatement),
  takeBites: traced("pienance.takeBites", app.takeBites),
};

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

// ── Telemetry (docs/telemetry.md) ─────────────────────────────────────────

/** A pooled URL is best: TELEMETRY_DATABASE_URL, else the app's own database. */
const telemetryUrl = process.env.TELEMETRY_DATABASE_URL ?? databaseUrl;

export const deployment = deploymentFrom(process.env);

/** The telemetry database, or null when telemetry has nowhere to go. Connects lazily. */
export function telemetryDatabase(): Queryable | null {
  if (!telemetryUrl) return null;

  if (!globalThis.pienanceTelemetryPool) {
    globalThis.pienanceTelemetryPool = telemetryPool(telemetryUrl);
    // On Vercel Fluid compute, closes idle clients before the instance is suspended.
    attachDatabasePool(globalThis.pienanceTelemetryPool);
  }

  return globalThis.pienanceTelemetryPool;
}

export function telemetryWriter(): TelemetryWriter {
  const database = telemetryDatabase();

  return database ? new PostgresTelemetryWriter(database) : discardingWriter;
}

/** Starts server tracing; called once per instance from instrumentation.ts. */
export function startServerTelemetry(): void {
  if (!telemetryUrl) return;

  startTracing({
    service: "pienance-web",
    deployment: deployment ?? "local",
    processor: new TailSampler({
      exporter: new WriterSpanExporter(telemetryWriter()),
      keepRatio: sampleRatioFrom(process.env),
      slowMs: 1_000,
      defer: waitUntil,
    }),
    instrumentations: [new PrismaInstrumentation()],
  });
}

/** Records a product event after the response is sent; telemetry never fails a request. */
export function track(event: ProductEvent, ownerId: string): void {
  const row = productEventRow(event, {
    id: crypto.randomUUID(),
    at: clock(),
    userId: ownerId,
    traceId: trace.getActiveSpan()?.spanContext().traceId ?? null,
    deployment,
  });

  after(() =>
    telemetryWriter()
      .events([row])
      .catch(() => undefined),
  );
}

/** Reads telemetry for the admin pages, or null without a database. */
export function telemetryReader(): TelemetryReader | null {
  const database = telemetryDatabase();

  return database ? new PostgresTelemetryReader(database) : null;
}
