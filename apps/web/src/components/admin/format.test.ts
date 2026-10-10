import { describe, expect, it } from "vitest";
import { formatDuration, formatShare, formatTime, formatVital, vitalVerdict } from "./format";

describe("admin formatting", () => {
  it("formats durations in ms or seconds", () => {
    expect(formatDuration(84.4)).toBe("84 ms");
    expect(formatDuration(1_240)).toBe("1.2 s");
  });

  it("formats shares, with a dash for nothing", () => {
    expect(formatShare(1, 3)).toBe("33%");
    expect(formatShare(0, 0)).toBe("—");
  });

  it("formats vitals in their unit", () => {
    expect(formatVital("CLS", 0.0512)).toBe("0.05");
    expect(formatVital("LCP", 2_310)).toBe("2.3 s");
  });

  it("judges vitals at web.dev's thresholds", () => {
    expect(vitalVerdict("LCP", 2_500)).toBe("good");
    expect(vitalVerdict("INP", 350)).toBe("needs work");
    expect(vitalVerdict("CLS", 0.3)).toBe("poor");
  });

  it("shows times in UTC", () => {
    expect(formatTime(new Date("2026-10-10T07:42:00Z"))).toBe("Oct 10, 07:42 UTC");
  });
});
