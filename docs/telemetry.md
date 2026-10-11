# Telemetry

How pienance captures traces, performance, web vitals, product analytics and clickstream with
OpenTelemetry, stores everything in the Postgres it already has, and runs on serverless functions
with no collector, daemon or sidecar.

Code: `packages/telemetry` (`@pienance/telemetry`), the `telemetry` migration in `packages/db`, and
the wiring in `apps/web` (§5).

## 1. Requirements

| Signal                  | Captured as                                                     | Source                     |
| ----------------------- | --------------------------------------------------------------- | -------------------------- |
| APM / traces            | OTel spans (Next.js, fetch, Prisma, use cases)                  | server, `instrumentation`  |
| Server metrics (RED)    | Derived from spans in SQL (rate, errors, duration percentiles)  | rollup job                 |
| Web vitals              | LCP, INP, CLS, FCP, TTFB samples                                | browser, `next/web-vitals` |
| Product analytics       | Named domain events (`pie.baked`, `bite.weighed`, `bite.taken`) | server actions             |
| Clickstream / user flow | `$pageview`, `$click`, `$leave` with session and route          | browser, batched beacons   |

Constraints: one deployable (the Next.js app), Postgres as the only store, works on Vercel and AWS
Lambda, every format stays OTel/OTLP-shaped so leaving Postgres is a config change, not a rewrite.

## 2. Architectural evaluation

### 2.1 Options

**A. Direct-to-Postgres, in-process (recommended).** The OTel JS SDK runs inside each function. A
custom `SpanExporter` writes batches straight to Postgres. The browser sends batched beacons to a
first-party route handler that inserts them. Rollups, partitions and retention run from a Vercel
Cron (or EventBridge) request — a scheduled HTTP call, not a daemon.

**B. Self-hosted observability platform.** Ship OTLP to a platform and let it store and display.

| Platform                      | Storage it needs                                    | Long-running services             | Postgres-only? | Notes                                                                                     |
| ----------------------------- | --------------------------------------------------- | --------------------------------- | -------------- | ----------------------------------------------------------------------------------------- |
| **Direct-to-Postgres (A)**    | the app's Postgres                                  | none                              | yes            | You build the read side (SQL, or Grafana/Metabase on the tables).                         |
| Uptrace                       | ClickHouse (spans, logs, metrics) + Postgres (meta) | Uptrace server, ClickHouse        | no             | Excellent OTel-native UI; ClickHouse is the real store.                                   |
| Highlight.io                  | ClickHouse, Postgres, Redis, Kafka, object storage  | backend, workers, frontend, Kafka | no             | Session replay + errors + traces. Now part of LaunchDarkly; self-host is a hobby compose. |
| SigNoz / ClickStack (HyperDX) | ClickHouse                                          | collector, query service          | no             | Strong APM; same ClickHouse dependency.                                                   |
| PostHog (self-host)           | ClickHouse, Postgres, Redis, Kafka                  | many                              | no             | Best product analytics; self-host is "hobby" only, no APM.                                |
| Umami                         | Postgres                                            | Umami server                      | yes            | Pageviews and custom events only; no traces, no vitals detail.                            |
| Jaeger / Tempo                | Cassandra, Elasticsearch, Badger / object storage   | collector, query                  | no             | Traces only.                                                                              |

Every full-featured platform needs ClickHouse (or similar) **and** a long-running process, which
breaks both the single-database and the no-daemon constraints. Umami fits the constraints but only
covers a fifth of the scope.

### 2.2 Decision

Option A. It meets every constraint, adds one package and two routes, and keeps the exit open:

- Spans are produced by the standard OTel SDK; swapping `PostgresSpanExporter` for
  `OTLPTraceExporter` sends them to Uptrace, SigNoz, Honeycomb, Grafana Cloud… unchanged.
- Browser events use an OTLP-like JSON shape (`resource`, `attributes`, nanosecond timestamps), so
  a later move to a collector is a mapping, not a redesign.
- Columns mirror OTel semantic conventions (`http.route`, `http.response.status_code`,
  `service.name`), so SQL and dashboards port across.

When to revisit: sustained ingestion above ~50 M rows/day, or when ad-hoc analytics over months of
raw data becomes the main use. Then keep the SDK, swap the exporter, and point it at ClickHouse.

