import { maintainTelemetry } from "@pienance/telemetry/server";
import { telemetryDatabase } from "@/pienance";
import { maintenanceRoute } from "@/server/telemetry-routes";

export const GET = maintenanceRoute({
  secret: process.env.CRON_SECRET,
  maintain: async () => {
    const database = telemetryDatabase();

    if (database) await maintainTelemetry(database, { daysAhead: 3, keepDays: 14 });
  },
});
