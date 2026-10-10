import { startTestDatabase, type TestDatabase } from "@pienance/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { beaconRows, productEventRow } from "./ingest";
import { maintainTelemetry } from "./maintenance";
import { PostgresTelemetryWriter, telemetryPool } from "./postgres-writer";
import type { SpanRow } from "./rows";

let database: TestDatabase;

let pool: ReturnType<typeof telemetryPool>;

let writer: PostgresTelemetryWriter;

beforeAll(async () => {
  database = await startTestDatabase();
  pool = telemetryPool(database.connectionString);
  writer = new PostgresTelemetryWriter(pool);
});

afterAll(async () => {
  await pool.end();
  await database.stop();
});

async function count(table: string): Promise<number> {
  const result = await pool.query<{ count: string }>(`SELECT count(*) FROM telemetry.${table}`);

  return Number(result.rows[0]?.count);
}

const now = new Date();

const span: SpanRow = {
  startTime: now,
  traceId: "0af7651916cd43dd8448eb211c80319c",
  spanId: "b7ad6b7169203331",
  parentSpanId: null,
  name: "GET /",
  kind: 1,
  durationUs: 12_345,
  statusCode: 0,
  statusMessage: null,
  service: "pienance-web",
  deployment: "dpl_1",
  httpRoute: "/",
  httpMethod: "GET",
  httpStatus: 200,
  userId: "owner-1",
  attributes: { "http.route": "/", "next.span_type": "BaseServer.handleRequest" },
  events: [
    {
      name: "exception",
      time: now.toISOString(),
      attributes: { "exception.message": 'it\'s "quoted"' },
    },
  ],
};

describe("PostgresTelemetryWriter", () => {
  it("stores spans with hex ids as bytes and attributes as jsonb", async () => {
    await writer.spans([
      span,
      { ...span, spanId: "00f067aa0ba902b7", parentSpanId: span.spanId, kind: 0 },
    ]);

    const result = await pool.query<{
      trace: string;
      parent: string | null;
      route: string;
      message: string;
    }>(
      `SELECT encode(trace_id, 'hex') AS trace, encode(parent_span_id, 'hex') AS parent,
         attributes->>'http.route' AS route, events->0->'attributes'->>'exception.message' AS message
       FROM telemetry.spans ORDER BY parent NULLS FIRST`,
    );

    expect(result.rows).toEqual([
      { trace: span.traceId, parent: null, route: "/", message: 'it\'s "quoted"' },
      { trace: span.traceId, parent: span.spanId, route: "/", message: 'it\'s "quoted"' },
    ]);
  });

  it("stores a retried batch once", async () => {
    const before = await count("spans");

    await writer.spans([span]);

    expect(await count("spans")).toBe(before);
  });

  it("stores browser events, vitals and server events", async () => {
    const received = { at: now, userId: null, deployment: null, device: "desktop", country: null };

    const { events, vitals } = beaconRows(
      {
        sessionId: "4f9c1f0e-5d5a-4c1e-9a77-0d1c2b3a4f5e",
        anonymousId: "0b8e2a6c-1f3d-4e5a-8b7c-9d0e1f2a3b4c",
        items: [
          {
            type: "event",
            id: "a3c1e5f7-2b4d-4f6a-8c0e-1d3f5a7b9c2e",
            name: "$click",
            at: now.getTime(),
            path: "/",
            properties: { target: "weigh" },
          },
          {
            type: "vital",
            id: "v1",
            name: "LCP",
            value: 900,
            rating: "good",
            at: now.getTime(),
            path: "/",
          },
          {
            type: "vital",
            id: "v2",
            name: "LCP",
            value: 4_100,
            rating: "poor",
            at: now.getTime(),
            path: "/",
          },
        ],
      },
      received,
    );

    await writer.events([
      ...events,
      productEventRow(
        { name: "pie.baked", properties: { currency: "EUR" } },
        {
          id: "c9d2e4f6-1a3b-4c5d-8e7f-9a0b1c2d3e4f",
          at: now,
          userId: "owner-1",
          traceId: span.traceId,
          deployment: null,
        },
      ),
    ]);
    await writer.vitals(vitals);

    const stored = await pool.query<{ name: string; target: string | null; trace: string | null }>(
      `SELECT name, properties->>'target' AS target, encode(trace_id, 'hex') AS trace
       FROM telemetry.events ORDER BY name`,
    );

    expect(stored.rows).toEqual([
      { name: "$click", target: "weigh", trace: null },
      { name: "pie.baked", target: null, trace: span.traceId },
    ]);
    expect(await count("web_vitals")).toBe(2);
  });
});

describe("maintainTelemetry", () => {
  it("rolls up routes and vitals, idempotently", async () => {
    await maintainTelemetry(pool, { daysAhead: 3, keepDays: 14 });
    await maintainTelemetry(pool, { daysAhead: 3, keepDays: 14 });

    const routes = await pool.query<{ route: string; requests: number; p50_ms: number }>(
      "SELECT route, requests, p50_ms FROM telemetry.route_rollups",
    );

    const vitals = await pool.query<{ samples: number; good: number; poor: number }>(
      "SELECT samples, good, poor FROM telemetry.vital_rollups",
    );

    expect(routes.rows).toEqual([{ route: "/", requests: 1, p50_ms: 12.345 }]);
    expect(vitals.rows).toEqual([{ samples: 2, good: 1, poor: 1 }]);
  });

  it("creates partitions ahead and drops expired ones", async () => {
    await pool.query(
      "CREATE TABLE telemetry.events_20000101 PARTITION OF telemetry.events FOR VALUES FROM ('2000-01-01') TO ('2000-01-02')",
    );

    await maintainTelemetry(pool, { daysAhead: 5, keepDays: 14 });

    const partitions = await pool.query<{ name: string }>(
      `SELECT c.relname AS name FROM pg_inherits i
       JOIN pg_class c ON c.oid = i.inhrelid JOIN pg_class p ON p.oid = i.inhparent
       WHERE p.relname = 'events' ORDER BY 1`,
    );

    const names = partitions.rows.map((row) => row.name);

    const ahead = new Date(Date.now() + 5 * 86_400_000)
      .toISOString()
      .slice(0, 10)
      .replaceAll("-", "");

    expect(names).not.toContain("events_20000101");
    expect(names).toContain(`events_${ahead}`);
  });
});
