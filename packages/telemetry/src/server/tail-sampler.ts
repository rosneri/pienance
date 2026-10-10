import { SpanStatusCode } from "@opentelemetry/api";
import { hrTimeToMilliseconds } from "@opentelemetry/core";
import type { ReadableSpan, SpanExporter, SpanProcessor } from "@opentelemetry/sdk-trace-node";

export interface TailSamplerOptions {
  readonly exporter: SpanExporter;
  /** Share of ordinary traces to keep, 0..1. Errors and slow traces are always kept. */
  readonly keepRatio: number;
  /** Traces at least this slow are always kept. */
  readonly slowMs: number;
  readonly random?: () => number;
  /**
   * Keeps the instance alive until an export finishes. On Vercel this is `waitUntil`, so
   * spans are written after the response is sent and before the function is frozen.
   */
  readonly defer?: (work: Promise<void>) => void;
  /** Traces buffered at once; the oldest are dropped beyond it. */
  readonly maxTraces?: number;
}

function isLocalRoot(span: ReadableSpan): boolean {
  return !span.parentSpanContext || span.parentSpanContext.isRemote === true;
}

/**
 * Decides per trace, once its local root span ends. A serverless request runs in one
 * process, so the whole server-side trace is here and the decision is exact: keep every trace
 * with an error, every slow one, and a random share of the rest. Then exports at once, because
 * a frozen function never runs a batch timer.
 */
export class TailSampler implements SpanProcessor {
  readonly #options: TailSamplerOptions;
  readonly #maxTraces: number;
  readonly #random: () => number;
  readonly #buffered = new Map<string, ReadableSpan[]>();
  /** Decisions already made, for spans that end after their root. */
  readonly #decided = new Map<string, boolean>();
  readonly #pending = new Set<Promise<void>>();

  constructor(options: TailSamplerOptions) {
    this.#options = options;
    this.#maxTraces = options.maxTraces ?? 1_000;
    this.#random = options.random ?? Math.random;
  }

  onStart(): void {}

  onEnd(span: ReadableSpan): void {
    const traceId = span.spanContext().traceId;
    const decision = this.#decided.get(traceId);

    if (decision !== undefined) {
      if (decision) this.#export([span]);

      return;
    }

    const spans = this.#buffered.get(traceId) ?? [];

    spans.push(span);
    this.#buffered.set(traceId, spans);
    this.#bound(this.#buffered);

    if (!isLocalRoot(span)) return;

    this.#buffered.delete(traceId);

    const keep = this.#keeps(spans, span);

    this.#decided.set(traceId, keep);
    this.#bound(this.#decided);

    if (keep) this.#export(spans);
  }

  async forceFlush(): Promise<void> {
    await Promise.all(this.#pending);
    await this.#options.exporter.forceFlush?.();
  }

  async shutdown(): Promise<void> {
    await this.forceFlush();
    await this.#options.exporter.shutdown();
  }

  #keeps(spans: readonly ReadableSpan[], root: ReadableSpan): boolean {
    return (
      spans.some((span) => span.status.code === SpanStatusCode.ERROR) ||
      hrTimeToMilliseconds(root.duration) >= this.#options.slowMs ||
      this.#random() < this.#options.keepRatio
    );
  }

  #export(spans: ReadableSpan[]): void {
    const exported = new Promise<void>((resolve) => {
      this.#options.exporter.export(spans, () => resolve());
    });

    this.#pending.add(exported);
    void exported.finally(() => this.#pending.delete(exported));
    this.#options.defer?.(exported);
  }

  #bound<T>(map: Map<string, T>): void {
    for (const key of map.keys()) {
      if (map.size <= this.#maxTraces) return;

      map.delete(key);
    }
  }
}
