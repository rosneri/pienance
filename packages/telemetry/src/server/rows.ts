import type { Attributes } from "@opentelemetry/api";
import type { Properties, VitalName, VitalRating } from "../contract";

/** One finished span, as stored in `telemetry.spans`. Ids are lowercase hex. */
export interface SpanRow {
  readonly startTime: Date;
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId: string | null;
  readonly name: string;
  readonly kind: number;
  readonly durationUs: number;
  readonly statusCode: number;
  readonly statusMessage: string | null;
  readonly service: string;
  readonly deployment: string | null;
  readonly httpRoute: string | null;
  readonly httpMethod: string | null;
  readonly httpStatus: number | null;
  readonly userId: string | null;
  readonly attributes: Attributes;
  readonly events: readonly SpanEventRow[] | null;
}

export interface SpanEventRow {
  readonly name: string;
  readonly time: string;
  readonly attributes: Attributes;
}

/** A product or clickstream event, as stored in `telemetry.events`. */
export interface EventRow {
  /** When the server received it: the partition key. */
  readonly time: Date;
  readonly clientTime: Date | null;
  readonly id: string;
  readonly name: string;
  readonly source: "browser" | "server";
  readonly sessionId: string | null;
  readonly anonymousId: string | null;
  readonly userId: string | null;
  readonly path: string | null;
  readonly referrer: string | null;
  readonly traceId: string | null;
  readonly deployment: string | null;
  readonly device: string | null;
  readonly country: string | null;
  readonly properties: Properties;
}

/** One web vital sample, as stored in `telemetry.web_vitals`. */
export interface VitalRow {
  readonly time: Date;
  readonly clientTime: Date | null;
  readonly id: string;
  readonly name: VitalName;
  readonly value: number;
  readonly rating: VitalRating | null;
  readonly navigationType: string | null;
  readonly route: string;
  readonly sessionId: string;
  readonly userId: string | null;
  readonly deployment: string | null;
  readonly device: string | null;
  readonly country: string | null;
}
