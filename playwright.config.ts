import { defineConfig, devices } from "@playwright/test"
import { existsSync } from "fs"

// Load .env so E2E_USER_EMAIL / E2E_USER_PASSWORD are available
// (Playwright runs outside Vite, so .env isn't loaded automatically)
if (existsSync(".env")) {
  process.loadEnvFile(".env")
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // sequential — tests share Supabase state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  projects: [
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
