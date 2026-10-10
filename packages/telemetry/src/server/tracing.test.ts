import { context, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-node";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TailSampler } from "./tail-sampler";
import { traced } from "./tracing";
import { InMemoryTelemetryWriter } from "./writer";
import { WriterSpanExporter } from "./writer-span-exporter";

const contextManager = new AsyncLocalStorageContextManager();

beforeEach(() => {
  context.setGlobalContextManager(contextManager.enable());
});

afterEach(() => {
  context.disable();
});

function pipeline(keepRatio: number) {
  const writer = new InMemoryTelemetryWriter();
  const deferred: Promise<void>[] = [];

  const sampler = new TailSampler({
    exporter: new WriterSpanExporter(writer),
    keepRatio,
    slowMs: 1_000,
    random: () => 0.5,
    defer: (work) => void deferred.push(work),
  });

  const provider = new BasicTracerProvider({
    resource: resourceFromAttributes({ "service.name": "test", "deployment.id": "d1" }),
    spanProcessors: [sampler],
  });

  return { writer, deferred, sampler, tracer: provider.getTracer("test") };
}

/** A request: a server root span with one child, lasting `ms`. */
function request(
  tracer: ReturnType<typeof pipeline>["tracer"],
  ms: number,
  failChild = false,
): void {
  const start = 1_791_000_000_000;

  const root = tracer.startSpan("GET /", {
    kind: SpanKind.SERVER,
    startTime: start,
    attributes: { "http.route": "/", "http.method": "GET", "http.status_code": 200 },
  });

  const child = tracer.startSpan(
    "prisma:query",
    { startTime: start + 1 },
    trace.setSpan(context.active(), root),
  );

  if (failChild) child.setStatus({ code: SpanStatusCode.ERROR, message: "boom" });

  child.end(start + 2);
  root.end(start + ms);
}

describe("TailSampler", () => {
  it("exports a kept trace when its root ends, through defer", async () => {
    const { writer, deferred, tracer } = pipeline(1);

    request(tracer, 20);
    await Promise.all(deferred);

    expect(deferred).toHaveLength(1);
    expect(writer.storedSpans.map((span) => span.name)).toEqual(["prisma:query", "GET /"]);
  });

  it("maps spans to rows with promoted attributes", async () => {
    const { writer, sampler, tracer } = pipeline(1);

    request(tracer, 20);
    await sampler.forceFlush();

    const [child, root] = writer.storedSpans;

    expect(root).toMatchObject({
      kind: SpanKind.SERVER,
      service: "test",
      deployment: "d1",
      httpRoute: "/",
      httpMethod: "GET",
      httpStatus: 200,
      durationUs: 20_000,
      parentSpanId: null,
    });
    expect(child?.parentSpanId).toBe(root?.spanId);
    expect(child?.traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it("drops ordinary traces outside the kept share", async () => {
    const { writer, sampler, tracer } = pipeline(0.1);

    request(tracer, 20);
    await sampler.forceFlush();

    expect(writer.storedSpans).toEqual([]);
  });

  it("always keeps traces with an error and slow traces", async () => {
    const { writer, sampler, tracer } = pipeline(0);

    request(tracer, 20, true);
    request(tracer, 1_500);
    await sampler.forceFlush();

    expect(writer.storedSpans).toHaveLength(4);
  });

  it("exports spans that end after their kept root", async () => {
    const { writer, sampler, tracer } = pipeline(1);
    const root = tracer.startSpan("GET /", { kind: SpanKind.SERVER });
    const late = tracer.startSpan("after", {}, trace.setSpan(context.active(), root));

    root.end();
    late.end();
    await sampler.forceFlush();

    expect(writer.storedSpans.map((span) => span.name)).toEqual(["GET /", "after"]);
  });
});

describe("traced", () => {
  it("wraps a use case in a span and records its error", async () => {
    const { writer, sampler, tracer } = pipeline(0);

    const failing = traced(
      "pienance.weighBite",
      async (message: string) => {
        throw new Error(message);
      },
      tracer,
    );

    await expect(failing("Bake a pie first")).rejects.toThrow("Bake a pie first");
    await sampler.forceFlush();

    expect(writer.storedSpans[0]).toMatchObject({
      name: "pienance.weighBite",
      statusCode: SpanStatusCode.ERROR,
      statusMessage: "Bake a pie first",
    });
    expect(writer.storedSpans[0]?.events?.[0]?.name).toBe("exception");
  });

  it("returns the use case's result", async () => {
    const { tracer } = pipeline(1);

    await expect(traced("double", async (n: number) => n * 2, tracer)(21)).resolves.toBe(42);
  });
});
