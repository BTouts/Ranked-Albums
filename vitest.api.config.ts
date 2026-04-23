import { defineConfig } from "vitest/config"
import { loadEnv } from "vite"

export default defineConfig(({ mode }) => ({
  test: {
    include: ["tests/api/**/*.test.ts"],
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 15_000,
  },
}))
