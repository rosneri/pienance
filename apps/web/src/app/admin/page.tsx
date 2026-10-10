import { AdminOverview } from "@/components/admin/admin-overview";
import { adminWindowOf, windowStart } from "@/components/admin/window";
import { clock, telemetryReader } from "@/pienance";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const reader = telemetryReader();

  if (!reader) {
    return (
      <main className="grid gap-4">
        <h1 className="text-4xl">Telemetry</h1>
        <p className="max-w-[60ch] text-muted-foreground">
          Telemetry is stored in Postgres. Connect a database (DATABASE_URL) to collect and see it.
        </p>
      </main>
    );
  }

  const window = adminWindowOf((await searchParams).window);
  const overview = await reader.overview(windowStart(window, clock()));

  return <AdminOverview overview={overview} window={window} />;
}