### 2.3 Serverless constraints and how A handles them

| Constraint                                  | Consequence                                | Answer                                                                                                                                                       |
| ------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Instance freezes after the response         | `BatchSpanProcessor` timers never fire     | The tail sampler exports when the local root span ends and hands the write to `waitUntil` (Vercel); elsewhere call `provider.forceFlush()` before returning. |
| Many concurrent instances, each with a pool | `max_connections` exhausted                | Server-side pooler + tiny per-instance pool (§3).                                                                                                            |
| Cold starts                                 | SDK init adds latency                      | Only `sdk-trace-node`, Prisma's instrumentation and the exporter; no `sdk-node` auto-instrumentation bundle.                                                 |
| No background threads                       | No metrics `PeriodicExportingMetricReader` | Derive server metrics from spans in SQL; no OTel metrics SDK on the server.                                                                                  |
| Edge runtime has no TCP                     | `pg` cannot run there                      | Tracing registers only in the Node.js runtime (`NEXT_RUNTIME === "nodejs"`).                                                                                 |
| Billed duration                             | Flushing extends each invocation           | One multi-row `INSERT` per flush (~2–10 ms on a warm pooled connection); sampling caps volume.                                                               |

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

Connection string: `TELEMETRY_DATABASE_URL` (pooled), falling back to the app's database URL. The
pool is created on first use and connects lazily, so builds need no database.

## 4. Database schema

Migration: [`packages/db/prisma/migrations/20261010120000_telemetry/migration.sql`](../packages/db/prisma/migrations/20261010120000_telemetry/migration.sql).
`prisma migrate deploy` applies it like any other migration (on Vercel builds and in PGlite test
databases). Everything lives in its own Postgres schema, `telemetry`. Prisma only diffs `public`,
so `prisma migrate diff` reports no drift for these tables. Checked; if a future Prisma version
does report it, list them under `tables.external` in `prisma.config.ts`.

| Table                     | Holds                                                 | Partitioned         | Key                               |
| ------------------------- | ----------------------------------------------------- | ------------------- | --------------------------------- |
| `telemetry.spans`         | every kept span                                       | daily, `start_time` | `(trace_id, span_id, start_time)` |
| `telemetry.web_vitals`    | LCP, INP, CLS, FCP, TTFB samples                      | daily, `time`       | `(id, time)`                      |
| `telemetry.events`        | clickstream and product events                        | daily, `time`       | `(id, time)`                      |
| `telemetry.route_rollups` | requests, errors, p50/p95/p99 per route per 5 minutes | no                  | `(bucket, service, route)`        |
| `telemetry.vital_rollups` | p75, good, poor per route, vital, device per day      | no                  | `(day, route, name, device)`      |

Design choices:

- **Native range partitioning by day.** Retention is `DROP TABLE` of old partitions: instant,
  with no vacuum debt. Neither `pg_partman` nor TimescaleDB is needed (managed hosts such as
  Prisma Postgres do not offer them). `telemetry.maintain_partitions(days_ahead, keep_days)`
  creates the coming days' partitions and drops expired ones.
- **No `DEFAULT` partition.** A row outside the created range fails its batch, which the writer
  drops. A default partition would silently swallow such rows, and then block creating the
  matching partition. Daily maintenance with `days_ahead = 3` leaves two missed runs of slack.
- **Server time is the partition key** for events and vitals. Browser clocks are wrong, so
  `client_time` keeps what the browser said, and only when it is within 7 days of the server's
  time.
- **Hot attributes promoted to columns** (`http_route`, `http_method`, `http_status`, `user_id`);
  the long tail stays in `jsonb`. There is no GIN index on `jsonb` (write amplification). Add a
  `jsonb_path_ops` partial index only for an attribute you actually filter on.
- **BRIN** on time (tiny, ideal for append-only data), a few targeted B-trees, and primary keys
  that make retries idempotent (`ON CONFLICT DO NOTHING`).
- **Ids as `bytea`** (16-byte trace id, 8-byte span id): half the size of hex text. Query them with
  `encode(trace_id, 'hex')` and `decode($1, 'hex')`.
