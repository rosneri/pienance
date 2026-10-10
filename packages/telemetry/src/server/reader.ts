import type { VitalName } from "../contract";
import type { Queryable } from "./postgres-writer";

export interface Totals {
  readonly requests: number;
  readonly failedRequests: number;
  readonly sessions: number;
  readonly people: number;
}

export interface RouteStats {
  readonly route: string;
  readonly requests: number;
  readonly errors: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
}

export interface VitalStats {
  readonly name: VitalName;
  readonly samples: number;
  readonly p75: number;
  readonly good: number;
  readonly poor: number;
}

export interface EventStats {
  readonly name: string;
  readonly source: "browser" | "server";
  readonly count: number;
  /** Distinct signed-in users, or anonymous visitors when nobody was signed in. */
  readonly people: number;
}

export interface PageStats {
  readonly path: string;
  readonly views: number;
  readonly sessions: number;
}

export interface ClickStats {
  readonly target: string;
  readonly clicks: number;
}

/** A request (a trace's root span) worth a look: failed or slow. */
export interface RequestSummary {
  readonly traceId: string;
  readonly at: Date;
  readonly name: string;
  readonly route: string | null;
  readonly status: number | null;
  readonly durationMs: number;
  readonly message: string | null;
}

export interface TelemetryOverview {
  readonly totals: Totals;
  readonly routes: readonly RouteStats[];
  readonly vitals: readonly VitalStats[];
  readonly events: readonly EventStats[];
  readonly pages: readonly PageStats[];
  readonly clicks: readonly ClickStats[];
  readonly failures: readonly RequestSummary[];
  readonly slowest: readonly RequestSummary[];
}

export interface TraceSpan {
  readonly spanId: string;
  readonly parentSpanId: string | null;
  readonly name: string;
  readonly kind: number;
  readonly startTime: Date;
  readonly durationMs: number;
  readonly failed: boolean;
  readonly message: string | null;
  readonly route: string | null;
  readonly status: number | null;
}

/** Reads telemetry back for people operating the app. */
export interface TelemetryReader {
  overview(since: Date): Promise<TelemetryOverview>;
  /** Every stored span of one trace, oldest first; empty when unknown. */
  trace(traceId: string): Promise<TraceSpan[]>;
}

const totalsQuery = `
SELECT
  (SELECT count(*) FROM telemetry.spans
    WHERE kind = 1 AND parent_span_id IS NULL AND start_time >= $1)::int AS requests,
  (SELECT count(DISTINCT trace_id) FROM telemetry.spans
    WHERE status_code = 2 AND start_time >= $1)::int AS "failedRequests",
  (SELECT count(DISTINCT session_id) FROM telemetry.events
    WHERE source = 'browser' AND time >= $1)::int AS sessions,
  (SELECT count(DISTINCT coalesce(user_id, anonymous_id::text)) FROM telemetry.events
    WHERE time >= $1)::int AS people`;

const routesQuery = `
SELECT http_route AS route, count(*)::int AS requests,
  count(*) FILTER (WHERE status_code = 2 OR http_status >= 500)::int AS errors,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY duration_us) / 1000 AS "p50Ms",
  percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_us) / 1000 AS "p95Ms"
FROM telemetry.spans
WHERE kind = 1 AND http_route IS NOT NULL AND start_time >= $1
GROUP BY http_route ORDER BY requests DESC, route LIMIT 20`;

const vitalsQuery = `
SELECT name, count(*)::int AS samples,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY value) AS p75,
  count(*) FILTER (WHERE rating = 'good')::int AS good,
  count(*) FILTER (WHERE rating = 'poor')::int AS poor
FROM telemetry.web_vitals WHERE time >= $1
GROUP BY name ORDER BY array_position(ARRAY['LCP', 'INP', 'CLS', 'FCP', 'TTFB'], name)`;

