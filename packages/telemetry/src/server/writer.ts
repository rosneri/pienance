import type { EventRow, SpanRow, VitalRow } from "./rows";

/** Where telemetry is stored. Writes are idempotent: the same row twice is stored once. */
export interface TelemetryWriter {
  spans(rows: readonly SpanRow[]): Promise<void>;
  events(rows: readonly EventRow[]): Promise<void>;
  vitals(rows: readonly VitalRow[]): Promise<void>;
}

/** Keeps rows in memory, for tests. */
export class InMemoryTelemetryWriter implements TelemetryWriter {
  readonly storedSpans: SpanRow[] = [];
  readonly storedEvents: EventRow[] = [];
  readonly storedVitals: VitalRow[] = [];

  async spans(rows: readonly SpanRow[]): Promise<void> {
    this.storedSpans.push(...rows);
  }

  async events(rows: readonly EventRow[]): Promise<void> {
    this.storedEvents.push(...rows);
  }

  async vitals(rows: readonly VitalRow[]): Promise<void> {
    this.storedVitals.push(...rows);
  }
}

/** Throws everything away: telemetry when there is no database to keep it in. */
export const discardingWriter: TelemetryWriter = {
  spans: async () => undefined,
  events: async () => undefined,
  vitals: async () => undefined,
};