- **No money.** Telemetry never stores amounts, incomes or exact proportions; only verdicts,
  currency codes and paths. Pienance is a finance app.

Writes use one statement per batch: `INSERT … SELECT … FROM unnest($1::timestamptz[], $2::text[], …)
ON CONFLICT DO NOTHING`. That is one statement shape and one round trip however many rows there are,
and it is safe behind transaction poolers. See `PostgresTelemetryWriter`.

Least privilege (run once per environment; roles are cluster-wide, so they are not in the
migration):

```sql
CREATE ROLE telemetry_writer LOGIN PASSWORD '…';
ALTER ROLE telemetry_writer SET statement_timeout = '2s';
GRANT USAGE ON SCHEMA telemetry TO telemetry_writer;
GRANT INSERT ON ALL TABLES IN SCHEMA telemetry TO telemetry_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA telemetry GRANT INSERT ON TABLES TO telemetry_writer;
-- Maintenance also needs CREATE on the schema, ownership of the partitioned tables and
-- INSERT/UPDATE on the rollups: run it as the migration role.
```

Example queries:

```sql
-- One trace, as a tree.
SELECT encode(span_id, 'hex') AS span, encode(parent_span_id, 'hex') AS parent, name,
       duration_us / 1000.0 AS ms, status_code
FROM telemetry.spans WHERE trace_id = decode($1, 'hex') ORDER BY start_time;

-- Slowest routes today.
SELECT route, sum(requests) AS requests, max(p95_ms) AS worst_p95_ms
FROM telemetry.route_rollups WHERE bucket >= current_date GROUP BY route ORDER BY 3 DESC;

-- Funnel: of the users who weighed a bite this week, how many took one?
SELECT count(DISTINCT user_id) FILTER (WHERE name = 'bite.weighed') AS weighed,
       count(DISTINCT user_id) FILTER (WHERE name = 'bite.taken')   AS took
FROM telemetry.events WHERE time >= now() - interval '7 days';

-- Product events with the request that produced them.
SELECT e.name, s.name AS span, s.duration_us / 1000.0 AS ms
FROM telemetry.events e JOIN telemetry.spans s ON s.trace_id = e.trace_id AND s.kind = 1
WHERE e.source = 'server' AND e.time >= now() - interval '1 day';
```

Reading: the app's own `/admin` panel (§5.6), any SQL client, or Grafana or Metabase pointed at a read-only role. Grafana's Traces panel
can render `telemetry.spans` rows aliased to `traceID`, `spanID`, `parentSpanID`, `serviceName`,
`startTime` and `duration`. All of these are optional and live outside the deployment.

## 5. Implementation

### 5.1 Where code lives

Telemetry is infrastructure, not business: `@pienance/core` is untouched and unaware of it.

```
packages/telemetry                @pienance/telemetry
  src/contract/                   portable (plain TypeScript + zod): shared by browser, server, native
    events.ts                     ProductEvent union, browser event names, vital names
    beacon.ts                     beacon payload schema, parseBeacon(), size limits
  src/browser/                    DOM only
    identity.ts                   session id (30 min idle) and anonymous id, storage-safe
    beacon-queue.ts               batching: 20 items or 5 s, sendBeacon when unloading, retry buffer
    browser-telemetry.ts          pageview / click / leave / vital; startBrowserTelemetry(window, send)
  src/server/                     Node only, framework-free
    rows.ts, writer.ts            row types; TelemetryWriter port, in-memory and discarding writers
    postgres-writer.ts            PostgresTelemetryWriter (unnest inserts), telemetryPool()
    span-row.ts                   ReadableSpan → SpanRow with promoted attributes
    writer-span-exporter.ts       OTel SpanExporter → TelemetryWriter, tracing suppressed
    tail-sampler.ts               SpanProcessor: per-trace keep/drop, export on root end, defer
    tracing.ts                    startTracing(), traced(), recordError()
    ingest.ts                     beacon → rows stamped by the server; product event rows; deviceOf()
    maintenance.ts                maintainTelemetry(): partitions, retention, rollups

apps/web/src
  instrumentation.ts              register() → startServerTelemetry(); onRequestError → recordError
  pienance.ts                     composition root: telemetry pool/writer, tracing, traced use cases, track()
  server/telemetry-routes.ts      ingestBeacon() and maintenanceRoute(), framework-free
  app/api/telemetry/route.ts      POST beacons
  app/api/telemetry/maintain/route.ts   GET, daily Vercel Cron (vercel.json), CRON_SECRET
  components/telemetry.tsx        <Telemetry />: starts browser telemetry, pageviews, web vitals
```

