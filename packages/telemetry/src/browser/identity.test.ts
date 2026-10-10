import { describe, expect, it } from "vitest";
import { IdentityKeeper, type KeyValueStore } from "./identity";

function memoryStore(): KeyValueStore {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

function counter() {
  let n = 0;

  return () => `id-${++n}`;
}

const minute = 60_000;

describe("IdentityKeeper", () => {
  it("keeps the session while the visitor is active", () => {
    const keeper = new IdentityKeeper(memoryStore(), memoryStore(), counter());

    expect(keeper.at(0)).toEqual(keeper.at(29 * minute));
  });

  it("starts a new session after 30 idle minutes, keeping the anonymous id", () => {
    const keeper = new IdentityKeeper(memoryStore(), memoryStore(), counter());
    const before = keeper.at(0);
    const after = keeper.at(30 * minute);

    expect(after.sessionId).not.toBe(before.sessionId);
    expect(after.anonymousId).toBe(before.anonymousId);
  });

  it("restores both ids from storage across page loads", () => {
    const session = memoryStore();
    const local = memoryStore();
    const first = new IdentityKeeper(session, local, counter()).at(0);
    const second = new IdentityKeeper(session, local, () => "new").at(minute);

    expect(second).toEqual(first);
  });

  it("works without storage", () => {
    const blocked: KeyValueStore = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    };

    const keeper = new IdentityKeeper(blocked, null, counter());

    expect(keeper.at(0)).toEqual({ sessionId: "id-2", anonymousId: "id-1" });
  });
});
