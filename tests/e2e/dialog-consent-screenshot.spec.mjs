// E2E test: Welcome dialog + consent + screenshot
import { test, expect } from '@playwright/test';

const APP_URL = 'http://localhost:8000';

/**
 * Helper to close the first-time user dialog by clicking "OK".
 */
async function closeWelcomeDialog(page) {
  const dialog = page.locator('#firstTimeUserDialog');
  if (await dialog.isVisible().catch(() => false)) {
    console.log("closeWelcomeDialog: firstTimeUserDialog is visible!")
    // Try multiple selectors for the OK button
    let okBtn = dialog.locator('button, input[type="button"]', { hasText: /^ok$/i });
    let okBtnCount = await okBtn.count();
    if (okBtnCount === 0) {
      console.log("closeWelcomeDialog: no OK button found by text");
      okBtn = dialog.locator('input[type="button"][value="OK"]');
      okBtnCount = await okBtn.count();
    }
    if (okBtnCount > 0) {
      console.log("closeWelcomeDialog: found OK button");
      const btn = okBtn.first();
      await btn.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(100);
      await btn.click({ force: true });
      await page.waitForTimeout(300); // Wait for dialog to close
    }
  }
}

/**
 * Helper to click "I consent" in the notification up to the right
 */
async function consentNotification(page) {
  // Try to find a notification/toast with the consent button
  // Adjust selectors as needed for your UI
  const consentBtn = page.locator('button, input[type="button"]', { hasText: /consent/i });
  if (await consentBtn.isVisible().catch(() => false)) {
    console.log("consentNotification: found consent button");
    await consentBtn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(100);
    await consentBtn.click({ force: true });
    await page.waitForTimeout(300); // Wait for notification to close
  }
}

test.describe('Dialog & Consent flow', () => {
  test('should load app, OK welcome, consent, screenshot', async ({ page }) => {
    await page.goto(APP_URL);
    await page.screenshot({ path: 'test-artifacts/DCF_a.png', fullPage: true });
    await closeWelcomeDialog(page);
    await page.screenshot({ path: 'test-artifacts/DCF_b_after_closeWelcomeDialog.png', fullPage: true });
    await consentNotification(page);
    await page.screenshot({ path: 'test-artifacts/DCF_c_after_consentNotification.png', fullPage: true });
    // Take screenshot for verification
    await page.screenshot({ path: 'test-artifacts/dialog-consent-state.png', fullPage: true });
    // Optionally, add assertions here
    // e.g., expect(someElement).toBeVisible();
  });
});
