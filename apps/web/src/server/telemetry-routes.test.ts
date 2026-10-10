import { InMemoryTelemetryWriter } from "@pienance/telemetry/server";
import { describe, expect, it } from "vitest";
import { ingestBeacon, maintenanceRoute } from "./telemetry-routes";

const now = new Date("2026-10-10T12:00:00Z");

function ingest(owner: string | null | Error = "owner-1") {
  const writer = new InMemoryTelemetryWriter();
  const deferred: Array<() => Promise<void>> = [];

  const handle = ingestBeacon({
    writer: () => writer,
    owner: async () => {
      if (owner instanceof Error) throw owner;

      return owner;
    },
    now: () => now,
    deployment: "dpl_1",
    defer: (work) => void deferred.push(work),
  });

  return { writer, handle, flush: () => Promise.all(deferred.map((work) => work())) };
}

const beacon = {
  sessionId: "4f9c1f0e-5d5a-4c1e-9a77-0d1c2b3a4f5e",
  anonymousId: "0b8e2a6c-1f3d-4e5a-8b7c-9d0e1f2a3b4c",
  items: [
    {
      type: "event",
      id: "a3c1e5f7-2b4d-4f6a-8c0e-1d3f5a7b9c2e",
      name: "$pageview",
      at: now.getTime(),
      path: "/",
      // Ignored: who is signed in comes from the session, not the beacon.
      userId: "someone-else",
    },
    { type: "vital", id: "v1", name: "CLS", value: 0.02, at: now.getTime(), path: "/" },
  ],
};

function post(body: string, headers: Record<string, string> = {}): Request {
  return new Request("https://pienance.test/api/telemetry", {
    method: "POST",
    body,
    headers: { "sec-fetch-site": "same-origin", ...headers },
  });
}

describe("ingestBeacon", () => {
  it("stores events and vitals after responding, with the server's view of the user", async () => {
    const { writer, handle, flush } = ingest();

    const response = await handle(
      post(JSON.stringify(beacon), {
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
        "x-vercel-ip-country": "NL",
      }),
    );

    expect(response.status).toBe(204);
    expect(writer.storedEvents).toEqual([]);

    await flush();

    expect(writer.storedEvents[0]).toMatchObject({
      name: "$pageview",
      userId: "owner-1",
      device: "mobile",
      country: "NL",
      deployment: "dpl_1",
    });
    expect(writer.storedVitals[0]).toMatchObject({ name: "CLS", value: 0.02 });
  });

  it("stores the beacon as anonymous when the session cannot be read", async () => {
    const { writer, handle, flush } = ingest(new Error("Connection terminated unexpectedly"));

    expect((await handle(post(JSON.stringify(beacon)))).status).toBe(204);

    await flush();

    expect(writer.storedEvents[0]?.userId).toBeNull();
  });

  it("rejects malformed beacons", async () => {
    const { handle } = ingest();

    expect((await handle(post("{}"))).status).toBe(400);
  });

  it("rejects cross-site beacons", async () => {
    const { handle } = ingest();

    expect(
      (await handle(post(JSON.stringify(beacon), { "sec-fetch-site": "cross-site" }))).status,
    ).toBe(403);
  });

  it("rejects oversized beacons", async () => {
    const { handle } = ingest();

    expect((await handle(post("x".repeat(60_001)))).status).toBe(413);
  });
});

describe("maintenanceRoute", () => {
  function route(secret: string | undefined) {
    const runs: string[] = [];
    const handle = maintenanceRoute({ secret, maintain: async () => void runs.push("run") });

    return { runs, handle };
  }

  const request = (authorization?: string) =>
    new Request("https://pienance.test/api/telemetry/maintain", {
      headers: authorization ? { authorization } : {},
    });

  it("runs the upkeep for the cron's bearer token", async () => {
    const { runs, handle } = route("s3cret");

    expect((await handle(request("Bearer s3cret"))).status).toBe(204);
    expect(runs).toEqual(["run"]);
  });

  it("refuses anyone else, and everyone when no secret is set", async () => {
    const guarded = route("s3cret");
    const open = route(undefined);

    expect((await guarded.handle(request("Bearer guess"))).status).toBe(401);
    expect((await open.handle(request("Bearer undefined"))).status).toBe(401);
    expect([...guarded.runs, ...open.runs]).toEqual([]);
  });
});
