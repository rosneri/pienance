import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@pienance/core", "@pienance/db", "@pienance/ui"],
};

export default nextConfig;
