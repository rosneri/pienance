import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@pienance/core", "@pienance/db", "@pienance/telemetry", "@pienance/ui"],
  // Bank statements are uploaded through a server action: room for largestStatement (src/import/lines.ts).
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
