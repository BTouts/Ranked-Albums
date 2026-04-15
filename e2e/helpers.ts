import type { Page } from "@playwright/test"

const EMAIL = process.env.E2E_USER_EMAIL ?? ""
const PASSWORD = process.env.E2E_USER_PASSWORD ?? ""

export async function login(page: Page) {
  await page.goto("/")
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button:has-text("Sign in")')
  await page.waitForSelector('text=My Albums', { timeout: 10000 })
}

export function skipIfNoCredentials() {
  if (!process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD) {
    return "E2E_USER_EMAIL / E2E_USER_PASSWORD not set — skipping"
  }
  return null
}
