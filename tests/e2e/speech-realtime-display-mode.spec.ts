import { test, expect } from "@playwright/test";

/**
 * E2E tests for F-001-azure-display-mode
 * Verifies UI display modes, badges, waiting states, and timeline.
 * Note: These tests verify static UI rendering and state display —
 * actual speech assessment requires mic/WebSocket which is not feasible in E2E.
 */

test.describe("Speech Realtime - Display Mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/speech-realtime");
  });

  // TC-01-04: Mode badges correctly displayed
  test("should display correct mode badges for all providers", async ({ page }) => {
    // Azure should have "整句评测" (batch) badge in gray
    const azurePanel = page.locator("text=Microsoft Azure").locator("..");
    await expect(azurePanel.locator("text=整句评测")).toBeVisible();

    // iFlytek should have "实时评测" (realtime) badge in blue
    const iflytekPanel = page.locator("text=科大讯飞").locator("..");
    await expect(iflytekPanel.locator("text=实时评测")).toBeVisible();

    // Tencent should have "实时评测" (realtime) badge in blue
    const tencentPanel = page.locator("text=腾讯云").locator("..");
    await expect(tencentPanel.locator("text=实时评测")).toBeVisible();
  });

  test("should display three provider columns", async ({ page }) => {
    await expect(page.locator("text=Microsoft Azure")).toBeVisible();
    await expect(page.locator("text=科大讯飞")).toBeVisible();
    await expect(page.locator("text=腾讯云")).toBeVisible();
  });

  test("should display sample sentences and allow selection", async ({ page }) => {
    // Should have sentence buttons
    const sentenceButtons = page.locator("button", { hasText: /^句子 \d+$/ });
    await expect(sentenceButtons).toHaveCount(10);

    // First sentence should be selected by default
    const firstButton = sentenceButtons.nth(0);
    await expect(firstButton).toBeVisible();

    // Click second sentence
    await sentenceButtons.nth(1).click();

    // Reference text area should update
    const refText = page.locator("text=I think three thousand things");
    await expect(refText).toBeVisible();
  });

  test("should show connection status indicator", async ({ page }) => {
    // Should show connection status (connected or not)
    const statusIndicator = page.locator("text=/● (已连接|未连接)/");
    await expect(statusIndicator).toBeVisible();
  });

  test("should display score placeholders before recording", async ({ page }) => {
    // Before any recording, scores should show "—" placeholders
    const dashScores = page.locator("text=—");
    // 3 providers x 4 scores = 12 dashes minimum
    expect(await dashScores.count()).toBeGreaterThanOrEqual(12);
  });

  test("should display reference words in all provider panels", async ({ page }) => {
    // Each provider panel should show the reference words
    // Default sentence: "The sheep on the ship will sit in the seat."
    const panels = page.locator("[style*='grid']").first();
    await expect(panels).toBeVisible();

    // Check that word tokens are rendered (at least one "sheep" visible)
    const sheepTokens = page.locator("span", { hasText: "sheep" });
    // Should appear in all 3 provider panels (may match nested spans too)
    expect(await sheepTokens.count()).toBeGreaterThanOrEqual(3);
  });

  test("should not show response timeline before any recording", async ({ page }) => {
    // Timeline should not be visible when no data
    await expect(page.locator("text=响应时间轴")).not.toBeVisible();
  });

  test("should have start recording button", async ({ page }) => {
    const startButton = page.locator("button", { hasText: "开始实时评测" });
    await expect(startButton).toBeVisible();
  });

  // Verify Azure badge styling (gray vs blue)
  test("should style Azure badge differently from realtime providers", async ({ page }) => {
    // Azure badge background should be gray (#f1f5f9)
    const azureBadge = page.locator("text=整句评测");
    const azureBg = await azureBadge.evaluate((el) => getComputedStyle(el).backgroundColor);

    // Realtime badges background should be blue (#dbeafe)
    const realtimeBadges = page.locator("text=实时评测");
    const realtimeBg = await realtimeBadges.first().evaluate((el) => getComputedStyle(el).backgroundColor);

    // They should be different colors
    expect(azureBg).not.toEqual(realtimeBg);
  });
});
