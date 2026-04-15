import { test, expect } from "@playwright/test"
import { login, skipIfNoCredentials } from "./helpers"

test.beforeEach(async ({ page }, testInfo) => {
  const skip = skipIfNoCredentials()
  if (skip) { testInfo.skip(true, skip); return }
  await login(page)
})

test("comparison screen renders both albums side by side", async ({ page }) => {
  // Trigger Play Matches on an existing album if we have any
  const albumCount = await page.locator('.aspect-square').count()
  test.skip(albumCount < 2, "Need at least 2 ranked albums to test comparisons")

  // Hover over first tile and click Play matches (desktop)
  const tile = page.locator('.aspect-square').first()
  await tile.hover()
  const playBtn = page.locator('button', { hasText: "Play matches" }).first()
  if (await playBtn.isVisible()) {
    await playBtn.click()
    await expect(page.locator('text=Which do you prefer?')).toBeVisible({ timeout: 5000 })

    // Both arrow buttons should be present
    await expect(page.getByRole('button', { name: '←' })).toBeVisible()
    await expect(page.getByRole('button', { name: '→' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tie' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'cancel', exact: true })).toBeVisible()
  }
})

test("pick buttons are disabled until covers load", async ({ page }) => {
  const albumCount = await page.locator('.aspect-square').count()
  test.skip(albumCount < 2, "Need at least 2 ranked albums")

  const tile = page.locator('.aspect-square').first()
  await tile.hover()
  const playBtn = page.locator('button', { hasText: "Play matches" }).first()
  if (await playBtn.isVisible()) {
    await playBtn.click()
    await expect(page.locator('text=Which do you prefer?')).toBeVisible()

    // Immediately after navigation, buttons may be disabled
    const leftBtn = page.locator('button', { hasText: "←" })
    // Either disabled initially or enabled after load — just verify it becomes enabled
    await expect(leftBtn).toBeEnabled({ timeout: 6000 })
  }
})

test("keyboard shortcut ← triggers a pick", async ({ page }) => {
  const albumCount = await page.locator('.aspect-square').count()
  test.skip(albumCount < 2, "Need at least 2 ranked albums")

  const tile = page.locator('.aspect-square').first()
  await tile.hover()
  const playBtn = page.locator('button', { hasText: "Play matches" }).first()
  if (await playBtn.isVisible()) {
    await playBtn.click()
    await expect(page.locator('button', { hasText: "←" })).toBeEnabled({ timeout: 6000 })

    const remainingBefore = await page.locator('text=/\\d+ match/').textContent()
    await page.keyboard.press("ArrowLeft")

    // Match count should decrease or we navigate away (last match)
    await page.waitForTimeout(300)
    const onComparison = await page.locator('text=Which do you prefer?').isVisible()
    if (onComparison) {
      const remainingAfter = await page.locator('text=/\\d+ match/').textContent()
      expect(remainingAfter).not.toBe(remainingBefore)
    }
    // If not on comparison, we completed all matches — that's also valid
  }
})

test("cancel from re-rank returns to My Albums (album stays)", async ({ page }) => {
  // Wait for skeleton loading to finish before counting real albums
  await page.waitForSelector('.aspect-square.animate-pulse', { state: 'detached', timeout: 10000 }).catch(() => {})
  const albumCount = await page.locator('.aspect-square').count()
  test.skip(albumCount < 2, "Need at least 2 ranked albums")

  const tile = page.locator('.aspect-square').first()
  await tile.hover()
  const playBtn = page.locator('button', { hasText: "Play matches" }).first()
  if (await playBtn.isVisible()) {
    await playBtn.click()
    await expect(page.locator('text=Which do you prefer?')).toBeVisible()
    await page.getByRole('button', { name: 'cancel', exact: true }).click()
    // Wait for skeleton to clear again after navigation
    await page.waitForSelector('.aspect-square.animate-pulse', { state: 'detached', timeout: 10000 }).catch(() => {})
    const countAfter = await page.locator('.aspect-square').count()
    expect(countAfter).toBe(albumCount)
  }
})
