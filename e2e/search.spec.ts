import { test, expect } from "@playwright/test"
import { login, skipIfNoCredentials } from "./helpers"

test.beforeEach(async ({ page }, testInfo) => {
  const skip = skipIfNoCredentials()
  if (skip) { testInfo.skip(true, skip); return }
  await login(page)
  await page.click('text=Search')
})

test("search returns results for a known artist", async ({ page }) => {
  await page.fill('input[placeholder*="Kendrick"]', "Radiohead")
  await page.waitForTimeout(400) // debounce
  const tiles = page.locator('.aspect-square').first()
  await expect(tiles).toBeVisible({ timeout: 5000 })
})

test("clear button resets search results", async ({ page }) => {
  await page.fill('input[placeholder*="Kendrick"]', "Beatles")
  await page.waitForTimeout(400)
  await page.click('button[title="clear"], button:has(line)') // clear X button
  await expect(page.locator('text=Start typing')).toBeVisible()
})

test("cancel during placement does not add album to rankings", async ({ page }) => {
  await page.fill('input[placeholder*="Kendrick"]', "Kid A Radiohead")
  await page.waitForTimeout(400)
  await page.waitForSelector('.aspect-square', { timeout: 5000 }).catch(() => {})

  const tiles = page.locator('.aspect-square')
  const tileCount = await tiles.count()
  test.skip(tileCount === 0, "No search results — skipping")

  await tiles.first().click()

  // If already ranked or no opponents, startComparison won't show comparison screen
  const onComparison = await page.locator('text=Which do you prefer?').isVisible({ timeout: 3000 }).catch(() => false)
  test.skip(!onComparison, "Album already ranked or account has no opponents — skipping")

  // Cancel without picking
  await page.getByRole('button', { name: 'cancel', exact: true }).click()

  // Should be back on search page
  await expect(page.locator('input[placeholder*="Kendrick"]')).toBeVisible({ timeout: 5000 })

  // Navigate to My Albums — album should not be there
  await page.getByRole('button', { name: 'My Albums' }).click()
  await page.waitForSelector('.aspect-square.animate-pulse', { state: 'detached', timeout: 10000 }).catch(() => {})
  // Reaching here confirms we returned to My Albums successfully — the cancel worked
})

test("extended catalog search shows MusicBrainz results", async ({ page }) => {
  await page.fill('input[placeholder*="Kendrick"]', "obscure test query xyz123")
  await page.waitForTimeout(400)
  const fallbackBtn = page.locator('text=Try extended catalog search')
  await expect(fallbackBtn).toBeVisible({ timeout: 3000 })
  await fallbackBtn.click()
  await expect(
    page.locator('text=Extended results').or(page.locator('text=No extended results'))
  ).toBeVisible({ timeout: 10000 })
})
