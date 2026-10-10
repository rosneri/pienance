import { describe, expect, it } from "vitest";
import { abilityFor, roleOf } from "./access";

describe("abilityFor", () => {
  it("lets admins read telemetry", () => {
    expect(abilityFor({ id: "u1", role: "admin" }).can("read", "Telemetry")).toBe(true);
  });

  it("keeps telemetry from members and anonymous visitors", () => {
    expect(abilityFor({ id: "u2", role: "member" }).can("read", "Telemetry")).toBe(false);
    expect(abilityFor(null).can("read", "Telemetry")).toBe(false);
  });
});

describe("roleOf", () => {
  it("reads known roles", () => {
    expect(roleOf("admin")).toBe("admin");
  });

  it("treats anything unknown as the least privileged role", () => {
    expect(roleOf("root")).toBe("member");
    expect(roleOf(undefined)).toBe("member");
  });
});
