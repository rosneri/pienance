import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDuration, formatTime } from "@/components/admin/format";
import { TraceWaterfall } from "@/components/admin/trace-waterfall";
import { telemetryReader } from "@/pienance";

export const dynamic = "force-dynamic";

export default async function TracePage({ params }: { params: Promise<{ traceId: string }> }) {
  const { traceId } = await params;
  const spans = (await telemetryReader()?.trace(traceId)) ?? [];
  const root = spans.find((span) => span.parentSpanId === null) ?? spans[0];

  if (!root) notFound();

  const failed = spans.filter((span) => span.failed).length;

  return (
    <main className="grid gap-8">
      <section aria-labelledby="trace-heading" className="grid gap-3">
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          Back to telemetry
        </Link>
        <h1
          id="trace-heading"
          className="text-[clamp(2rem,3vw+1.25rem,3rem)] leading-[1.1] [overflow-wrap:anywhere]"
        >
          {root.name}
        </h1>
        <p className="text-sm text-muted-foreground tabular-nums">
          {formatTime(root.startTime)} · {formatDuration(root.durationMs)} · {spans.length} spans
          {failed > 0 && <span className="text-berry"> · {failed} failed</span>}
        </p>
        <code className="text-xs break-all text-muted-foreground">{traceId}</code>
      </section>
      <TraceWaterfall spans={spans} />
    </main>
  );
}