Boundaries are enforced by oxlint (`no-restricted-imports`): `contract/` imports no platform,
framework or OTel code; `browser/` never imports `server/`, and the reverse is also forbidden.

### 5.2 Server traces

`instrumentation.ts` calls `startServerTelemetry()` once per instance, in the Node.js runtime and
only when a database URL exists. It registers a `NodeTracerProvider` with `service.name` and
`deployment.id`. Next.js then reports its own spans to it (`GET /route`, `render route`,
`resolve page components`…), and `@prisma/instrumentation` adds query spans. The single span
processor is:

```
TailSampler ─► WriterSpanExporter ─► PostgresTelemetryWriter ─► telemetry.spans
```

- **`TailSampler`** buffers ended spans per trace and decides when the local root ends. A
  serverless request runs in one process, so the whole server-side trace is local and tail
  sampling is exact. It keeps every trace with an error, every trace slower than 1 s, and
  `TELEMETRY_SAMPLE_RATIO` of the rest. It exports at once and passes the write to `waitUntil`,
  so spans are stored after the response and before the function is frozen. Spans that end after
  their root follow the root's decision. Memory is bounded (1,000 traces).
- **`WriterSpanExporter`** maps spans to rows and writes them under `suppressTracing`, so saving
  spans creates no spans. Swap it for `OTLPTraceExporter` to send the same spans to any OTel
  backend.
- **`traced()`** wraps each use case at the composition root (`pienance.bakePie` and so on), so
  traces show what the app did, not only the route. Errors are recorded on the span.
- **`onRequestError`** records uncaught errors on the active span, which makes the tail sampler
  keep that trace.

### 5.3 Product events

Server actions call `track(event, ownerId)`, a dependency of `pieActions`, so tests pass a plain
function. The real `track` builds the row immediately (with the active `trace_id`, which joins
the event to its trace) and writes it in `after()`, once the response is sent. Server-side events
are authoritative and immune to ad blockers. WebMCP tools call the same actions, so agent use is
counted too.

| Event            | Properties                   |
| ---------------- | ---------------------------- |
| `pie.baked`      | `currency`                   |
| `pie.resliced`   | `slices`, `retired` (counts) |
| `bite.weighed`   | `verdict`                    |
| `bite.taken`     | —                            |
| `bite.put-back`  | —                            |
| `bite.moved`     | —                            |
| `staple.stocked` | `replaced`                   |
| `staple.dropped` | `removed`                    |
| `statement.read` | `bites` (count), `trimmed`   |
| `bites.taken`    | `taken`, `duplicates`        |

### 5.4 Browser: clickstream and web vitals

`<Telemetry />` in the root layout starts `startBrowserTelemetry(window, beaconSender("/api/telemetry"))`
unless the visitor sends Global Privacy Control. It then:

- sends `$pageview` on load and on every App Router navigation (`usePathname`); the first one
  carries the referrer's **origin** only;
- sends `$click` for clicks on elements marked `data-track="name"` (`bake`, `weigh`, `take`),
  recording only the name, never text or input values;
- sends `$leave` with time on page when the page is hidden;
- reports web vitals from `useReportWebVitals`, ignoring Next's own non-standard metrics.

The beacon queue batches 20 items or 5 seconds, whichever comes first. When the page is hidden it
flushes with `navigator.sendBeacon`; otherwise it uses `fetch(…, { keepalive: true })`. A failed
batch is kept (at most 200 items) for the next flush. Every item has an id generated in the
browser, so a retry is stored once. Paths never include query strings or fragments. The session
id lives in `sessionStorage` and the anonymous id in `localStorage`, both behind `try/catch`
(blocked storage just means ids last as long as the page).

Browser traces (the OTel web SDK, ~60 KB) are left out on purpose.

### 5.5 Ingestion and maintenance routes

`POST /api/telemetry` (`ingestBeacon`):

