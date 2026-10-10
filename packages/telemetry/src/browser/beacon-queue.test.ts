import { describe, expect, it } from "vitest";
import type { BeaconItem } from "../contract";
import { BeaconQueue, type Send } from "./beacon-queue";

const identity = () => ({
  sessionId: "4f9c1f0e-5d5a-4c1e-9a77-0d1c2b3a4f5e",
  anonymousId: "0b8e2a6c-1f3d-4e5a-8b7c-9d0e1f2a3b4c",
});

function pageview(n: number): BeaconItem {
  return {
    type: "event",
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    name: "$pageview",
    at: n,
    path: "/",
    properties: {},
  };
}

/** A clock the test advances by hand. */
function manualTimers() {
  const pending: Array<{ run: () => void; at: number }> = [];
  let now = 0;

  return {
    schedule: (run: () => void, ms: number) => {
      const timer = { run, at: now + ms };

      pending.push(timer);

      return () => pending.splice(pending.indexOf(timer), 1);
    },
    advance(ms: number) {
      now += ms;

      for (const timer of pending.filter((each) => each.at <= now)) {
        pending.splice(pending.indexOf(timer), 1);
        timer.run();
      }
    },
  };
}

function recorder(accept: boolean) {
  const sent: Array<{ items: number; unloading: boolean }> = [];

  const send: Send = (body, unloading) => {
    sent.push({ items: JSON.parse(body).items.length, unloading });

    return accept;
  };

  return { sent, send };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("BeaconQueue", () => {
  it("sends a full batch at once", () => {
    const { sent, send } = recorder(true);

    const queue = new BeaconQueue({
      send,
      identity,
      schedule: manualTimers().schedule,
      batchSize: 3,
    });

    [1, 2, 3].forEach((n) => queue.push(pageview(n)));

    expect(sent).toEqual([{ items: 3, unloading: false }]);
  });

  it("sends a partial batch after the wait", () => {
    const { sent, send } = recorder(true);
    const timers = manualTimers();
    const queue = new BeaconQueue({ send, identity, schedule: timers.schedule, waitMs: 5_000 });

    queue.push(pageview(1));
    timers.advance(4_999);
    expect(sent).toEqual([]);

    timers.advance(1);
    expect(sent).toEqual([{ items: 1, unloading: false }]);
  });

  it("flushes everything for an unloading page, in batches", () => {
    const { sent, send } = recorder(true);

    const queue = new BeaconQueue({
      send,
      identity,
      schedule: manualTimers().schedule,
      batchSize: 2,
    });

    queue.push(pageview(1));
    queue.flush(true);

    expect(sent).toEqual([{ items: 1, unloading: true }]);
    expect(queue.size).toBe(0);
  });

  it("keeps a rejected batch for the next flush", async () => {
    const { send } = recorder(false);
    const queue = new BeaconQueue({ send, identity, schedule: manualTimers().schedule });

    queue.push(pageview(1));
    queue.flush(false);
    await settle();

    expect(queue.size).toBe(1);
  });

  it("keeps a batch whose sender throws or rejects", async () => {
    const throwing = new BeaconQueue({
      send: () => {
        throw new Error("offline");
      },
      identity,
      schedule: manualTimers().schedule,
    });

    const rejecting = new BeaconQueue({
      send: () => Promise.reject(new Error("offline")),
      identity,
      schedule: manualTimers().schedule,
    });

    throwing.push(pageview(1));
    throwing.flush(false);
    rejecting.push(pageview(1));
    rejecting.flush(false);
    await settle();

    expect([throwing.size, rejecting.size]).toEqual([1, 1]);
  });

  it("drops the oldest items beyond what it may buffer", () => {
    const { send } = recorder(false);

    const queue = new BeaconQueue({
      send,
      identity,
      schedule: manualTimers().schedule,
      batchSize: 100,
      maxBuffered: 3,
    });

    [1, 2, 3, 4, 5].forEach((n) => queue.push(pageview(n)));

    expect(queue.size).toBe(3);
  });
});
