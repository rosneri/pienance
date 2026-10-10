import { describe, expect, it } from "vitest";
import { maxBeaconItems, parseBeacon } from "./beacon";

const ids = {
  sessionId: "4f9c1f0e-5d5a-4c1e-9a77-0d1c2b3a4f5e",
  anonymousId: "0b8e2a6c-1f3d-4e5a-8b7c-9d0e1f2a3b4c",
};

const pageview = {
  type: "event",
  id: "a3c1e5f7-2b4d-4f6a-8c0e-1d3f5a7b9c2e",
  name: "$pageview",
  at: 1_791_000_000_000,
  path: "/",
};

const lcp = {
  type: "vital",
  id: "v5-1791000000000-123",
  name: "LCP",
  value: 1234.5,
  rating: "good",
  at: 1_791_000_000_000,
  path: "/",
};

function body(items: readonly object[]): string {
  return JSON.stringify({ ...ids, items });
}

describe("parseBeacon", () => {
  it("accepts events and vitals", () => {
    const beacon = parseBeacon(body([pageview, lcp]));

    expect(beacon?.items).toHaveLength(2);
    expect(beacon?.items[0]).toMatchObject({ name: "$pageview", properties: {} });
  });

  it("rejects malformed JSON", () => {
    expect(parseBeacon("{")).toBeNull();
  });

  it("rejects unknown event names", () => {
    expect(parseBeacon(body([{ ...pageview, name: "$scroll" }]))).toBeNull();
  });

  it("rejects paths with query strings, which may carry personal data", () => {
    expect(parseBeacon(body([{ ...pageview, path: "/?email=a@b.c" }]))).toBeNull();
  });

  it("rejects too many properties", () => {
    const properties = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`k${i}`, i]));

    expect(parseBeacon(body([{ ...pageview, properties }]))).toBeNull();
  });

  it("rejects nested property values", () => {
    expect(parseBeacon(body([{ ...pageview, properties: { a: { b: 1 } } }]))).toBeNull();
  });

  it("rejects empty and oversized batches", () => {
    expect(parseBeacon(body([]))).toBeNull();
    expect(
      parseBeacon(body(Array.from({ length: maxBeaconItems + 1 }, () => pageview))),
    ).toBeNull();
  });

  it("drops keys it does not know", () => {
    const beacon = parseBeacon(body([{ ...pageview, userId: "someone-else" }]));

    expect(beacon?.items[0]).not.toHaveProperty("userId");
  });
});
