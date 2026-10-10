import { abilityFor, viewerOf, type Viewer } from "@pienance/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/pienance";

/**
 * Lets only users who may read telemetry (admins) through: signed-out visitors go to sign-in,
 * everyone else gets a plain 404. Call it in every admin page before reading anything: Next.js
 * renders layouts and pages in parallel, so a check in the layout alone would still let the
 * page's data stream into the 404 response.
 */
export async function requireTelemetryReader(): Promise<Viewer> {
  const viewer = await viewerOf(auth(), await headers());

  if (!viewer) redirect("/sign-in");

  if (abilityFor(viewer).cannot("read", "Telemetry")) notFound();

  return viewer;
}
