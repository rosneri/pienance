import { describe, expect, it } from "vitest";
import type { Beacon } from "../contract";
import { beaconRows, deviceOf, productEventRow } from "./ingest";

const received = {
  at: new Date("2026-10-10T12:00:00Z"),
  userId: "owner-1",
  deployment: "dpl_1",
  device: "mobile",
  country: "NL",
};

const beacon: Beacon = {
  sessionId: "4f9c1f0e-5d5a-4c1e-9a77-0d1c2b3a4f5e",
  anonymousId: "0b8e2a6c-1f3d-4e5a-8b7c-9d0e1f2a3b4c",
  items: [
    {
      type: "event",
      id: "a3c1e5f7-2b4d-4f6a-8c0e-1d3f5a7b9c2e",
      name: "$pageview",
      at: received.at.getTime() - 1_000,
      path: "/",
      properties: {},
    },
    { type: "vital", id: "v1", name: "INP", value: 96, at: 0, path: "/" },
  ],
};

describe("beaconRows", () => {
  it("stamps rows with what the server knows", () => {
    const { events, vitals } = beaconRows(beacon, received);

    expect(events[0]).toMatchObject({
      time: received.at,
      clientTime: new Date(received.at.getTime() - 1_000),
      source: "browser",
      userId: "owner-1",
      country: "NL",
    });
    expect(vitals[0]).toMatchObject({ name: "INP", route: "/", rating: null, userId: "owner-1" });
  });

  it("does not trust a client clock that is far off", () => {
    expect(beaconRows(beacon, received).vitals[0]?.clientTime).toBeNull();
  });
});

describe("productEventRow", () => {
  it("records a server event with its owner and trace", () => {
    const row = productEventRow(
      { name: "bite.weighed", properties: { verdict: "tight" } },
      { id: "e1", at: received.at, userId: "owner-1", traceId: "ab", deployment: null },
    );

    expect(row).toMatchObject({
      name: "bite.weighed",
      source: "server",
      properties: { verdict: "tight" },
      traceId: "ab",
    });
  });
});

describe("deviceOf", () => {
  it.each([
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", "mobile"],
    ["Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile Safari", "mobile"],
    ["Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)", "tablet"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)", "desktop"],
    [null, null],
  ])("%s is %s", (userAgent, device) => {
    expect(deviceOf(userAgent)).toBe(device);
  });
});
