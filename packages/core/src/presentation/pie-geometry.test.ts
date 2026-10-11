import { describe, expect, it } from "vitest";
import { wedgePath } from "./pie-geometry";

describe("wedgePath", () => {
  it("draws a quarter from twelve to three o'clock", () => {
    expect(wedgePath(0, 0.25, 100)).toBe("M 100 100 L 100 0 A 100 100 0 0 1 200 100 Z");
  });

  it("uses the large arc past half a turn", () => {
    expect(wedgePath(0, 0.75, 100)).toBe("M 100 100 L 100 0 A 100 100 0 1 1 0 100 Z");
  });

  it("draws nothing for an empty wedge", () => {
    expect(wedgePath(0.5, 0.5, 100)).toBe("");
  });

  it("draws a full circle for a whole pie", () => {
    expect(wedgePath(0, 1, 100)).toContain("A 100 100 0 1 1 100 200");
  });
});
