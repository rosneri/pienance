import type { Queryable } from "./postgres-writer";

export interface Retention {
  /** Daily partitions created ahead of time. */
  readonly daysAhead: number;
  /** Days of raw spans, events and vitals kept; rollups are kept. */
  readonly keepDays: number;
}

const routeRollup = `
INSERT INTO telemetry.route_rollups
SELECT date_bin('5 minutes', start_time, timestamptz 'epoch') AS bucket, service, http_route,
  count(*), count(*) FILTER (WHERE status_code = 2 OR http_status >= 500),
  percentile_cont(0.50) WITHIN GROUP (ORDER BY duration_us) / 1000,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_us) / 1000,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_us) / 1000
FROM telemetry.spans
WHERE kind = 1 AND http_route IS NOT NULL
  AND start_time >= current_date - 1
GROUP BY 1, 2, 3
ON CONFLICT (bucket, service, route) DO UPDATE SET
  requests = excluded.requests, errors = excluded.errors,
  p50_ms = excluded.p50_ms, p95_ms = excluded.p95_ms, p99_ms = excluded.p99_ms`;

const vitalRollup = `
INSERT INTO telemetry.vital_rollups
SELECT time::date, route, name, coalesce(device, 'unknown'), count(*),
  percentile_cont(0.75) WITHIN GROUP (ORDER BY value),
  count(*) FILTER (WHERE rating = 'good'), count(*) FILTER (WHERE rating = 'poor')
FROM telemetry.web_vitals
WHERE time >= current_date - 1
GROUP BY 1, 2, 3, 4
ON CONFLICT (day, route, name, device) DO UPDATE SET
  samples = excluded.samples, p75 = excluded.p75, good = excluded.good, poor = excluded.poor`;

/**
 * The scheduled upkeep (a daily cron request, not a daemon): creates the coming days'
 * partitions, drops expired ones, and refreshes the rollups of yesterday and today, so a run
 * at any time of day completes yesterday. Every step is idempotent.
 */
export async function maintainTelemetry(db: Queryable, retention: Retention): Promise<void> {
  await db.query("SELECT telemetry.maintain_partitions($1, $2)", [
    retention.daysAhead,
    retention.keepDays,
  ]);
  await db.query(routeRollup);
  await db.query(vitalRollup);
}
