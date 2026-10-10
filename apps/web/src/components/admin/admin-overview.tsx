import type {
  EventStats,
  RequestSummary,
  TelemetryOverview,
  VitalStats,
} from "@pienance/telemetry/server";
import { cn } from "@pienance/ui/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable } from "./data-table";
import {
  formatCount,
  formatDuration,
  formatShare,
  formatTime,
  formatVital,
  vitalVerdict,
  type VitalVerdict,
} from "./format";
import { adminWindows, type AdminWindow } from "./window";

function Section({
  id,
  title,
  className,
  children,
}: {
  id: string;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn("grid min-w-0 content-start gap-4", className)}>
      <h2 id={id} className="text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty() {
  return <p className="text-muted-foreground">Nothing in this window yet.</p>;
}

function WindowSwitch({ current }: { current: AdminWindow }) {
  return (
    <nav aria-label="Time window" className="flex gap-4 text-sm">
      {adminWindows.map((window) => (
        <Link
          key={window.id}
          href={`/admin?window=${window.id}`}
          aria-current={window.id === current.id ? "page" : undefined}
          className="whitespace-nowrap text-muted-foreground underline-offset-4 hover:text-foreground hover:underline aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:decoration-berry aria-[current=page]:decoration-2"
        >
          {window.label}
        </Link>
      ))}
    </nav>
  );
}

function Totals({ totals }: { totals: TelemetryOverview["totals"] }) {
  const figures = [
    ["Requests", totals.requests],
    ["Failed requests", totals.failedRequests],
    ["Sessions", totals.sessions],
    ["People", totals.people],
  ] as const;

  return (
    <dl className="grid grid-cols-2 border-t sm:grid-cols-4">
      {figures.map(([label, value]) => (
        <div key={label} className="grid gap-1 border-b py-4 pr-4">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="font-display text-3xl tabular-nums">{formatCount(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Requests worth a look, each linking to its trace. */
function RequestList({ label, requests }: { label: string; requests: readonly RequestSummary[] }) {
  if (requests.length === 0) return <Empty />;

  return (
    <ul className="grid" aria-label={label}>
      {requests.map((request) => (
        <li key={`${request.traceId}-${request.at.getTime()}`} className="grid gap-1 border-b py-3">
          <Link
            href={`/admin/traces/${request.traceId}`}
            className="truncate font-medium underline-offset-4 hover:underline"
          >
            {request.name}
          </Link>
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatTime(request.at)} · {formatDuration(request.durationMs)}
            {request.status ? ` · ${request.status}` : ""}
          </span>
          {request.message && (
            <span className="text-sm break-words text-berry">{request.message}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

const verdictTone: Record<VitalVerdict, string> = {
  good: "text-foreground",
  "needs work": "text-tight",
  poor: "text-berry",
};

function vitalRow(vital: VitalStats) {
  const verdict = vitalVerdict(vital.name, vital.p75);

  return {
    key: vital.name,
    cells: [
      vital.name,
      formatVital(vital.name, vital.p75),
      <span key="verdict" className={cn("whitespace-nowrap", verdictTone[verdict])}>
        {verdict}
      </span>,
      formatShare(vital.good, vital.samples),
      formatShare(vital.poor, vital.samples),
      formatCount(vital.samples),
    ],
  };
}

/** The product's steps, in the order a person takes them. */
const funnel = [
  { event: "pie.baked", label: "Baked a pie" },
  { event: "bite.weighed", label: "Weighed a bite" },
  { event: "bite.taken", label: "Took a bite" },
] as const;

function Funnel({ events }: { events: readonly EventStats[] }) {
  const steps = funnel.map((step) => ({
    ...step,
    people: events.find((event) => event.name === step.event)?.people ?? 0,
  }));

  const widest = Math.max(1, ...steps.map((step) => step.people));

  return (
    <ol className="grid gap-4">
      {steps.map((step) => (
        <li key={step.event} className="grid gap-1.5">
          <div className="flex justify-between gap-4 text-sm">
            <span>{step.label}</span>
            <span className="text-muted-foreground tabular-nums">
              {formatCount(step.people)} {step.people === 1 ? "person" : "people"}
            </span>
          </div>
          <div className="h-2 rounded-[4px] bg-plate" aria-hidden>
            <div
              className="h-full rounded-[4px] bg-crust-3"
              style={{ width: `${(step.people / widest) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Everything telemetry knows about the window, for the people running pienance. */
export function AdminOverview({
  overview,
  window,
}: {
  overview: TelemetryOverview;
  window: AdminWindow;
}) {
  return (
    <main className="grid gap-12 lg:gap-16">
      <section aria-labelledby="telemetry-heading" className="grid gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1
            id="telemetry-heading"
            className="text-[clamp(2.25rem,4vw+1.25rem,3.5rem)] leading-[1.08]"
          >
            Telemetry
          </h1>
          <WindowSwitch current={window} />
        </div>
        <Totals totals={overview.totals} />
      </section>

      <Section id="routes-heading" title="Requests by route">
        {overview.routes.length === 0 ? (
          <Empty />
        ) : (
          <DataTable
            label="Requests by route"
            columns={[
              { label: "Route" },
              { label: "Requests", numeric: true },
              { label: "Errors", numeric: true },
              { label: "Median", numeric: true },
              { label: "p95", numeric: true },
            ]}
            rows={overview.routes.map((route) => ({
              key: route.route,
              cells: [
                <code key="route" className="text-[0.95em]">
                  {route.route}
                </code>,
                formatCount(route.requests),
                <span key="errors" className={cn(route.errors > 0 && "text-berry")}>
                  {formatCount(route.errors)}
                </span>,
                formatDuration(route.p50Ms),
                formatDuration(route.p95Ms),
              ],
            }))}
          />
        )}
      </Section>

      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <Section id="failures-heading" title="Failed requests">
          <RequestList label="Failed requests" requests={overview.failures} />
        </Section>
        <Section id="slowest-heading" title="Slowest requests">
          <RequestList label="Slowest requests" requests={overview.slowest} />
        </Section>
      </div>

      <Section id="vitals-heading" title="Web vitals">
        {overview.vitals.length === 0 ? (
          <Empty />
        ) : (
          <DataTable
            label="Web vitals at the 75th percentile"
            columns={[
              { label: "Vital" },
              { label: "p75", numeric: true },
              { label: "Verdict", numeric: true },
              { label: "Good", numeric: true },
              { label: "Poor", numeric: true },
              { label: "Samples", numeric: true },
            ]}
            rows={overview.vitals.map(vitalRow)}
          />
        )}
      </Section>

      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <Section id="product-heading" title="Product">
          <Funnel events={overview.events} />
        </Section>
        <Section id="pages-heading" title="Pages and clicks">
          {overview.pages.length === 0 && overview.clicks.length === 0 ? (
            <Empty />
          ) : (
            <>
              <DataTable
                label="Most viewed pages"
                columns={[
                  { label: "Page" },
                  { label: "Views", numeric: true },
                  { label: "Sessions", numeric: true },
                ]}
                rows={overview.pages.map((page) => ({
                  key: page.path,
                  cells: [page.path, formatCount(page.views), formatCount(page.sessions)],
                }))}
              />
              <DataTable
                label="Most clicked"
                columns={[{ label: "Clicked" }, { label: "Clicks", numeric: true }]}
                rows={overview.clicks.map((click) => ({
                  key: click.target,
                  cells: [click.target, formatCount(click.clicks)],
                }))}
              />
            </>
          )}
        </Section>
      </div>
    </main>
  );
}
