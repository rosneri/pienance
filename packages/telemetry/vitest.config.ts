import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each Postgres test file starts its own database; keep them from racing for ports.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    projects: [
      {
        extends: true,
        test: { name: "browser", include: ["src/browser/**/*.test.ts"], environment: "jsdom" },
      },
      {
        extends: true,
        test: {
          name: "node",
          include: ["src/contract/**/*.test.ts", "src/server/**/*.test.ts"],
          environment: "node",
        },
      },
    ],
  },
});