- rejects cross-site requests (`Sec-Fetch-Site`) and bodies over 60 KB;
- parses the body against the contract (zod: known names only, at most 100 items and
  10 flat properties each, unknown keys stripped);
- stamps rows with the signed-in user from the session (never a user id sent by the client),
  the device class from `User-Agent`, the country from `x-vercel-ip-country` or
  `cloudfront-viewer-country`, and the deployment;
- responds `204` and writes in `after()`.

`GET /api/telemetry/maintain` (`maintenanceRoute`) runs daily from Vercel Cron
(`vercel.json`, `17 3 * * *`; Hobby plans allow daily crons only, Pro can go hourly for fresher
rollups). It requires `Authorization: Bearer $CRON_SECRET` and stays shut
when the secret is unset. It runs `maintain_partitions(3, 14)` and refreshes both rollups for yesterday and today; every step is idempotent. On AWS, an EventBridge schedule can call the same URL.

### 5.6 Admin panel

`/admin` reads the raw tables through `PostgresTelemetryReader` for the last day, week or two
weeks. Only users whose role may `read` `Telemetry` (admins, a CASL ability in `@pienance/auth`; see the README's Roles) get in: anyone else gets a 404, and signed-out visitors go to sign-in.
It shows totals, requests by route (median, p95, errors), failed and slowest requests, web vitals
at p75 with web.dev's verdicts, the product funnel by people, and top pages and clicks.
`/admin/traces/[traceId]` draws a trace as a waterfall, with failed spans named in words. Every
query is bounded by time or a limit.

## 6. Tests

| Where                           | What                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `telemetry/src/contract`        | `parseBeacon`: valid payloads, unknown names, query strings, property limits, batch size   |
| `telemetry/src/browser` (jsdom) | queue size/time/unload flushes, retry and buffer cap; identity; page listeners             |
| `telemetry/src/server`          | tail sampling decisions, span → row mapping, `traced`; ingest mapping, clock skew, devices |
| `telemetry/src/server` (PGlite) | writer round trip, idempotent retry, jsonb escaping, rollups, partition create/drop        |
| `web/src/server`                | ingestion route (owner from session, 400/403/413), cron auth, product events in actions    |
| `web/src/components`            | `<Telemetry />` sends pageview and tracked clicks; admin overview, waterfall, formatting   |
| `telemetry/src/server` (PGlite) | `PostgresTelemetryReader`: totals, routes, vitals, events, failures, traces, bad ids       |

An end-to-end run (`next start` on a PGlite database) stores Next.js spans, beacon events and
vitals, and the rollups, as described.

## 7. Capacity and cost

Rough sizing per row, including indexes: span ~0.5 KB, event ~0.4 KB, vital ~0.3 KB.

| Traffic                     | Spans/day (8/request) | Raw size/day | 14-day footprint |
| --------------------------- | --------------------- | ------------ | ---------------- |
| 10 k requests/day           | 80 k                  | ~40 MB       | ~0.6 GB          |
| 1 M requests/day            | 8 M                   | ~4 GB        | ~56 GB           |
| 1 M requests/day, 10 % kept | 0.8 M (+ all errors)  | ~0.4 GB      | ~6 GB            |

Rollups are tiny and are kept. Lower `keep_days` or `TELEMETRY_SAMPLE_RATIO` before reaching for
another store.

## 8. Operating it

Environment:

| Variable                 | Default                     | Purpose                                                          |
| ------------------------ | --------------------------- | ---------------------------------------------------------------- |
| `TELEMETRY_DATABASE_URL` | the app's database URL      | where telemetry goes; prefer a pooled URL and `telemetry_writer` |
| `TELEMETRY_SAMPLE_RATIO` | `1`                         | share of ordinary traces kept (errors and slow ones always are)  |
| `CRON_SECRET`            | unset (maintenance is shut) | authorises the daily maintenance cron                            |

Without any database URL, tracing is not started and beacons are discarded, like the rest of the
app running in memory.

Possible next steps, only when needed: a dashboard on the rollups, deleting a user's telemetry
rows when their account is deleted (once accounts can be deleted), browser traces linked through
a `traceparent` meta tag, and an OTLP ingestion endpoint for other services.