const eventsQuery = `
SELECT name, source, count(*)::int AS count,
  count(DISTINCT coalesce(user_id, anonymous_id::text))::int AS people
FROM telemetry.events WHERE time >= $1
GROUP BY name, source ORDER BY count DESC, name`;

const pagesQuery = `
SELECT path, count(*)::int AS views, count(DISTINCT session_id)::int AS sessions
FROM telemetry.events WHERE name = '$pageview' AND time >= $1
GROUP BY path ORDER BY views DESC, path LIMIT 10`;

const clicksQuery = `
SELECT properties->>'target' AS target, count(*)::int AS clicks
FROM telemetry.events WHERE name = '$click' AND time >= $1
GROUP BY 1 ORDER BY clicks DESC, target LIMIT 10`;

const requestColumns = `encode(trace_id, 'hex') AS "traceId", start_time AS at, name,
  http_route AS route, http_status AS status, duration_us::float8 / 1000 AS "durationMs",
  status_message AS message`;

/** The latest failed traces, each shown by its root request. */
const failuresQuery = `
WITH failed AS (
  SELECT trace_id, max(status_message) AS message FROM telemetry.spans
  WHERE status_code = 2 AND start_time >= $1 GROUP BY trace_id
)
SELECT encode(s.trace_id, 'hex') AS "traceId", s.start_time AS at, s.name,
  s.http_route AS route, s.http_status AS status, s.duration_us::float8 / 1000 AS "durationMs",
  failed.message
FROM telemetry.spans s JOIN failed USING (trace_id)
WHERE s.parent_span_id IS NULL AND s.start_time >= $1
ORDER BY s.start_time DESC LIMIT 20`;

const slowestQuery = `
SELECT ${requestColumns} FROM telemetry.spans
WHERE kind = 1 AND parent_span_id IS NULL AND start_time >= $1
ORDER BY duration_us DESC LIMIT 10`;

const traceQuery = `
SELECT encode(span_id, 'hex') AS "spanId", encode(parent_span_id, 'hex') AS "parentSpanId",
  name, kind, start_time AS "startTime", duration_us::float8 / 1000 AS "durationMs",
  status_code = 2 AS failed, status_message AS message, http_route AS route,
  http_status AS status
FROM telemetry.spans WHERE trace_id = decode($1, 'hex')
ORDER BY start_time, duration_us DESC LIMIT 500`;

const traceIdPattern = /^[0-9a-f]{32}$/;

/** Reads the `telemetry` schema. Every query is bounded by time or a limit. */
export class PostgresTelemetryReader implements TelemetryReader {
  readonly #db: Queryable;

  constructor(db: Queryable) {
    this.#db = db;
  }

  async overview(since: Date): Promise<TelemetryOverview> {
    const [totals, routes, vitals, events, pages, clicks, failures, slowest] = await Promise.all([
      this.#db.query<Totals>(totalsQuery, [since]),
      this.#db.query<RouteStats>(routesQuery, [since]),
      this.#db.query<VitalStats>(vitalsQuery, [since]),
      this.#db.query<EventStats>(eventsQuery, [since]),
      this.#db.query<PageStats>(pagesQuery, [since]),
      this.#db.query<ClickStats>(clicksQuery, [since]),
      this.#db.query<RequestSummary>(failuresQuery, [since]),
      this.#db.query<RequestSummary>(slowestQuery, [since]),
    ]);

    return {
      totals: totals.rows[0] ?? { requests: 0, failedRequests: 0, sessions: 0, people: 0 },
      routes: routes.rows,
      vitals: vitals.rows,
      events: events.rows,
      pages: pages.rows,
      clicks: clicks.rows,
      failures: failures.rows,
      slowest: slowest.rows,
    };
  }

  async trace(traceId: string): Promise<TraceSpan[]> {
    if (!traceIdPattern.test(traceId)) return [];

    return (await this.#db.query<TraceSpan>(traceQuery, [traceId])).rows;
  }
}
