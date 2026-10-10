import { startTestDatabase, type TestDatabase } from "@pienance/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { beaconRows, productEventRow } from "./ingest";
import { PostgresTelemetryWriter, telemetryPool } from "./postgres-writer";
import { PostgresTelemetryReader } from "./reader";
import type { SpanRow } from "./rows";

let database: TestDatabase;

let pool: ReturnType<typeof telemetryPool>;

let reader: PostgresTelemetryReader;

const now = new Date();

const hourAgo = new Date(now.getTime() - 3_600_000);

const okTrace = "0af7651916cd43dd8448eb211c80319c";

const failedTrace = "1bf7651916cd43dd8448eb211c80319d";

function span(overrides: Partial<SpanRow>): SpanRow {
  return {
    startTime: now,
    traceId: okTrace,
    spanId: "b7ad6b7169203331",
    parentSpanId: null,
    name: "GET /",
    kind: 1,
    durationUs: 20_000,
    statusCode: 0,
    statusMessage: null,
    service: "pienance-web",
    deployment: null,
    httpRoute: "/",
    httpMethod: "GET",
    httpStatus: 200,
    userId: null,
    attributes: {},
    events: null,
    ...overrides,
  };
}

beforeAll(async () => {
  database = await startTestDatabase();
  pool = telemetryPool(database.connectionString);
  reader = new PostgresTelemetryReader(pool);

  const writer = new PostgresTelemetryWriter(pool);

  await writer.spans([
    span({}),
    span({
      spanId: "00f067aa0ba902b7",
      parentSpanId: "b7ad6b7169203331",
      name: "pienance.servePie",
      kind: 0,
      durationUs: 5_000,
      httpRoute: null,
      httpStatus: null,
    }),
    span({ traceId: failedTrace, durationUs: 1_200_000, httpStatus: 500 }),
    span({
      traceId: failedTrace,
      spanId: "00f067aa0ba902b8",
      parentSpanId: "b7ad6b7169203331",
      name: "pienance.weighBite",
      kind: 0,
      statusCode: 2,
      statusMessage: "Bake a pie first",
      httpRoute: null,
      httpStatus: null,
    }),
  ]);

  const { events, vitals } = beaconRows(
    {
      sessionId: "4f9c1f0e-5d5a-4c1e-9a77-0d1c2b3a4f5e",
      anonymousId: "0b8e2a6c-1f3d-4e5a-8b7c-9d0e1f2a3b4c",
      items: [
        {
          type: "event",
          id: "a3c1e5f7-2b4d-4f6a-8c0e-1d3f5a7b9c2e",
          name: "$pageview",
          at: now.getTime(),
          path: "/",
          properties: {},
        },
        {
          type: "event",
          id: "a3c1e5f7-2b4d-4f6a-8c0e-1d3f5a7b9c2f",
          name: "$click",
          at: now.getTime(),
          path: "/",
          properties: { target: "weigh" },
        },
        { type: "vital", id: "v1", name: "LCP", value: 1_000, rating: "good", at: 0, path: "/" },
        { type: "vital", id: "v2", name: "LCP", value: 5_000, rating: "poor", at: 0, path: "/" },
      ],
    },
    { at: now, userId: null, deployment: null, device: "desktop", country: null },
  );

  await writer.events([
    ...events,
    productEventRow(
      { name: "bite.weighed", properties: { verdict: "fits" } },
      {
        id: "c9d2e4f6-1a3b-4c5d-8e7f-9a0b1c2d3e4f",
        at: now,
        userId: "ada",
        traceId: okTrace,
        deployment: null,
      },
    ),
  ]);
  await writer.vitals(vitals);
});

afterAll(async () => {
  await pool.end();
  await database.stop();
});

describe("PostgresTelemetryReader.overview", () => {
  it("summarises requests, routes and vitals", async () => {
    const overview = await reader.overview(hourAgo);

    expect(overview.totals).toEqual({ requests: 2, failedRequests: 1, sessions: 1, people: 2 });
    expect(overview.routes).toEqual([
      { route: "/", requests: 2, errors: 1, p50Ms: 610, p95Ms: 1_141 },
    ]);
    expect(overview.vitals).toEqual([{ name: "LCP", samples: 2, p75: 4_000, good: 1, poor: 1 }]);
  });

  it("lists events, pages and clicks", async () => {
    const overview = await reader.overview(hourAgo);

    expect(overview.events).toEqual([
      { name: "$click", source: "browser", count: 1, people: 1 },
      { name: "$pageview", source: "browser", count: 1, people: 1 },
      { name: "bite.weighed", source: "server", count: 1, people: 1 },
    ]);
    expect(overview.pages).toEqual([{ path: "/", views: 1, sessions: 1 }]);
    expect(overview.clicks).toEqual([{ target: "weigh", clicks: 1 }]);
  });

  it("shows failed requests by their root, with the error message", async () => {
    const { failures, slowest } = await reader.overview(hourAgo);

    expect(failures).toEqual([
      expect.objectContaining({
        traceId: failedTrace,
        name: "GET /",
        status: 500,
        durationMs: 1_200,
        message: "Bake a pie first",
      }),
    ]);
    expect(slowest.map((request) => request.traceId)).toEqual([failedTrace, okTrace]);
  });

  it("only counts what happened since the given time", async () => {
    const overview = await reader.overview(new Date(now.getTime() + 60_000));

    expect(overview.totals).toEqual({ requests: 0, failedRequests: 0, sessions: 0, people: 0 });
    expect(overview.routes).toEqual([]);
  });
});

describe("PostgresTelemetryReader.trace", () => {
  it("returns a trace's spans, root first", async () => {
    const spans = await reader.trace(okTrace);

    expect(spans.map((each) => [each.name, each.parentSpanId, each.durationMs])).toEqual([
      ["GET /", null, 20],
      ["pienance.servePie", "b7ad6b7169203331", 5],
    ]);
  });

  it("returns nothing for unknown or malformed ids", async () => {
    expect(await reader.trace("f".repeat(32))).toEqual([]);
    expect(await reader.trace("'; DROP TABLE telemetry.spans; --")).toEqual([]);
  });
});
