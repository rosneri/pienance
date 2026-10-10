import { afterEach, describe, expect, it } from "vitest";
import { parseBeacon, type Beacon } from "../contract";
import { startBrowserTelemetry } from "./browser-telemetry";

let stop = (): void => undefined;

afterEach(() => {
  stop();
  document.body.innerHTML = "";
});

function started() {
  const beacons: Array<{ beacon: Beacon | null; unloading: boolean }> = [];

  const page = startBrowserTelemetry(window, (body, unloading) => {
    beacons.push({ beacon: parseBeacon(body), unloading });

    return true;
  });

  stop = page.stop;

  return { ...page, beacons };
}

function hide(): void {
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("startBrowserTelemetry", () => {
  it("sends valid beacons with pageviews and vitals when the page is hidden", () => {
    const { telemetry, beacons } = started();

    telemetry.pageview("/sign-in?next=%2F", "https://example.com/search?q=salary");
    telemetry.vital({ id: "v1", name: "LCP", value: 812, rating: "good" }, "/sign-in");
    hide();

    expect(beacons).toHaveLength(1);
    expect(beacons[0]?.unloading).toBe(true);
    expect(beacons[0]?.beacon?.items.map((item) => item.name)).toEqual([
      "$pageview",
      "LCP",
      "$leave",
    ]);
    expect(beacons[0]?.beacon?.items[0]).toMatchObject({
      path: "/sign-in",
      referrer: "https://example.com",
    });
  });

  it("records clicks on elements marked with data-track, by name only", () => {
    const { telemetry, beacons } = started();

    document.body.innerHTML = `<button data-track="weigh"><span>Weigh 42 €</span></button>`;
    document.querySelector("span")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    telemetry.flush(false);

    expect(beacons[0]?.beacon?.items[0]).toMatchObject({
      name: "$click",
      properties: { target: "weigh" },
    });
  });

  it("ignores clicks on untracked elements", () => {
    const { telemetry } = started();

    document.body.innerHTML = `<button>Plain</button>`;
    document.querySelector("button")?.click();

    expect(telemetry.queue.size).toBe(0);
  });

  it("ignores metrics that are not web vitals", () => {
    const { telemetry } = started();

    telemetry.vital({ id: "n1", name: "Next.js-hydration", value: 12 }, "/");

    expect(telemetry.queue.size).toBe(0);
  });
});
