import { maxBeaconBytes, parseBeacon } from "@pienance/telemetry/contract";
import { beaconRows, deviceOf, type TelemetryWriter } from "@pienance/telemetry/server";

export interface IngestDeps {
  /** Resolved per request, so importing the route needs no database. */
  readonly writer: () => TelemetryWriter;
  /** The signed-in user's id, or null: never taken from the beacon. */
  readonly owner: (request: Request) => Promise<string | null>;
  readonly now: () => Date;
  readonly deployment: string | null;
  /** Runs work after the response is sent (Next's `after`). */
  readonly defer: (work: () => Promise<void>) => void;
}

const respond = (status: number): Response => new Response(null, { status });

/**
 * Receives the browser's beacons: same-origin only, size-capped, parsed against the contract,
 * stamped with what the server knows, and stored after the response so the page never waits.
 */
export function ingestBeacon(deps: IngestDeps) {
  return async (request: Request): Promise<Response> => {
    const site = request.headers.get("sec-fetch-site");

    if (site && site !== "same-origin") return respond(403);

    if (Number(request.headers.get("content-length") ?? "0") > maxBeaconBytes) return respond(413);

    const body = await request.text();

    if (body.length > maxBeaconBytes) return respond(413);

    const beacon = parseBeacon(body);

    if (!beacon) return respond(400);

    const rows = beaconRows(beacon, {
      at: deps.now(),
      // A failed session lookup must not lose the beacon: store it as anonymous.
      userId: await deps.owner(request).catch(() => null),
      deployment: deps.deployment,
      device: deviceOf(request.headers.get("user-agent")),
      country:
        request.headers.get("x-vercel-ip-country") ??
        request.headers.get("cloudfront-viewer-country"),
    });

    deps.defer(async () => {
      const writer = deps.writer();

      await Promise.all([writer.events(rows.events), writer.vitals(rows.vitals)]).catch(
        () => undefined,
      );
    });

    return respond(204);
  };
}

export interface MaintenanceDeps {
  /** CRON_SECRET: Vercel Cron sends it as a bearer token. Without it the route stays shut. */
  readonly secret: string | undefined;
  readonly maintain: () => Promise<void>;
}

/** The daily upkeep, called by a cron request: partitions, retention and rollups. */
export function maintenanceRoute(deps: MaintenanceDeps) {
  return async (request: Request): Promise<Response> => {
    if (!deps.secret || request.headers.get("authorization") !== `Bearer ${deps.secret}`) {
      return respond(401);
    }

    await deps.maintain();

    return respond(204);
  };
}
