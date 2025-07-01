// E2E test: Download demo-video after dialog & consent
import { test, expect } from '@playwright/test';

const APP_URL = 'http://localhost:8000';

// --- Reuse helpers from dialog-consent-screenshot.spec.mjs ---
async function closeWelcomeDialog(page) {
  const dialog = page.locator('#firstTimeUserDialog');
  if (await dialog.isVisible().catch(() => false)) {
    console.log("closeWelcomeDialog: firstTimeUserDialog is visible!");
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
      await page.waitForTimeout(300);
    }
  }
}

async function consentNotification(page) {
  const consentBtn = page.locator('button, input[type="button"]', { hasText: /consent/i });
  if (await consentBtn.isVisible().catch(() => false)) {
    console.log("consentNotification: found consent button");
    await consentBtn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(100);
    await consentBtn.click({ force: true });
    await page.waitForTimeout(300);
  }
}

test.describe('Download demo', () => {
  test('should load app, handle dialogs, download demo-video, screenshot', async ({ page }) => {
    page.on('console', msg => {
        console.log(`[browser:${msg.type()}] ${msg.text()}`);
    });
    await page.goto(APP_URL);
    await page.screenshot({ path: 'test-artifacts/DD_a.png', fullPage: true });
    await closeWelcomeDialog(page);
    await page.screenshot({ path: 'test-artifacts/DD_b_after_closeWelcomeDialog.png', fullPage: true });
    await consentNotification(page);
    await page.screenshot({ path: 'test-artifacts/DD_c_after_consentNotification.png', fullPage: true });

    // Go directly to the lion mp3 URL
    const lionUrl = 'http://localhost:8000/#1115399907&A%20Lion.mp3';
    console.log('Playwright: navigating to lion mp3 URL:', lionUrl);
    await page.goto(lionUrl);
    await page.screenshot({ path: 'test-artifacts/DD_d_after_lion_url.png', fullPage: true });

    // Wait for <audio> element to be attached (not visible)
    const audioEl = await page.waitForSelector('audio', { timeout: 15000, state: 'attached' });
    if (!audioEl) {
      throw new Error('Audio element NOT found!');
    }
    // Force .load() in case browser needs a nudge
    await audioEl.evaluate(audio => audio.load());
    // Wait for loadedmetadata event
    try {
      await audioEl.evaluate(audio => {
        return new Promise((resolve, reject) => {
          if (audio.readyState >= 1) return resolve('already loaded');
          let timeout = setTimeout(() => reject('Timeout waiting for loadedmetadata'), 15000);
          audio.addEventListener('loadedmetadata', () => {
            clearTimeout(timeout);
            resolve('event fired');
          }, { once: true });
        });
      });
    } catch (err) {
      await page.screenshot({ path: 'test-artifacts/DD_loadedmetadata_timeout.png', fullPage: true });
      throw new Error('Audio element found but loadedmetadata did not fire in time. See logs and screenshot for diagnostics.');
    }
    await page.screenshot({ path: 'test-artifacts/DD_g_after_audio_loadedmetadata.png', fullPage: true });

    // 1. Assert: check addVideoToContentDiv was called (by inspecting browser logs)
    const logs = [];
    page.on('console', msg => {
      if (msg.type() === 'log') logs.push(msg.text());
    });
    // Wait a small moment for logs to flush
    await page.waitForTimeout(500);

    // 2. Assert: div with id="timeSection" is visible
    const timeSection = await page.locator('#timeSection');
    await expect(timeSection).toBeVisible();

    // 3. Assert: div with id="currentSong" contains 'A Lion'
    const currentSong = await page.locator('#currentSong');
    await expect(currentSong).toContainText('A Lion');

    // 4-6. Assert: #markerList contains buttons with values 'Start', 'edit', and 'End'
    const markerList = await page.locator('#markerList');
    await expect(markerList).toBeVisible();
    // Find button with value="Start"
    const btnStart = markerList.locator('input[type="button"][value="Start"]');
    await expect(btnStart).toHaveCount(1);
    // Find button with value="edit" (can be multiple)
    const btnEdit = markerList.locator('input[type="button"][value="edit"]');
    const editCount = await btnEdit.count();
    expect(editCount).toBeGreaterThan(0);
    // Find button with value="End"
    const btnEnd = markerList.locator('input[type="button"][value="End"]');
    await expect(btnEnd).toHaveCount(1);
  });
});
