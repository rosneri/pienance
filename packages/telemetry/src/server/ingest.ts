import type { Beacon, ProductEvent } from "../contract";
import type { EventRow, VitalRow } from "./rows";

/** What the server knows about a beacon's request; never taken from the beacon itself. */
export interface Received {
  readonly at: Date;
  readonly userId: string | null;
  readonly deployment: string | null;
  readonly device: string | null;
  readonly country: string | null;
}

/** Client clocks further off than this are not trusted. */
const maxClockSkewMs = 7 * 24 * 60 * 60 * 1000;

function clientTime(at: number, received: Date): Date | null {
  return Math.abs(at - received.getTime()) <= maxClockSkewMs ? new Date(at) : null;
}

export interface BeaconRows {
  readonly events: EventRow[];
  readonly vitals: VitalRow[];
}

/** A browser beacon as rows, stamped with what the server knows. */
export function beaconRows(beacon: Beacon, received: Received): BeaconRows {
  const events: EventRow[] = [];
  const vitals: VitalRow[] = [];

  const common = {
    time: received.at,
    sessionId: beacon.sessionId,
    userId: received.userId,
    deployment: received.deployment,
    device: received.device,
    country: received.country,
  };

  for (const item of beacon.items) {
    if (item.type === "event") {
      events.push({
        ...common,
        clientTime: clientTime(item.at, received.at),
        id: item.id,
        name: item.name,
        source: "browser",
        anonymousId: beacon.anonymousId,
        path: item.path,
        referrer: item.referrer ?? null,
        traceId: null,
        properties: item.properties,
      });
    } else {
      vitals.push({
        ...common,
        clientTime: clientTime(item.at, received.at),
        id: item.id,
        name: item.name,
        value: item.value,
        rating: item.rating ?? null,
        navigationType: item.navigationType ?? null,
        route: item.path,
      });
    }
  }

  return { events, vitals };
}

export interface ServerEventContext {
  readonly id: string;
  readonly at: Date;
  readonly userId: string;
  /** The trace the event happened in, joining it to its spans. */
  readonly traceId: string | null;
  readonly deployment: string | null;
}

/** A product event recorded on the server, where its outcome and owner are known. */
export function productEventRow(event: ProductEvent, context: ServerEventContext): EventRow {
  return {
    time: context.at,
    clientTime: null,
    id: context.id,
    name: event.name,
    source: "server",
    sessionId: null,
    anonymousId: null,
    userId: context.userId,
    path: null,
    referrer: null,
    traceId: context.traceId,
    deployment: context.deployment,
    device: null,
    country: null,
    properties: event.properties,
  };
}

/** A coarse device class from a User-Agent header; enough to split web vitals. */
export function deviceOf(userAgent: string | null): "mobile" | "tablet" | "desktop" | null {
  if (!userAgent) return null;

  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)) return "tablet";

  if (/Mobi|iPhone|Android/i.test(userAgent)) return "mobile";

  return "desktop";
}
