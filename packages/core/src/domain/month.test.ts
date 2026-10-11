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

  it("steps to the next and previous month across the year", () => {
    const december = Month.of(new Date(Date.UTC(2026, 11, 5)));
    const january = Month.of(new Date(Date.UTC(2027, 0, 20)));

    expect(december.next().equals(january)).toBe(true);
    expect(january.previous().equals(december)).toBe(true);
    expect(january.isAfter(december)).toBe(true);
    expect(december.isAfter(january)).toBe(false);
    expect(december.isAfter(december)).toBe(false);
  });

  it("reads and writes the year-month form only", () => {
    expect(Month.parse("2026-09")?.toString()).toBe("2026-09");
    expect(Month.parse("2026-12")?.equals(Month.of(new Date(Date.UTC(2026, 11, 1))))).toBe(true);

    for (const junk of ["2026-9", "09-2026", "2026-13", "2026-00", "soon", "", "2026-09-01"]) {
      expect(Month.parse(junk)).toBeNull();
    }
  });

  it("knows how much of it is gone", () => {
    const november = Month.of(new Date(Date.UTC(2026, 10, 1)));

    expect(november.gone(new Date(Date.UTC(2026, 9, 31))).ratio).toBe(0);
    expect(november.gone(november.start).ratio).toBe(0);
    expect(november.gone(new Date(Date.UTC(2026, 10, 11))).ratio).toBeCloseTo(1 / 3);
    expect(november.gone(new Date(november.end.getTime() - 1)).ratio).toBeCloseTo(1, 6);
    expect(november.gone(november.end).ratio).toBe(1);
    expect(november.gone(new Date(Date.UTC(2027, 0, 1))).ratio).toBe(1);
  });

  it("counts February of a leap year as 29 days", () => {
    const february = Month.of(new Date(Date.UTC(2028, 1, 1)));

    expect(february.gone(new Date(Date.UTC(2028, 1, 15, 12))).ratio).toBe(0.5);
  });
});
