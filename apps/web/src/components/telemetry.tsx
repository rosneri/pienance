"use client";

import {
  beaconSender,
  startBrowserTelemetry,
  type BrowserTelemetry,
  type Send,
  type VitalMetric,
} from "@pienance/telemetry/browser";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { useCallback, useEffect, useRef } from "react";

interface TelemetryProps {
  /** Where beacons go; tests hand in a plain function. */
  readonly send?: Send;
}

/** Visitors who ask not to be tracked (Global Privacy Control) are not. */
function optedOut(): boolean {
  return "globalPrivacyControl" in navigator && navigator.globalPrivacyControl === true;
}

/** Clickstream and web vitals for the whole app. Renders nothing. */
export function Telemetry({ send }: TelemetryProps) {
  const path = usePathname();
  const running = useRef<BrowserTelemetry | null>(null);
  const firstView = useRef(true);

  useEffect(() => {
    if (optedOut()) return;

    const page = startBrowserTelemetry(window, send ?? beaconSender("/api/telemetry"));

    running.current = page.telemetry;

    return () => {
      page.stop();
      page.telemetry.flush(true);
      running.current = null;
    };
  }, [send]);

  useEffect(() => {
    const referrer = firstView.current ? document.referrer : undefined;

    firstView.current = false;
    running.current?.pageview(path ?? window.location.pathname, referrer);
  }, [path]);

  useReportWebVitals(
    useCallback(
      (metric: VitalMetric) => running.current?.vital(metric, window.location.pathname),
      [],
    ),
  );

  return null;
}
