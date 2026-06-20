import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Match the app's automatic JSX runtime so component tests don't need an
  // explicit React import.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Unit + component tests — keep Playwright e2e specs (../tests/frontend/e2e)
    // out. Component tests opt into jsdom per-file via `@vitest-environment`.
    include: ["src/**/*.test.{ts,tsx}"],
    // `npm run test:coverage` emits coverage/coverage-final.json (Istanbul shape)
    // for `fallow health --coverage …` — gives exact per-function CRAP/coverage
    // so deep render-callbacks a test exercises aren't flagged as untested.
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json"],
      reportsDirectory: "./coverage",
    },
  },
});
