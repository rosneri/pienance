import { ownerOf } from "@pienance/auth";
import { after } from "next/server";
import { auth, clock, deployment, telemetryWriter } from "@/pienance";
import { ingestBeacon } from "@/server/telemetry-routes";

export const POST = ingestBeacon({
  writer: telemetryWriter,
  owner: (request) => ownerOf(auth(), request.headers),
  now: clock,
  deployment,
  defer: after,
});
