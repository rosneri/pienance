import type { TraceSpan } from "@pienance/telemetry/server";
import { cn } from "@pienance/ui/lib/utils";
import { formatDuration } from "./format";

interface PlacedSpan {
  readonly span: TraceSpan;
  readonly depth: number;
  /** Where the bar starts and how wide it is, as shares of the whole trace. */
  readonly offset: number;
  readonly width: number;
}

/** Spans in tree order (each followed by its children), placed on the trace's timeline. */
export function placeSpans(spans: readonly TraceSpan[]): PlacedSpan[] {
  if (spans.length === 0) return [];

  const start = Math.min(...spans.map((span) => span.startTime.getTime()));
  const end = Math.max(...spans.map((span) => span.startTime.getTime() + span.durationMs));
  const total = Math.max(end - start, 1);
  const ids = new Set(spans.map((span) => span.spanId));

  const children = Map.groupBy(spans, (span) =>
    span.parentSpanId && ids.has(span.parentSpanId) ? span.parentSpanId : null,
  );

  const placed: PlacedSpan[] = [];

  const visit = (parent: string | null, depth: number): void => {
    for (const span of children.get(parent) ?? []) {
      placed.push({
        span,
        depth,
        offset: (span.startTime.getTime() - start) / total,
        width: span.durationMs / total,
      });
      visit(span.spanId, depth + 1);
    }
  };

  visit(null, 0);

  return placed;
}

/** Each span as a bar on the trace's timeline: where time went, and what failed. */
export function TraceWaterfall({ spans }: { spans: readonly TraceSpan[] }) {
  return (
    <ol className="grid" aria-label="Spans, in order">
      {placeSpans(spans).map(({ span, depth, offset, width }) => (
        <li
          key={span.spanId}
          className="grid gap-1.5 border-b py-2.5 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_5rem] sm:items-center sm:gap-4"
        >
          <div
            className="grid min-w-0 gap-0.5"
            style={{ paddingInlineStart: `${Math.min(depth, 8) * 0.75}rem` }}
          >
            <span className="truncate text-sm" title={span.name}>
              {span.name}
            </span>
            {span.failed && (
              <span className="text-sm break-words text-berry">
                Failed{span.message ? `: ${span.message}` : ""}
              </span>
            )}
          </div>
          <div className="relative h-2 rounded-[4px] bg-plate" aria-hidden>
            <div
              className={cn(
                "absolute inset-y-0 min-w-0.5 rounded-[4px]",
                span.failed ? "bg-berry" : "bg-crust-3",
              )}
              style={{ left: `${offset * 100}%`, width: `${width * 100}%` }}
            />
          </div>
          <span className="text-sm text-muted-foreground tabular-nums sm:text-end">
            {formatDuration(span.durationMs)}
          </span>
        </li>
      ))}
    </ol>
  );
}
