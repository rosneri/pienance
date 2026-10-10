import { SpanStatusCode, trace, type Tracer } from "@opentelemetry/api";
import { registerInstrumentations, type Instrumentation } from "@opentelemetry/instrumentation";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeTracerProvider, type SpanProcessor } from "@opentelemetry/sdk-trace-node";

export interface TracingSettings {
  readonly service: string;
  readonly deployment: string;
  readonly processor: SpanProcessor;
  readonly instrumentations: Instrumentation[];
}

/** Registers the global tracer provider; Next.js and the instrumentations then report to it. */
export function startTracing(settings: TracingSettings): NodeTracerProvider {
  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      "service.name": settings.service,
      "deployment.id": settings.deployment,
    }),
    spanProcessors: [settings.processor],
  });

  provider.register();
  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: settings.instrumentations,
  });

  return provider;
}

/** Runs `run` in a span named `name`, recording a thrown error on it. */
export function traced<I, O>(
  name: string,
  run: (input: I) => Promise<O>,
  tracer: Tracer = trace.getTracer("pienance"),
): (input: I) => Promise<O> {
  return (input) =>
    tracer.startActiveSpan(name, async (span) => {
      try {
        return await run(input);
      } catch (error) {
        recordError(error, span);
        throw error;
      } finally {
        span.end();
      }
    });
}

/** Marks a span (the active one by default) as failed with `cause`. */
export function recordError(cause: unknown, span = trace.getActiveSpan()): void {
  if (!span) return;

  const error = cause instanceof Error ? cause : new Error(String(cause));

  span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
}
