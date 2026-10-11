import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@pienance/core", "@pienance/db", "@pienance/telemetry", "@pienance/ui"],
  // Bank statements are uploaded through a server action: room for largestUpload (src/import/lines.ts),
  // under Vercel's 4.5 MB request limit.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
