import type { TelemetryOverview } from "@pienance/telemetry/server";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminOverview } from "./admin-overview";
import { adminWindowOf } from "./window";

const at = new Date("2026-10-10T07:42:00Z");

const overview: TelemetryOverview = {
  totals: { requests: 1_204, failedRequests: 3, sessions: 88, people: 41 },
  routes: [{ route: "/", requests: 900, errors: 2, p50Ms: 84, p95Ms: 1_240 }],
  vitals: [
    { name: "LCP", samples: 40, p75: 2_100, good: 34, poor: 2 },
    { name: "INP", samples: 40, p75: 640, good: 10, poor: 20 },
  ],
  events: [
    { name: "pie.baked", source: "server", count: 12, people: 10 },
    { name: "bite.weighed", source: "server", count: 30, people: 6 },
  ],
  pages: [{ path: "/sign-in", views: 50, sessions: 30 }],
  clicks: [{ target: "weigh", clicks: 25 }],
  failures: [
    {
      traceId: "1bf7651916cd43dd8448eb211c80319d",
      at,
      name: "POST /",
      route: "/",
      status: 500,
      durationMs: 320,
      message: "connection refused",
    },
  ],
  slowest: [],
};

function renderOverview(data: TelemetryOverview = overview) {
  render(<AdminOverview overview={data} window={adminWindowOf("7d")} />);
}

describe("AdminOverview", () => {
  it("shows the totals", () => {
    renderOverview();

    expect(screen.getByText("1,204")).toBeInTheDocument();
    expect(screen.getByText("Failed requests", { selector: "dt" })).toBeInTheDocument();
  });

  it("marks the current window", () => {
    renderOverview();

    expect(screen.getByRole("link", { name: "Week" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Day" })).toHaveAttribute("href", "/admin?window=1d");
  });

  it("lists routes with their latency", () => {
    renderOverview();

    const table = screen.getByRole("table", { name: "Requests by route" });

    expect(within(table).getByText("84 ms")).toBeInTheDocument();
    expect(within(table).getByText("1.2 s")).toBeInTheDocument();
  });

  it("links failed requests to their trace, with the error", () => {
    renderOverview();

    const failures = screen.getByRole("list", { name: "Failed requests" });

    expect(within(failures).getByRole("link", { name: "POST /" })).toHaveAttribute(
      "href",
      "/admin/traces/1bf7651916cd43dd8448eb211c80319d",
    );
    expect(within(failures).getByText("connection refused")).toBeInTheDocument();
  });

  it("judges web vitals in words, not only colour", () => {
    renderOverview();

    const vitals = screen.getByRole("table", { name: "Web vitals at the 75th percentile" });

    expect(within(vitals).getByText("good")).toBeInTheDocument();
    expect(within(vitals).getByText("poor")).toBeInTheDocument();
  });

  it("shows the product funnel by people", () => {
    renderOverview();

    expect(screen.getByText("10 people")).toBeInTheDocument();
    expect(screen.getByText("Took a bite").nextElementSibling).toHaveTextContent("0 people");
  });

  it("says so when a section is empty", () => {
    renderOverview({ ...overview, routes: [], vitals: [], pages: [], clicks: [] });

    expect(screen.getAllByText("Nothing in this window yet.")).toHaveLength(4);
  });
});
