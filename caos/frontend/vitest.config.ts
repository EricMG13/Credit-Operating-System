import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Unit tests only — keep Playwright e2e specs (../tests/frontend/e2e) out.
    include: ["src/**/*.test.ts"],
  },
});
