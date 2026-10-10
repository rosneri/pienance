import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@pienance/core", "@pienance/db"],
};

export default nextConfig;
