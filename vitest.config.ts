import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": import.meta.dirname } },
  test: { passWithNoTests: true, include: ["lib/**/*.test.ts", "scripts/**/*.test.ts"] },
});
