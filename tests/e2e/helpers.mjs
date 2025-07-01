// Shared E2E test helpers for Playwright

/**
 * Helper to close the first-time user dialog by clicking "OK".
 */
export async function closeWelcomeDialog(page) {
  const dialog = page.locator('#firstTimeUserDialog');
  if (await dialog.isVisible().catch(() => false)) {
    // Try multiple selectors for the OK button
    let okBtn = dialog.locator('button, input[type="button"]', { hasText: /^ok$/i });
    let okBtnCount = await okBtn.count();
    if (okBtnCount === 0) {
      okBtn = dialog.locator('input[type="button"][value="OK"]');
      okBtnCount = await okBtn.count();
    }
    if (okBtnCount > 0) {
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
export async function consentNotification(page) {
  const consentBtn = page.locator('button, input[type="button"]', { hasText: /consent/i });
  if (await consentBtn.isVisible().catch(() => false)) {
    await consentBtn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(100);
    await consentBtn.click({ force: true });
    await page.waitForTimeout(300);
  }
}
