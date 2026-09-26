import { defineConfig } from "vitest/config";

// Separate from vite.config.ts: vitest ships its own Vite, whose config types differ from the app's.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts", "netlify/**/*.test.ts"],
  },
});
