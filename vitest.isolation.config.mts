import { defineConfig } from "vitest/config";

// Runs against the dev database, so it is kept apart from `npm test`.
export default defineConfig({
  test: {
    include: ["tests/isolation/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
