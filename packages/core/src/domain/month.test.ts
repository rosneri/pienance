import { describe, expect, it } from "vitest";
import { Month } from "./month";

describe("Month", () => {
  const october = Month.of(new Date(Date.UTC(2026, 9, 10, 15)));

  it("spans the calendar month in UTC", () => {
    expect(october.start.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(october.end.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("contains its first instant but not the next month's", () => {
    expect(october.contains(new Date(Date.UTC(2026, 9, 1)))).toBe(true);
    expect(october.contains(new Date(Date.UTC(2026, 10, 1)))).toBe(false);
    expect(october.contains(new Date(Date.UTC(2026, 8, 30, 23, 59)))).toBe(false);
  });

  it("rolls over the year", () => {
    expect(Month.of(new Date(Date.UTC(2026, 11, 31))).end.toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });
});
