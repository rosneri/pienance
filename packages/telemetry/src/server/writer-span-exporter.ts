import { context } from "@opentelemetry/api";
import { ExportResultCode, suppressTracing, type ExportResult } from "@opentelemetry/core";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-node";
import { spanRow } from "./span-row";
import type { TelemetryWriter } from "./writer";

/**
 * Exports spans straight to a TelemetryWriter (Postgres in production): no collector. Swap it
 * for an OTLP exporter to send the same spans to any OpenTelemetry backend.
 */
export class WriterSpanExporter implements SpanExporter {
  readonly #writer: TelemetryWriter;
  readonly #pending = new Set<Promise<void>>();

  constructor(writer: TelemetryWriter) {
    this.#writer = writer;
  }

  export(spans: ReadableSpan[], done: (result: ExportResult) => void): void {
    const rows = spans.map(spanRow);
    // Saving spans must not create spans about saving spans.
    const write = context.with(suppressTracing(context.active()), () => this.#writer.spans(rows));

    const settled = write.then(
      () => done({ code: ExportResultCode.SUCCESS }),
      (error: Error) => done({ code: ExportResultCode.FAILED, error }),
    );

    this.#pending.add(settled);
    void settled.finally(() => this.#pending.delete(settled));
  }

  async forceFlush(): Promise<void> {
    await Promise.all(this.#pending);
  }

  async shutdown(): Promise<void> {
    await this.forceFlush();
  }
}
