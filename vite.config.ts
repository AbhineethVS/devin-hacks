import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // API tests live in tests/ because Vercel turns every file in api/ into a function.
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
  },
});
