// E2E test: Download demo-video after dialog & consent
import { test, expect } from '@playwright/test';
import { closeWelcomeDialog, consentNotification } from './helpers.mjs';
import { APP_URL, LION_PATH } from './constants.mjs';

test.describe('Download demo', () => {
  test('should load app, handle dialogs, download demo-video, screenshot', async ({ page }) => {
    await page.goto(APP_URL);
    await closeWelcomeDialog(page);
    await consentNotification(page);

    // Go directly to the lion mp3 URL
    const lionUrl = APP_URL + LION_PATH;
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

    // Wait a small moment for logs to flush
    await page.waitForTimeout(500);

    // Assert: div with id="timeSection" is visible
    const timeSection = await page.locator('#timeSection');
    await expect(timeSection).toBeVisible();

    // Assert: div with id="currentSong" contains 'A Lion'
    const currentSong = await page.locator('#currentSong');
    await expect(currentSong).toContainText('A Lion');

    // Assert: #markerList contains buttons with values 'Start', 'edit', and 'End'
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
