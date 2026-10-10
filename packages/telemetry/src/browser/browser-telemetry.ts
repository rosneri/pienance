import { vitalNames, type Properties, type VitalName, type VitalRating } from "../contract";
import { BeaconQueue, type Schedule, type Send } from "./beacon-queue";
import { IdentityKeeper, type KeyValueStore } from "./identity";

/** What web-vitals (and Next's `useReportWebVitals`) report; other metric names are ignored. */
export interface VitalMetric {
  readonly id: string;
  readonly name: string;
  readonly value: number;
  readonly rating?: VitalRating;
  readonly navigationType?: string;
}

export interface BrowserTelemetryOptions {
  readonly send: Send;
  readonly now: () => number;
  readonly newId: () => string;
  readonly schedule: Schedule;
  readonly sessionStore: KeyValueStore | null;
  readonly localStore: KeyValueStore | null;
}

function isVitalName(name: string): name is VitalName {
  return vitalNames.some((vital) => vital === name);
}

/** Only where a visitor came from, never the page: a referrer URL may carry personal data. */
function originOf(referrer: string): string | undefined {
  try {
    return new URL(referrer).origin;
  } catch {
    return undefined;
  }
}

/** A path as recorded: no query string or fragment, which may carry personal data. */
function cleanPath(path: string): string {
  return (path.split(/[?#]/)[0] ?? "/").slice(0, 200) || "/";
}

/** Clickstream and web vitals for one page, batched into beacons. */
export class BrowserTelemetry {
  readonly #options: BrowserTelemetryOptions;
  readonly #identity: IdentityKeeper;
  readonly queue: BeaconQueue;

  constructor(options: BrowserTelemetryOptions) {
    this.#options = options;
    this.#identity = new IdentityKeeper(options.sessionStore, options.localStore, options.newId);
    this.queue = new BeaconQueue({
      send: options.send,
      schedule: options.schedule,
      identity: () => this.#identity.at(options.now()),
    });
  }

  pageview(path: string, referrer?: string): void {
    this.#event("$pageview", path, {}, referrer);
  }

  /** A click on an element marked `data-track="name"`. */
  click(name: string, path: string): void {
    this.#event("$click", path, { target: name.slice(0, 200) });
  }

  leave(path: string, visibleMs: number): void {
    this.#event("$leave", path, { visibleMs: Math.round(visibleMs) });
  }

  vital(metric: VitalMetric, path: string): void {
    const name = metric.name;

    if (!isVitalName(name)) return;

    this.queue.push({
      type: "vital",
      id: metric.id.slice(0, 100),
      name,
      value: Math.max(0, metric.value),
      rating: metric.rating,
      navigationType: metric.navigationType?.slice(0, 40),
      at: Math.round(this.#options.now()),
      path: cleanPath(path),
    });
  }

  flush(unloading: boolean): void {
    this.queue.flush(unloading);
  }

  #event(
    name: "$pageview" | "$click" | "$leave",
    path: string,
    properties: Properties,
    referrer?: string,
  ): void {
    this.queue.push({
      type: "event",
      id: this.#options.newId(),
      name,
      at: Math.round(this.#options.now()),
      path: cleanPath(path),
      referrer: referrer ? originOf(referrer)?.slice(0, 200) : undefined,
      properties,
    });
  }
}

/** The page's storage, or null where the browser blocks it. */
function storage(read: () => Storage): Storage | null {
  try {
    return read();
  } catch {
    return null;
  }
}

export interface RunningTelemetry {
  readonly telemetry: BrowserTelemetry;
  /** Stops listening to the page. */
  readonly stop: () => void;
}

/**
 * Starts telemetry in a page: delegated clicks on `[data-track]`, and a `$leave` plus a final
 * beacon when the page is hidden. Returns the telemetry and a function that stops listening.
 */
export function startBrowserTelemetry(page: Window, send: Send): RunningTelemetry {
  const telemetry = new BrowserTelemetry({
    send,
    now: () => Date.now(),
    newId: () => page.crypto.randomUUID(),
    schedule: (run, ms) => {
      const timer = page.setTimeout(run, ms);

      return () => page.clearTimeout(timer);
    },
    sessionStore: storage(() => page.sessionStorage),
    localStore: storage(() => page.localStorage),
  });

  let visibleSince = Date.now();

  const onClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target.closest("[data-track]") : null;
    const name = target?.getAttribute("data-track");

    if (name) telemetry.click(name, page.location.pathname);
  };

  const onVisibility = (): void => {
    if (page.document.visibilityState === "hidden") {
      telemetry.leave(page.location.pathname, Date.now() - visibleSince);
      telemetry.flush(true);
    } else {
      visibleSince = Date.now();
    }
  };

  const onPageHide = (): void => telemetry.flush(true);

  page.document.addEventListener("click", onClick, { capture: true });
  page.document.addEventListener("visibilitychange", onVisibility);
  page.addEventListener("pagehide", onPageHide);

  return {
    telemetry,
    stop: () => {
      page.document.removeEventListener("click", onClick, { capture: true });
      page.document.removeEventListener("visibilitychange", onVisibility);
      page.removeEventListener("pagehide", onPageHide);
    },
  };
}
