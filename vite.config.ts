import { defineConfig } from "vitest/config";

export default defineConfig({
  // Parallel card worktrees live in .worktrees/; keep Vite from scanning or watching them.
  optimizeDeps: { entries: ["index.html"] },
  server: { watch: { ignored: ["**/.worktrees/**"] } },
  test: {
    // API tests live in tests/ because Vercel turns every file in api/ into a function.
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.worktrees/**"],
    environment: "node",
  },
});
