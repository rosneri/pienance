import { Pool } from "pg";
import type { EventRow, SpanRow, VitalRow } from "./rows";
import type { TelemetryWriter } from "./writer";

/** What the writer needs from a pool or client. */
export type Queryable = Pick<Pool, "query">;

/** Rows per statement: bounds statement size while keeping one round trip per flush. */
const batchSize = 500;

function chunks<T>(rows: readonly T[]): T[][] {
  return Array.from({ length: Math.ceil(rows.length / batchSize) }, (_, i) =>
    rows.slice(i * batchSize, (i + 1) * batchSize),
  );
}

const spanInsert = `
INSERT INTO telemetry.spans (start_time, trace_id, span_id, parent_span_id, name, kind,
  duration_us, status_code, status_message, service, deployment, http_route, http_method,
  http_status, user_id, attributes, events)
SELECT t.start_time, decode(t.trace_id, 'hex'), decode(t.span_id, 'hex'),
  decode(t.parent_span_id, 'hex'), t.name, t.kind, t.duration_us, t.status_code,
  t.status_message, t.service, t.deployment, t.http_route, t.http_method, t.http_status,
  t.user_id, t.attributes::jsonb, t.events::jsonb
FROM unnest($1::timestamptz[], $2::text[], $3::text[], $4::text[], $5::text[], $6::smallint[],
  $7::bigint[], $8::smallint[], $9::text[], $10::text[], $11::text[], $12::text[], $13::text[],
  $14::smallint[], $15::text[], $16::text[], $17::text[])
  AS t(start_time, trace_id, span_id, parent_span_id, name, kind, duration_us, status_code,
    status_message, service, deployment, http_route, http_method, http_status, user_id,
    attributes, events)
ON CONFLICT DO NOTHING`;

const eventInsert = `
INSERT INTO telemetry.events (time, client_time, id, name, source, session_id, anonymous_id,
  user_id, path, referrer, trace_id, deployment, device, country, properties)
SELECT t.time, t.client_time, t.id, t.name, t.source, t.session_id, t.anonymous_id, t.user_id,
  t.path, t.referrer, decode(t.trace_id, 'hex'), t.deployment, t.device, t.country,
  t.properties::jsonb
FROM unnest($1::timestamptz[], $2::timestamptz[], $3::uuid[], $4::text[], $5::text[],
  $6::uuid[], $7::uuid[], $8::text[], $9::text[], $10::text[], $11::text[], $12::text[],
  $13::text[], $14::text[], $15::text[])
  AS t(time, client_time, id, name, source, session_id, anonymous_id, user_id, path, referrer,
    trace_id, deployment, device, country, properties)
ON CONFLICT DO NOTHING`;

const vitalInsert = `
INSERT INTO telemetry.web_vitals (time, client_time, id, name, value, rating, navigation_type,
  route, session_id, user_id, deployment, device, country)
SELECT * FROM unnest($1::timestamptz[], $2::timestamptz[], $3::text[], $4::text[],
  $5::float8[], $6::text[], $7::text[], $8::text[], $9::uuid[], $10::text[], $11::text[],
  $12::text[], $13::text[])
ON CONFLICT DO NOTHING`;

/**
 * Stores telemetry with one multi-row INSERT per batch (`unnest` over typed arrays): one
 * statement shape and one round trip, however many rows. Safe behind transaction poolers.
 */
export class PostgresTelemetryWriter implements TelemetryWriter {
  readonly #db: Queryable;

  constructor(db: Queryable) {
    this.#db = db;
  }

  async spans(rows: readonly SpanRow[]): Promise<void> {
    await Promise.all(
      chunks(rows).map((batch) =>
        this.#db.query(spanInsert, [
          batch.map((row) => row.startTime),
          batch.map((row) => row.traceId),
          batch.map((row) => row.spanId),
          batch.map((row) => row.parentSpanId),
          batch.map((row) => row.name),
          batch.map((row) => row.kind),
          batch.map((row) => row.durationUs),
          batch.map((row) => row.statusCode),
          batch.map((row) => row.statusMessage),
          batch.map((row) => row.service),
          batch.map((row) => row.deployment),
          batch.map((row) => row.httpRoute),
          batch.map((row) => row.httpMethod),
          batch.map((row) => row.httpStatus),
          batch.map((row) => row.userId),
          batch.map((row) => JSON.stringify(row.attributes)),
          batch.map((row) => (row.events ? JSON.stringify(row.events) : null)),
        ]),
      ),
    );
  }

  async events(rows: readonly EventRow[]): Promise<void> {
    await Promise.all(
      chunks(rows).map((batch) =>
        this.#db.query(eventInsert, [
          batch.map((row) => row.time),
          batch.map((row) => row.clientTime),
          batch.map((row) => row.id),
          batch.map((row) => row.name),
          batch.map((row) => row.source),
          batch.map((row) => row.sessionId),
          batch.map((row) => row.anonymousId),
          batch.map((row) => row.userId),
          batch.map((row) => row.path),
          batch.map((row) => row.referrer),
          batch.map((row) => row.traceId),
          batch.map((row) => row.deployment),
          batch.map((row) => row.device),
          batch.map((row) => row.country),
          batch.map((row) => JSON.stringify(row.properties)),
        ]),
      ),
    );
  }

  async vitals(rows: readonly VitalRow[]): Promise<void> {
    await Promise.all(
      chunks(rows).map((batch) =>
        this.#db.query(vitalInsert, [
          batch.map((row) => row.time),
          batch.map((row) => row.clientTime),
          batch.map((row) => row.id),
          batch.map((row) => row.name),
          batch.map((row) => row.value),
          batch.map((row) => row.rating),
          batch.map((row) => row.navigationType),
          batch.map((row) => row.route),
          batch.map((row) => row.sessionId),
          batch.map((row) => row.userId),
          batch.map((row) => row.deployment),
          batch.map((row) => row.device),
          batch.map((row) => row.country),
        ]),
      ),
    );
  }
}

/**
 * A pool for telemetry alone, sized for serverless: one connection per instance, closed
 * quickly when idle, so it never competes with the app's own pool for database slots.
 * Point it at a pooled (PgBouncer, Supavisor, Prisma Postgres) URL.
 */
export function telemetryPool(connectionString: string): Pool {
  const pool = new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 2_000,
    application_name: "pienance-telemetry",
  });

  // An idle client dropped by the server must not crash the process; the next query reconnects.
  pool.on("error", () => undefined);

  return pool;
}
