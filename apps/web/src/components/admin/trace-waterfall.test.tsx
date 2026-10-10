import type { TraceSpan } from "@pienance/telemetry/server";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { placeSpans, TraceWaterfall } from "./trace-waterfall";

const start = new Date("2026-10-10T07:42:00.000Z").getTime();

function span(
  spanId: string,
  parentSpanId: string | null,
  offsetMs: number,
  durationMs: number,
  failed = false,
): TraceSpan {
  return {
    spanId,
    parentSpanId,
    name: `span ${spanId}`,
    kind: 0,
    startTime: new Date(start + offsetMs),
    durationMs,
    failed,
    message: failed ? "boom" : null,
    route: null,
    status: null,
  };
}

const spans = [
  span("root", null, 0, 100),
  span("late", "root", 60, 40, true),
  span("early", "root", 10, 20),
  span("child", "early", 15, 5),
];

describe("placeSpans", () => {
  it("orders spans as a tree and places them on the timeline", () => {
    expect(
      placeSpans([...spans].sort((a, b) => a.startTime.getTime() - b.startTime.getTime())).map(
        ({ span: each, depth, offset, width }) => [each.spanId, depth, offset, width],
      ),
    ).toEqual([
      ["root", 0, 0, 1],
      ["early", 1, 0.1, 0.2],
      ["child", 2, 0.15, 0.05],
      ["late", 1, 0.6, 0.4],
    ]);
  });

  it("treats spans whose parent was not stored as roots", () => {
    expect(placeSpans([span("orphan", "missing", 0, 10)])[0]?.depth).toBe(0);
  });
});

describe("TraceWaterfall", () => {
  it("names failed spans in words", () => {
    render(<TraceWaterfall spans={spans} />);

    expect(screen.getByText("Failed: boom")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });
});
