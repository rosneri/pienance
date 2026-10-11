import { describe, expect, it } from "vitest";
import {
  firstLines,
  largestStatement,
  lineCount,
  linesThatFit,
  mostLines,
  withinLimits,
} from "./lines";

const statement = (lines: number, width = 20) =>
  Array.from({ length: lines }, (_, index) => `${index}`.padEnd(width, "x")).join("\r\n");

describe("statement lines", () => {
  it("lets a statement within the limits through whole", () => {
    expect(linesThatFit(statement(mostLines))).toBeNull();
    expect(linesThatFit(`${statement(3)}\n`)).toBeNull();
  });

  it("fits the first lines of a statement with too many", () => {
    const text = statement(mostLines + 500);

    expect(linesThatFit(text)).toBe(mostLines);
    expect(lineCount(text)).toBe(mostLines + 500);
  });

  it("fits the first lines of a statement too long to send", () => {
    const width = Math.ceil(largestStatement / 100);
    const text = statement(150, width);
    const fit = linesThatFit(text) ?? 0;

    expect(fit).toBe(99);
    expect(firstLines(text, fit).length).toBeLessThanOrEqual(largestStatement);
  });

  it("fits nothing when even the first line is too long", () => {
    expect(linesThatFit("x".repeat(largestStatement + 1))).toBe(0);
  });

  it("keeps the first lines, without a final line break", () => {
    expect(firstLines("a\r\nb\nc\n", 2)).toBe("a\nb");
  });

  it("cuts a statement over the limits to its first lines, saying how many it kept", () => {
    expect(withinLimits("a\nb")).toEqual({ text: "a\nb", trimmed: null });
    expect(withinLimits(statement(mostLines + 1))).toEqual({
      text: firstLines(statement(mostLines + 1), mostLines),
      trimmed: { kept: mostLines, total: mostLines + 1 },
    });
    expect(withinLimits("x".repeat(largestStatement + 1))).toBeNull();
  });
});
