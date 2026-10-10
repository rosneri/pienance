import type { BeaconItem } from "../contract";
import type { Identity } from "./identity";

/** Sends one serialised beacon; resolves to whether it was accepted. */
export type Send = (body: string, unloading: boolean) => boolean | Promise<boolean>;

/** Runs `run` after `ms`; returns a function that cancels it. */
export type Schedule = (run: () => void, ms: number) => () => void;

export interface BeaconQueueOptions {
  readonly send: Send;
  readonly identity: () => Identity;
  readonly schedule: Schedule;
  /** Items per beacon; a full batch is sent at once. */
  readonly batchSize?: number;
  /** How long a partial batch waits before it is sent. */
  readonly waitMs?: number;
  /** Items kept while sending fails; the oldest are dropped first. */
  readonly maxBuffered?: number;
}

/**
 * Batches telemetry so the browser sends a few small beacons instead of one request per
 * event. Never throws and never blocks the UI: a failed batch is kept for the next flush.
 */
export class BeaconQueue {
  readonly #options: BeaconQueueOptions;
  readonly #batchSize: number;
  readonly #waitMs: number;
  readonly #maxBuffered: number;
  #items: BeaconItem[] = [];
  #cancel: (() => void) | null = null;

  constructor(options: BeaconQueueOptions) {
    this.#options = options;
    this.#batchSize = options.batchSize ?? 20;
    this.#waitMs = options.waitMs ?? 5_000;
    this.#maxBuffered = options.maxBuffered ?? 200;
  }

  get size(): number {
    return this.#items.length;
  }

  push(item: BeaconItem): void {
    this.#keep([item]);

    if (this.#items.length >= this.#batchSize) {
      this.flush(false);
    } else {
      this.#cancel ??= this.#options.schedule(() => {
        this.#cancel = null;
        this.flush(false);
      }, this.#waitMs);
    }
  }

  /** Sends everything queued; `unloading` asks the sender to use a beacon that survives the page. */
  flush(unloading: boolean): void {
    this.#cancel?.();
    this.#cancel = null;

    // Take everything first: a failed batch goes back to the queue for the next flush, not this one.
    const items = this.#items.splice(0);

    for (let start = 0; start < items.length; start += this.#batchSize) {
      const batch = items.slice(start, start + this.#batchSize);
      const body = JSON.stringify({ ...this.#options.identity(), items: batch });
      const retry = (): void => this.#keep(batch);

      try {
        void Promise.resolve(this.#options.send(body, unloading)).then(
          (accepted) => accepted || retry(),
          retry,
        );
      } catch {
        retry();
      }
    }
  }

  #keep(items: readonly BeaconItem[]): void {
    this.#items.push(...items);

    if (this.#items.length > this.#maxBuffered) {
      this.#items.splice(0, this.#items.length - this.#maxBuffered);
    }
  }
}

/** Posts beacons to a first-party endpoint: `sendBeacon` while unloading, `fetch` otherwise. */
export function beaconSender(endpoint: string): Send {
  return async (body, unloading) => {
    if (unloading && "sendBeacon" in navigator) {
      return navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
    }

    const response = await fetch(endpoint, {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
      keepalive: true,
    });

    return response.ok;
  };
}
