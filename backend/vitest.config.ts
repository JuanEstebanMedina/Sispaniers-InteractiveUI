import { defineConfig } from "vitest/config";

// The compose credentials live in this package's own .env, so the Mongo
// integration tests can reach the container started by `docker compose up`.
try {
  process.loadEnvFile(".env");
} catch {
  // running without a local .env, e.g. in CI where MONGODB_URI is provided directly
}

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
