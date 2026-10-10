import type { Instrumentation } from "next";

// Runs once per server instance. Telemetry writes to Postgres over TCP, so Node.js only.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startServerTelemetry } = await import("./pienance");

  startServerTelemetry();
}

export const onRequestError: Instrumentation.onRequestError = async (error) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { recordError } = await import("@pienance/telemetry/server");

  recordError(error);
};
