import { describe, expect, it } from "vitest";
import { paceOf } from "./pace";
import type { Serving } from "./pie";
import { Proportion } from "./proportion";

const serving = (eaten: number, stapled = 0): Serving => ({
  slice: { id: "wants", name: "Wants", share: Proportion.of(1) },
  retired: false,
  eaten: Proportion.of(eaten),
  left: Proportion.of(eaten).complement(),
  stapled: Proportion.of(stapled),
});

const third = Proportion.of(0.3);

describe("paceOf", () => {
  it("is steady within a tenth of the month, either way", () => {
    expect(paceOf(serving(0.4), third)).toBe("steady");
    expect(paceOf(serving(0.2), third)).toBe("steady");
    expect(paceOf(serving(0.3), third)).toBe("steady");
  });

  it("is fast just above the band and slow just below it", () => {
    expect(paceOf(serving(0.41), third)).toBe("fast");
    expect(paceOf(serving(0.19), third)).toBe("slow");
  });

  it("is always fast once a slice overflowed", () => {
    expect(paceOf(serving(1), Proportion.whole)).toBe("fast");
    expect(paceOf(serving(1.4), Proportion.of(0.95))).toBe("fast");
  });

  it("leaves an untouched slice steady early on, then slow", () => {
    expect(paceOf(serving(0), Proportion.of(0.05))).toBe("steady");
    expect(paceOf(serving(0), Proportion.of(0.2))).toBe("slow");
  });

  it("compares only the part of the slice staples leave free", () => {
    // Rent takes half from day one; a fifth of the rest is eaten a fifth into the month.
    expect(paceOf(serving(0.6, 0.5), Proportion.of(0.2))).toBe("steady");
    expect(paceOf(serving(0.5, 0.5), Proportion.of(0.02))).toBe("steady");
    expect(paceOf(serving(0.9, 0.5), Proportion.of(0.2))).toBe("fast");
  });

  it("calls a slice its staples fill fast only when anything else was eaten", () => {
    expect(paceOf(serving(1, 1), Proportion.of(0.5))).toBe("steady");
    expect(paceOf(serving(1.1, 1), Proportion.of(0.5))).toBe("fast");
  });
});
