import { mostBites } from "@pienance/core";

/** The largest statement accepted, in characters: years of a busy account. */
export const largestStatement = 2_000_000;

/** Lines read from one statement: a header and preamble, plus at most one bite per line. */
export const mostLines = mostBites;

function linesOf(text: string): string[] {
  const lines = text.split(/\r?\n/);

  return lines.at(-1) === "" ? lines.slice(0, -1) : lines;
}

/** How many lines a statement has, ignoring a final line break. */
export function lineCount(text: string): number {
  return linesOf(text).length;
}

/**
 * How many lines from the top of a statement fit within the limits, or null when all of it does.
 * A quoted value spanning lines may be cut; its row is then simply unreadable.
 */
export function linesThatFit(text: string): number | null {
  const lines = linesOf(text);

  if (text.length <= largestStatement && lines.length <= mostLines) return null;

  let length = 0;
  let count = 0;

  for (const line of lines.slice(0, mostLines)) {
    length += line.length + 1;

    if (length > largestStatement) break;

    count += 1;
  }

  return count;
}

/** The first `count` lines of a statement. */
export function firstLines(text: string, count: number): string {
  return linesOf(text).slice(0, count).join("\n");
}
