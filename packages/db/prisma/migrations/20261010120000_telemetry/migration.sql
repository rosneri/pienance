-- Telemetry: spans, web vitals and events in their own schema, partitioned by day.
-- Prisma only models the "public" schema, so these tables never show up as drift.
-- Design and queries: docs/telemetry.md.

CREATE SCHEMA IF NOT EXISTS telemetry;

-- ── Spans (APM) ────────────────────────────────────────────────────────────
CREATE TABLE telemetry.spans (
  start_time      timestamptz NOT NULL,
  trace_id        bytea       NOT NULL,           -- 16 bytes
  span_id         bytea       NOT NULL,           -- 8 bytes
  parent_span_id  bytea,
  name            text        NOT NULL,
  kind            smallint    NOT NULL,           -- OTel SpanKind: 0 internal, 1 server, 2 client, 3 producer, 4 consumer
  duration_us     bigint      NOT NULL,
  status_code     smallint    NOT NULL DEFAULT 0, -- 0 unset, 1 ok, 2 error
  status_message  text,
  service         text        NOT NULL,
  deployment      text,
  http_route      text,
  http_method     text,
  http_status     smallint,
  user_id         text,
  attributes      jsonb       NOT NULL DEFAULT '{}',
  events          jsonb,
  PRIMARY KEY (trace_id, span_id, start_time)
) PARTITION BY RANGE (start_time);

CREATE INDEX spans_time_brin  ON telemetry.spans USING brin (start_time);
CREATE INDEX spans_route_time ON telemetry.spans (http_route, start_time) WHERE kind = 1;
CREATE INDEX spans_errors     ON telemetry.spans (start_time) WHERE status_code = 2;

-- ── Web vitals ─────────────────────────────────────────────────────────────
CREATE TABLE telemetry.web_vitals (
  time             timestamptz      NOT NULL DEFAULT now(),
  client_time      timestamptz,
  id               text             NOT NULL,
  name             text             NOT NULL CHECK (name IN ('LCP', 'INP', 'CLS', 'FCP', 'TTFB')),
  value            double precision NOT NULL,
  rating           text CHECK (rating IN ('good', 'needs-improvement', 'poor')),
  navigation_type  text,
  route            text             NOT NULL,
  session_id       uuid             NOT NULL,
  user_id          text,
  deployment       text,
  device           text,
  country          text,
  PRIMARY KEY (id, time)
) PARTITION BY RANGE (time);

CREATE INDEX web_vitals_time_brin  ON telemetry.web_vitals USING brin (time);
CREATE INDEX web_vitals_route_name ON telemetry.web_vitals (route, name, time);

-- ── Events: product analytics and clickstream ──────────────────────────────
CREATE TABLE telemetry.events (
  time          timestamptz NOT NULL DEFAULT now(),
  client_time   timestamptz,
  id            uuid        NOT NULL,
  name          text        NOT NULL,
  source        text        NOT NULL CHECK (source IN ('browser', 'server')),
  session_id    uuid,
  anonymous_id  uuid,
  user_id       text,
  path          text,
  referrer      text,
  trace_id      bytea,
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

-- ── Rollups, kept for months ───────────────────────────────────────────────
CREATE TABLE telemetry.route_rollups (
  bucket    timestamptz      NOT NULL,
  service   text             NOT NULL,
  route     text             NOT NULL,
  requests  integer          NOT NULL,
  errors    integer          NOT NULL,
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
  p75      double precision NOT NULL,
  good     integer          NOT NULL,
  poor     integer          NOT NULL,
  PRIMARY KEY (day, route, name, device)
);

-- ── Partition upkeep: create ahead, drop behind ────────────────────────────
CREATE FUNCTION telemetry.maintain_partitions(days_ahead integer DEFAULT 3, keep_days integer DEFAULT 14)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  parent text;
  day    date;
  child  record;
BEGIN
  FOREACH parent IN ARRAY ARRAY['spans', 'web_vitals', 'events'] LOOP
    FOR day IN SELECT generate_series(current_date - 1, current_date + days_ahead, interval '1 day')::date LOOP
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS telemetry.%I PARTITION OF telemetry.%I FOR VALUES FROM (%L) TO (%L)',
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
