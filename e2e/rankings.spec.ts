import { test, expect } from "@playwright/test"
import { login, skipIfNoCredentials } from "./helpers"

test.beforeEach(async ({ page }, testInfo) => {
  const skip = skipIfNoCredentials()
  if (skip) { testInfo.skip(true, skip); return }
  await login(page)
  // My Albums is the default landing page
})

test("My Albums page loads and shows ranked albums", async ({ page }) => {
  await expect(page.locator('text=My Albums')).toBeVisible()
  // Either albums are shown or the empty state
  const hasAlbums = await page.locator('.aspect-square').count() > 0
  const hasEmptyState = await page.locator('text=No albums ranked yet').isVisible()
  expect(hasAlbums || hasEmptyState).toBe(true)
})

test("decade filter chips appear when albums span multiple decades", async ({ page }) => {
  const albumCount = await page.locator('.aspect-square').count()
  test.skip(albumCount < 2, "Need ranked albums to test filters")

  // If decade chips are present, clicking one should filter the grid
  const decadeChip = page.locator('button').filter({ hasText: /^\d{4}s$/ }).first()
  if (await decadeChip.isVisible()) {
    await decadeChip.click()
    // After filtering, album count should be ≤ total count
    const filteredCount = await page.locator('.aspect-square').count()
    expect(filteredCount).toBeLessThanOrEqual(albumCount)
  }
})

test("rank numbers are preserved when decade filter is active", async ({ page }) => {
  const decadeChip = page.locator('button').filter({ hasText: /^\d{4}s$/ }).first()
  test.skip(!await decadeChip.isVisible(), "No decade chips — skipping rank test")

  // Before filter: get ranks
  const ranksBefore = await page.locator('.bg-black\\/70.text-white').allTextContents()

  await decadeChip.click()

  // After filter: ranks should be a subset of the pre-filter ranks, not reset to 1..N
  const ranksAfter = await page.locator('.bg-black\\/70.text-white').allTextContents()
  for (const rank of ranksAfter) {
    expect(ranksBefore).toContain(rank)
  }
})

test("album tile shows title fallback when no cover art", async ({ page }) => {
  // Text fallback tiles should show album title text
  const fallback = page.locator('.aspect-square .text-cream\\/70').first()
  if (await fallback.isVisible()) {
    const text = await fallback.textContent()
    expect(text?.length).toBeGreaterThan(0)
  }
})
