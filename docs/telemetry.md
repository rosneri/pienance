# Telemetry blueprint

How pienance captures traces, performance, web vitals, product analytics and clickstream with
OpenTelemetry, stores everything in the Postgres it already has, and runs on serverless functions
with no collector, daemon or sidecar.

Status: **proposal**. Nothing here is implemented yet; the [rollout](#8-rollout) lists the order.

## 1. Requirements

| Signal                  | Captured as                                                    | Source                     |
| ----------------------- | -------------------------------------------------------------- | -------------------------- |
| APM / traces            | OTel spans (Next.js, fetch, Prisma, use cases)                 | server, `instrumentation`  |
| Server metrics (RED)    | Derived from spans in SQL (rate, errors, duration percentiles) | rollup job                 |
| Web vitals              | LCP, INP, CLS, FCP, TTFB samples                               | browser, `web-vitals`      |
| Product analytics       | Named domain events (`pie.baked`, `bite.weighed`…)             | server actions             |
| Clickstream / user flow | `$pageview`, `$click`, `$leave` with session and route         | browser, batched beacons   |

Constraints: one deployable (the Next.js app), Postgres as the only store, works on Vercel and AWS
Lambda, every format stays OTel/OTLP-shaped so leaving Postgres is a config change, not a rewrite.

## 2. Architectural evaluation

### 2.1 Options

**A. Direct-to-Postgres, in-process (recommended).** The OTel JS SDK runs inside each function. A
custom `SpanExporter` writes batches straight to Postgres. The browser sends batched beacons to a
first-party route handler that inserts them. Rollups, partitions and retention run from a Vercel
Cron (or EventBridge) request — a scheduled HTTP call, not a daemon.

**B. Self-hosted observability platform.** Ship OTLP to a platform and let it store and display.

| Platform                    | Storage it needs                                     | Long-running services             | Postgres-only? | Notes                                                                                      |
| --------------------------- | ---------------------------------------------------- | --------------------------------- | -------------- | ------------------------------------------------------------------------------------------ |
| **Direct-to-Postgres (A)**  | the app's Postgres                                   | none                              | yes            | You build the read side (SQL, or Grafana/Metabase on the tables).                          |
| Uptrace                     | ClickHouse (spans, logs, metrics) + Postgres (meta)  | Uptrace server, ClickHouse        | no             | Excellent OTel-native UI; ClickHouse is the real store.                                    |
| Highlight.io                | ClickHouse, Postgres, Redis, Kafka, object storage   | backend, workers, frontend, Kafka | no             | Session replay + errors + traces. Now part of LaunchDarkly; self-host is a hobby compose.  |
| SigNoz / ClickStack (HyperDX) | ClickHouse                                         | collector, query service          | no             | Strong APM; same ClickHouse dependency.                                                    |
| PostHog (self-host)         | ClickHouse, Postgres, Redis, Kafka                   | many                              | no             | Best product analytics; self-host is "hobby" only, no APM.                                 |
| Umami                       | Postgres                                             | Umami server                      | yes            | Pageviews and custom events only; no traces, no vitals detail.                             |
| Jaeger / Tempo              | Cassandra, Elasticsearch, Badger / object storage    | collector, query                  | no             | Traces only.                                                                               |

Every full-featured platform needs ClickHouse (or similar) **and** a long-running process, which
breaks both the single-database and the no-daemon constraints. Umami fits the constraints but only
covers a fifth of the scope.

### 2.2 Decision

Option A. It meets every constraint, adds one package and three routes, and keeps the exit open:

- Spans are produced by the standard OTel SDK; swapping `PostgresSpanExporter` for
  `OTLPTraceExporter` sends them to Uptrace, SigNoz, Honeycomb, Grafana Cloud… unchanged.
- Browser events use an OTLP-like JSON shape (`resource`, `attributes`, nanosecond timestamps), so
  a later move to a collector is a mapping, not a redesign.
- Columns mirror OTel semantic conventions (`http.route`, `http.response.status_code`,
  `service.name`), so SQL and dashboards port across.

When to revisit: sustained ingestion above ~50 M rows/day, or when ad-hoc analytics over months of
raw data becomes the main use. Then keep the SDK, swap the exporter, and point it at ClickHouse.

### 2.3 Serverless constraints and how A handles them

| Constraint                                       | Consequence                                     | Answer                                                                                                                                             |
| ------------------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instance freezes after the response              | `BatchSpanProcessor` timers never fire          | Flush when the local root span ends, inside `waitUntil` (Vercel) / before the handler returns (Lambda). `@vercel/otel` already does the former. |
| Many concurrent instances, each with a pool      | `max_connections` exhausted                     | Server-side pooler + tiny per-instance pool (§3).                                                                                                  |
| Cold starts                                      | SDK init adds latency                           | Only `@opentelemetry/api` + `sdk-trace-base` + the exporter; no `sdk-node` auto-instrumentation bundle.                                            |
| No background threads                            | No metrics `PeriodicExportingMetricReader`      | Derive server metrics from spans in SQL; no OTel metrics SDK on the server.                                                                        |
| Edge runtime has no TCP                          | `pg` cannot run there                           | Telemetry writes only in the Node.js runtime (Next 16 `proxy.ts` and route handlers default to Node).                                              |
| Billed duration                                  | Flushing extends each invocation                | One multi-row `INSERT` per flush (~2–10 ms on a warm pooled connection); sampling caps volume.                                                     |

## 3. Connection pooling

Telemetry multiplies writes, so pooling is the main risk.

1. **Pooler in front of Postgres, transaction mode.** Prisma Postgres' pooled URL, Neon/Supabase
   (Supavisor) poolers, RDS Proxy, or PgBouncer. Many function instances share a few real
   backends. Transaction mode forbids session state: no named prepared statements (node-postgres
   uses unnamed ones unless `name` is set — keep it that way), no `SET` outside a transaction (use
   `SET LOCAL`), no `LISTEN`, no session advisory locks.
2. **A separate, tiny telemetry pool per instance.** `max: 1`, `idleTimeoutMillis: 5_000`,
   `connectionTimeoutMillis: 2_000`. It never competes with the app's Prisma pool for slots; a
   slow telemetry write can only delay telemetry.
3. **Release idle clients before suspension.** On Vercel Fluid compute, register the pool with
   `attachDatabasePool(pool)` from `@vercel/functions`, which closes idle clients before the
   instance is frozen so backends are not leaked. Fluid also lets concurrent requests on one
   instance share that one connection.
4. **One round trip per flush.** Insert whole batches with `unnest` over typed arrays: one
   statement shape (plan-cache friendly), one round trip, independent of batch size.
5. **A dedicated role with guard rails.** `telemetry_writer` may only `INSERT` into `telemetry.*`;
   `ALTER ROLE telemetry_writer SET statement_timeout = '2s'` (role defaults survive transaction
   pooling). A failed write is dropped and counted, never retried in a loop, never surfaced to the
   user.
6. **Never trace the exporter.** Wrap writes in `context.with(suppressTracing(context.active()))`
   so `pg`/Prisma instrumentation does not create spans about saving spans.

Connection string: `TELEMETRY_DATABASE_URL` (pooled), falling back to the app's pooled URL. The
writer pool is created lazily on first flush, so builds need no database.

## 4. Database schema

All telemetry lives in its own Postgres schema, `telemetry`, so it never appears in Prisma's model
of `public` and can be dropped or moved wholesale.

Design choices:

- **Native range partitioning by day** on the time column. Retention is `DROP TABLE` of old
  partitions (instant, no vacuum debt). No `pg_partman`/TimescaleDB required, since managed hosts
  such as Prisma Postgres do not offer them; a plpgsql function maintains partitions instead.
- **Server time is the partition key.** Browser clocks are wrong; `time` is when the server
  received an event, `client_time` keeps what the browser said.
- **Hot attributes promoted to columns** (`http_route`, `http_status`, `user_id`…); the long tail
  stays in `jsonb`. No GIN on `jsonb` by default (write amplification); add `jsonb_path_ops`
  partial indexes only for attributes you actually filter on.
- **BRIN** on time (tiny, ideal for append-only), a few targeted B-trees, primary keys that make
  retries idempotent (`ON CONFLICT DO NOTHING`).
- **`lz4`** compression for `jsonb` (Postgres 14+), `fillfactor = 100` for insert-only tables.
- **Ids as `bytea`** (16-byte trace, 8-byte span): half the size of hex text.
- **No money.** Telemetry never stores amounts, incomes or exact proportions; only verdicts,
  slice names and rough sizes (`"about a quarter"`). Pienance is a finance app.

### 4.1 Migration SQL

Shipped as a Prisma migration (`packages/db/prisma/migrations/<timestamp>_telemetry/migration.sql`),
so `prisma migrate deploy`, the Vercel build and the PGlite test databases all apply it with no
extra tooling. Prisma only diffs the `public` schema, so the `telemetry` tables never show up as
drift. (If a future Prisma version does, list them under `tables.external` in `prisma.config.ts`.)

```sql
CREATE SCHEMA IF NOT EXISTS telemetry;

-- ── Spans (APM) ────────────────────────────────────────────────────────────
CREATE TABLE telemetry.spans (
  start_time      timestamptz NOT NULL,
  trace_id        bytea       NOT NULL,           -- 16 bytes
  span_id         bytea       NOT NULL,           -- 8 bytes
  parent_span_id  bytea,
  name            text        NOT NULL,
  kind            smallint    NOT NULL,           -- OTel SpanKind: 0 internal … 4 consumer
  duration_us     bigint      NOT NULL,
  status_code     smallint    NOT NULL DEFAULT 0, -- 0 unset, 1 ok, 2 error
  status_message  text,
  service         text        NOT NULL,           -- resource service.name
  deployment      text,                           -- VERCEL_DEPLOYMENT_ID or git sha
  http_route      text,                           -- http.route
  http_method     text,
  http_status     smallint,                       -- http.response.status_code
  user_id         text,                           -- enduser.id (pienance ownerId)
  attributes      jsonb       NOT NULL DEFAULT '{}',
  events          jsonb,                          -- span events incl. exceptions
  links           jsonb,
  PRIMARY KEY (trace_id, span_id, start_time)
) PARTITION BY RANGE (start_time);

CREATE INDEX spans_time_brin  ON telemetry.spans USING brin (start_time);
CREATE INDEX spans_route_time ON telemetry.spans (http_route, start_time) WHERE kind = 1;  -- server
CREATE INDEX spans_errors     ON telemetry.spans (start_time) WHERE status_code = 2;
CREATE INDEX spans_user_time  ON telemetry.spans (user_id, start_time) WHERE user_id IS NOT NULL;

-- ── Web vitals ─────────────────────────────────────────────────────────────
CREATE TABLE telemetry.web_vitals (
  time             timestamptz      NOT NULL DEFAULT now(),
  client_time      timestamptz,
  id               text             NOT NULL,     -- web-vitals metric id, unique per page load
  name             text             NOT NULL CHECK (name IN ('LCP', 'INP', 'CLS', 'FCP', 'TTFB')),
  value            double precision NOT NULL,     -- ms, CLS unitless
  rating           text CHECK (rating IN ('good', 'needs-improvement', 'poor')),
  navigation_type  text,
  route            text             NOT NULL,     -- route pattern, e.g. /sign-in
  session_id       uuid             NOT NULL,
  user_id          text,
  deployment       text,
  device           text,                          -- mobile | tablet | desktop
  country          text,                          -- from x-vercel-ip-country / CloudFront header
  attribution      jsonb            NOT NULL DEFAULT '{}',  -- LCP element, INP target…
  PRIMARY KEY (id, time)
) PARTITION BY RANGE (time);

CREATE INDEX web_vitals_time_brin  ON telemetry.web_vitals USING brin (time);
CREATE INDEX web_vitals_route_name ON telemetry.web_vitals (route, name, time);

-- ── Events: product analytics + clickstream ────────────────────────────────
CREATE TABLE telemetry.events (
  time          timestamptz NOT NULL DEFAULT now(),
  client_time   timestamptz,
  id            uuid        NOT NULL,          -- generated by the sender: retries are idempotent
  name          text        NOT NULL,          -- '$pageview', '$click', 'bite.weighed', …
  source        text        NOT NULL CHECK (source IN ('browser', 'server')),
  session_id    uuid,
  anonymous_id  uuid,                          -- first-party cookie, before sign-in
  user_id       text,                          -- set by the server, never trusted from the client
  route         text,
  path          text,
  referrer      text,
  trace_id      bytea,                         -- joins server events to their trace
  deployment    text,
  device        text,
  country       text,
  properties    jsonb       NOT NULL DEFAULT '{}',
  PRIMARY KEY (id, time)
) PARTITION BY RANGE (time);

CREATE INDEX events_time_brin    ON telemetry.events USING brin (time);
CREATE INDEX events_name_time    ON telemetry.events (name, time);
CREATE INDEX events_session_time ON telemetry.events (session_id, time);
CREATE INDEX events_user_time    ON telemetry.events (user_id, time) WHERE user_id IS NOT NULL;

-- Compression and fill for insert-only tables (inherited by new partitions).
ALTER TABLE telemetry.spans      ALTER COLUMN attributes  SET COMPRESSION lz4;
ALTER TABLE telemetry.web_vitals ALTER COLUMN attribution SET COMPRESSION lz4;
ALTER TABLE telemetry.events     ALTER COLUMN properties  SET COMPRESSION lz4;

-- ── Rollups (cheap dashboards, kept for months) ────────────────────────────
CREATE TABLE telemetry.route_rollups (
  bucket    timestamptz      NOT NULL,         -- 5-minute bucket
  service   text             NOT NULL,
  route     text             NOT NULL,
  requests  integer          NOT NULL,
  errors    integer          NOT NULL,         -- status_code = 2 or http_status >= 500
  p50_ms    double precision NOT NULL,
  p95_ms    double precision NOT NULL,
  p99_ms    double precision NOT NULL,
  PRIMARY KEY (bucket, service, route)
);

CREATE TABLE telemetry.vital_rollups (
  day      date             NOT NULL,
  route    text             NOT NULL,
  name     text             NOT NULL,
  device   text             NOT NULL,
  samples  integer          NOT NULL,
  p75      double precision NOT NULL,          -- Core Web Vitals are judged at p75
  good     integer          NOT NULL,
  poor     integer          NOT NULL,
  PRIMARY KEY (day, route, name, device)
);

-- ── Partition upkeep: create ahead, drop behind ────────────────────────────
CREATE OR REPLACE FUNCTION telemetry.maintain_partitions(days_ahead int DEFAULT 3, keep_days int DEFAULT 14)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  parent text;
  day    date;
  child  record;
BEGIN
  FOREACH parent IN ARRAY ARRAY['spans', 'web_vitals', 'events'] LOOP
    FOR day IN SELECT generate_series(current_date - 1, current_date + days_ahead, interval '1 day')::date LOOP
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS telemetry.%I PARTITION OF telemetry.%I
           FOR VALUES FROM (%L) TO (%L) WITH (fillfactor = 100)',
        parent || '_' || to_char(day, 'YYYYMMDD'), parent, day, day + 1);
    END LOOP;

    FOR child IN
      SELECT c.relname FROM pg_inherits i
      JOIN pg_class c ON c.oid = i.inhrelid
      JOIN pg_class p ON p.oid = i.inhparent
      JOIN pg_namespace n ON n.oid = p.relnamespace
      WHERE n.nspname = 'telemetry' AND p.relname = parent
        AND c.relname ~ '_\d{8}$'
        AND to_date(right(c.relname, 8), 'YYYYMMDD') < current_date - keep_days
    LOOP
      EXECUTE format('DROP TABLE telemetry.%I', child.relname);
    END LOOP;
  END LOOP;
END $$;

SELECT telemetry.maintain_partitions();

-- ── Least privilege ────────────────────────────────────────────────────────
-- Run once per environment by an admin (roles are cluster-wide, so not in the migration):
--   CREATE ROLE telemetry_writer LOGIN PASSWORD '…';
--   ALTER ROLE telemetry_writer SET statement_timeout = '2s';
--   GRANT USAGE ON SCHEMA telemetry TO telemetry_writer;
--   GRANT INSERT ON ALL TABLES IN SCHEMA telemetry TO telemetry_writer;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA telemetry GRANT INSERT ON TABLES TO telemetry_writer;
```

No `DEFAULT` partition: rows outside the created range fail their batch, which the writer counts.
A default partition would silently swallow them and then block creating the matching partition.
Running maintenance hourly with `days_ahead = 3` leaves three days of slack.

### 4.2 Batch insert (one statement per flush)

```sql
INSERT INTO telemetry.spans (start_time, trace_id, span_id, parent_span_id, name, kind, duration_us,
  status_code, status_message, service, deployment, http_route, http_method, http_status, user_id,
  attributes, events, links)
SELECT * FROM unnest(
  $1::timestamptz[], $2::bytea[], $3::bytea[], $4::bytea[], $5::text[], $6::smallint[], $7::bigint[],
  $8::smallint[], $9::text[], $10::text[], $11::text[], $12::text[], $13::text[], $14::smallint[],
  $15::text[], $16::jsonb[], $17::jsonb[], $18::jsonb[])
ON CONFLICT DO NOTHING;
```

Same shape for `web_vitals` and `events`. Batches are capped at 500 rows to bound statement size.

### 4.3 Rollup and query examples

```sql
-- Hourly job: roll up the last two complete hours of server spans (idempotent upsert).
INSERT INTO telemetry.route_rollups
SELECT date_bin('5 minutes', start_time, 'epoch') AS bucket, service, http_route,
       count(*), count(*) FILTER (WHERE status_code = 2 OR http_status >= 500),
       percentile_cont(0.50) WITHIN GROUP (ORDER BY duration_us) / 1000,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_us) / 1000,
       percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_us) / 1000
FROM telemetry.spans
WHERE kind = 1 AND http_route IS NOT NULL
  AND start_time >= date_trunc('hour', now()) - interval '2 hours'
  AND start_time <  date_trunc('hour', now())
GROUP BY 1, 2, 3
ON CONFLICT (bucket, service, route) DO UPDATE SET
  requests = excluded.requests, errors = excluded.errors,
  p50_ms = excluded.p50_ms, p95_ms = excluded.p95_ms, p99_ms = excluded.p99_ms;

-- One trace, as a tree.
SELECT encode(span_id, 'hex') AS span, encode(parent_span_id, 'hex') AS parent, name,
       duration_us / 1000.0 AS ms, status_code
FROM telemetry.spans WHERE trace_id = decode($1, 'hex') ORDER BY start_time;

-- Funnel: of the sessions that weighed a bite this week, how many took one?
SELECT count(DISTINCT session_id) FILTER (WHERE name = 'bite.weighed') AS weighed,
       count(DISTINCT session_id) FILTER (WHERE name = 'bite.taken')   AS taken
FROM telemetry.events WHERE time >= now() - interval '7 days';
```

Reading: Grafana (Postgres data source; its Traces panel renders rows with `traceID`, `spanID`,
`parentSpanID`, `serviceName`, `startTime`, `duration` columns) or Metabase, pointed at a read-only
role. Both are optional and outside the deployment.

## 5. Implementation strategy

### 5.1 Where code lives

Telemetry is infrastructure, not business: `@pienance/core` stays untouched and unaware of it.

```
packages/telemetry            @pienance/telemetry   (new; layer: library)
  src/contract/               portable: event names, payload types, validate(), no DOM/Node
    events.ts                 ProductEvent union ('pie.baked' | 'bite.weighed' | …) + properties
    beacon.ts                 Beacon payload type + parseBeacon(json): Outcome-like result
  src/browser/                DOM only
    beacon-queue.ts           batching queue (size/time/visibility flush, sendBeacon fallback)
    clickstream.ts            $pageview / $click / $leave capture
  src/server/                 Node only
    postgres-writer.ts        TelemetryWriter port + PostgresTelemetryWriter (unnest inserts)
    in-memory-writer.ts       for tests
    postgres-span-exporter.ts OTel SpanExporter → writer.spans()
    tail-sampler.ts           SpanProcessor: keep errors, slow and a ratio of the rest
    register.ts               registerTelemetry({ service, writer, sampleRatio })
    traced.ts                 traced(useCases, tracer): wraps each use case in a span
    track.ts                  server-side product events
  package.json exports: "./contract", "./browser", "./server"

apps/web/src
  instrumentation.ts          register(): Node runtime → registerTelemetry(...); onRequestError
  instrumentation-client.ts   startBrowserTelemetry({ endpoint: "/api/telemetry" })
  components/web-vitals.tsx   useReportWebVitals → queue
  app/api/telemetry/route.ts  POST: validate, enrich, insert; 204
  app/api/telemetry/maintain/route.ts  GET (cron): partitions + rollups
  pienance.ts                 composition root: telemetryWriter(), traced(wire(...))
```

moon: `packages/telemetry/moon.yml` with `layer: library`, tags `server`, `tested`; oxlint
`no-restricted-imports` so `contract/` imports nothing platform-specific (same rule as core) and
`browser/` never imports `server/`. Add it to `transpilePackages` in `next.config.ts`.

Dependencies (exact versions pinned at implementation time): `@opentelemetry/api`,
`@opentelemetry/sdk-trace-base`, `@opentelemetry/core`, `@opentelemetry/resources`,
`@opentelemetry/semantic-conventions`, `@vercel/otel` (flush-on-`waitUntil`; works off Vercel
too), `@prisma/instrumentation` (query spans), `pg`, `web-vitals` (via `next/web-vitals`).

### 5.2 Server: `instrumentation.ts`

```ts
// apps/web/src/instrumentation.ts
import type { Instrumentation } from "next";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startServerTelemetry } = await import("./telemetry.server");
  startServerTelemetry();
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { recordRequestError } = await import("./telemetry.server");
  recordRequestError(error, request, context); // span event + status error on the active span
};
```

```ts
// apps/web/src/telemetry.server.ts — composition root for server telemetry
import { registerOTel } from "@vercel/otel";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import {
  PostgresSpanExporter,
  TailSampler,
  telemetryWriter,
} from "@pienance/telemetry/server";

export function startServerTelemetry(): void {
  const writer = telemetryWriter(process.env); // lazy pool; in-memory/no-op without a URL

  registerOTel({
    serviceName: "pienance-web",
    attributes: { "deployment.id": process.env.VERCEL_DEPLOYMENT_ID ?? "local" },
    instrumentations: ["fetch", new PrismaInstrumentation()],
    spanProcessors: [
      new TailSampler({
        exporter: new PostgresSpanExporter(writer),
        keepRatio: Number(process.env.TELEMETRY_SAMPLE_RATIO ?? "1"),
        slowMs: 1_000,
      }),
    ],
  });
}
```

Key pieces:

- **`PostgresSpanExporter.export(spans, done)`** maps `ReadableSpan` → rows (promoting
  `http.route`, `http.request.method`, `http.response.status_code`, `enduser.id`), calls
  `writer.spans(rows)` under `suppressTracing`, and reports `ExportResultCode.FAILED` on error
  without throwing. `forceFlush()` awaits in-flight writes.
- **`TailSampler`** (a `SpanProcessor`): buffers ended spans per trace id and decides when the
  local root ends. A serverless request is one process, so the whole server trace is local and
  tail sampling is exact: keep every error, every trace slower than `slowMs`, and `keepRatio` of
  the rest. Then hands the kept spans to the exporter and flushes. `@vercel/otel` wraps the
  processor so the flush runs in `waitUntil`, after the response is sent.
- **Lambda / other hosts**: same code; without Vercel's request context, call
  `await provider.forceFlush()` at the end of the handler, or rely on `after()` from
  `next/server`, which awaits work before the instance is frozen on hosts that support it.

### 5.3 Use cases and product events (server)

Use cases get spans without core knowing: wrap them where they are wired.

```ts
// apps/web/src/pienance.ts
export const pienance = traced(wire({ pies, newId, now: clock }), trace.getTracer("pienance"));
// Each call becomes a span "pienance.weighBite" with the outcome's safe attributes.
```

Product events are emitted by server actions, where the outcome and the owner are known. Being
server-side, they are authoritative and immune to ad blockers.

```ts
// apps/web/src/server/pie-actions.ts (sketch)
const weighing = await deps.app.weighBite({ ownerId, ...input });
deps.track({ name: "bite.weighed", userId: ownerId, properties: { verdict: weighing.verdict } });
```

`track` is a dependency of the actions (tests pass a plain function); the real one is
`(event) => after(() => writer.events([toRow(event, trace.getActiveSpan())]))`, attaching the
current `trace_id` so an event joins its trace.

Event vocabulary (in `contract/events.ts`, using the ubiquitous language):

| Event          | Properties                                 |
| -------------- | ------------------------------------------ |
| `pie.baked`    | `currency`                                 |
| `pie.served`   | `bites` (count), `leftover` (rough size)   |
| `bite.weighed` | `slice`, `verdict`, `size` (rough size)    |
| `bite.taken`   | `slice`, `verdict`                         |
| `agent.tool`   | `tool` (WebMCP tool name), `ok`            |

### 5.4 Browser: batching, clickstream, web vitals

`instrumentation-client.ts` (Next ≥ 15.3) runs once before hydration:

```ts
// apps/web/src/instrumentation-client.ts
import { startBrowserTelemetry } from "@pienance/telemetry/browser";

startBrowserTelemetry({ endpoint: "/api/telemetry" });
```

`BeaconQueue` rules:

- Buffer in memory; flush at **20 items** or **5 s**, whichever first.
- Flush on `visibilitychange → hidden` and `pagehide` with `navigator.sendBeacon` (survives
  unload; JSON `Blob`, ≤ 60 KB per beacon, split if larger); otherwise `fetch(…, { keepalive: true })`.
- Each item gets a `crypto.randomUUID()` id at creation, so a retried batch is deduplicated by
  the primary key.
- On failure keep at most 200 items and retry on the next flush; never block the UI.
- `session_id` in `sessionStorage` (new after 30 min idle); `anonymous_id` in a first-party
  cookie; both wrapped in `try/catch` (private mode). Respect `navigator.globalPrivacyControl`
  and a consent flag before sending clickstream.

Clickstream capture: `$pageview` on load and on App Router navigations (`usePathname` change in a
small client component), `$click` via one delegated `click` listener recording only elements with
a `data-track` attribute (`data-track="weigh"`), never text content or input values, and `$leave`
with time on page.

Web vitals: `useReportWebVitals` from `next/web-vitals` in `components/web-vitals.tsx`, pushing
`{ id, name, value, rating, navigationType, attribution }` onto the same queue.

Browser traces (optional, later): the OTel web SDK is ~60 KB+; skip it initially. Link client
and server instead by rendering the server trace id into a `<meta name="traceparent">` and
attaching it to `$pageview`.

### 5.5 Ingestion route

```ts
// apps/web/src/app/api/telemetry/route.ts
import { parseBeacon } from "@pienance/telemetry/contract";
import { headers } from "next/headers";
import { after } from "next/server";
import { ownerOf } from "@pienance/auth";
import { auth, telemetry } from "@/pienance";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (Number(request.headers.get("content-length") ?? 0) > 64_000) {
    return new Response(null, { status: 413 });
  }

  const beacon = parseBeacon(await request.text()); // validates, caps items, strips unknown keys
  if (!beacon.ok) return new Response(null, { status: 400 });

  const userId = await ownerOf(auth(), await headers()); // never trust a client-sent user id
  const context = telemetry.requestContext(request);     // device, country, deployment

  after(() => telemetry.ingest(beacon.value, { userId, ...context }));

  return new Response(null, { status: 204 });
}
```

Hardening: same-origin check (`Origin`/`Sec-Fetch-Site`), 64 KB body limit, at most 100 items per
beacon, an allow-list of event names and property keys from `contract/`, route patterns instead
of raw URLs (strip query strings), and an optional per-IP rate limit through Vercel Firewall. The
route responds before writing (`after`), so the browser never waits on Postgres.

### 5.6 Maintenance (cron, not daemon)

```json
// vercel.json
{ "crons": [{ "path": "/api/telemetry/maintain", "schedule": "7 * * * *" }] }
```

`GET /api/telemetry/maintain` checks `Authorization: Bearer ${CRON_SECRET}`, then runs
`SELECT telemetry.maintain_partitions(3, 14)`, the route rollup (§4.3) and the daily vitals rollup.
Each step is idempotent, so a missed or doubled run is harmless. On AWS, an EventBridge schedule
calls the same URL.

Account deletion also deletes the user's telemetry rows
(`DELETE FROM telemetry.events WHERE user_id = $1`, same for spans and vitals); retention ages out
the rest.

## 6. Testing

Following the repo's rules (Vitest, no `vi.mock`, dependencies passed in):

| Unit                                                                      | Integration (PGlite via `@pienance/db/testing`)                                    |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `parseBeacon` accepts/rejects payloads; caps; strips unknown properties   | migration applies; `maintain_partitions` creates and drops partitions              |
| `BeaconQueue` flush on size, time, hidden (fake `send`, fake timers)      | `PostgresTelemetryWriter` round-trips spans, vitals, events; retry is idempotent   |
| `TailSampler` keeps errors and slow traces, ratio for the rest            | exporter → writer → rows with promoted columns                                     |
| span → row mapping (ids, durations, promoted attributes)                  | rollup SQL produces expected percentiles                                           |
| `traced()` names spans and records errors (in-memory span exporter)       | ingestion route handler with in-memory writer and a test owner                     |
| actions call `track` with the right event (plain function)                | —                                                                                  |

## 7. Capacity and cost

Rough sizing, per row including indexes: span ~0.5 KB, event ~0.4 KB, vital ~0.3 KB.

| Traffic                     | Spans/day (8/request) | Raw size/day | 14-day footprint |
| --------------------------- | --------------------- | ------------ | ---------------- |
| 10 k requests/day           | 80 k                  | ~40 MB       | ~0.6 GB          |
| 1 M requests/day            | 8 M                   | ~4 GB        | ~56 GB           |
| 1 M requests/day, 10 % kept | 0.8 M (+ all errors)  | ~0.4 GB      | ~6 GB            |

Rollups are tiny and can be kept for a year. Lower `keep_days` or `TELEMETRY_SAMPLE_RATIO` before
reaching for another store.

## 8. Rollout

1. `packages/telemetry` skeleton: contract, writer port, in-memory writer, tests.
2. Telemetry migration + `PostgresTelemetryWriter` + integration tests on PGlite.
3. Server traces: exporter, tail sampler, `instrumentation.ts`, `traced()` use cases.
4. Ingestion route, `BeaconQueue`, web vitals, `$pageview`.
5. Product events from server actions and WebMCP tools; `$click` with `data-track`.
6. Maintenance cron, rollups, read-only role, a Grafana or Metabase dashboard.

Environment: `TELEMETRY_DATABASE_URL` (pooled, `telemetry_writer`), `TELEMETRY_SAMPLE_RATIO`
(default `1`), `CRON_SECRET`. Without a database URL, telemetry writes to the in-memory writer,
like the rest of the app.
