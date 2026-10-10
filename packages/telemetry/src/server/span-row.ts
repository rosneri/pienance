import type { AttributeValue } from "@opentelemetry/api";
import { hrTimeToMicroseconds, hrTimeToMilliseconds } from "@opentelemetry/core";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-node";
import type { SpanRow } from "./rows";

function text(value: AttributeValue | undefined): string | null {
  return value === undefined ? null : String(value).slice(0, 500);
}

function integer(value: AttributeValue | undefined): number | null {
  const number = Number(value);

  return value === undefined || !Number.isInteger(number) ? null : number;
}

/**
 * A finished span as a row. Attributes the dashboards filter on are promoted to columns, using
 * the current semantic conventions and the older names Next.js still emits.
 */
export function spanRow(span: ReadableSpan): SpanRow {
  const attributes = span.attributes;
  const resource = span.resource.attributes;

  return {
    startTime: new Date(hrTimeToMilliseconds(span.startTime)),
    traceId: span.spanContext().traceId,
    spanId: span.spanContext().spanId,
    parentSpanId: span.parentSpanContext?.spanId ?? null,
    name: span.name,
    kind: span.kind,
    durationUs: Math.round(hrTimeToMicroseconds(span.duration)),
    statusCode: span.status.code,
    statusMessage: span.status.message ?? null,
    service: text(resource["service.name"]) ?? "unknown",
    deployment: text(resource["deployment.id"]),
    httpRoute: text(attributes["http.route"] ?? attributes["next.route"]),
    httpMethod: text(attributes["http.request.method"] ?? attributes["http.method"]),
    httpStatus: integer(attributes["http.response.status_code"] ?? attributes["http.status_code"]),
    userId: text(attributes["enduser.id"]),
    attributes,
    events:
      span.events.length === 0
        ? null
        : span.events.map((event) => ({
            name: event.name,
            time: new Date(hrTimeToMilliseconds(event.time)).toISOString(),
            attributes: event.attributes ?? {},
          })),
  };
}
