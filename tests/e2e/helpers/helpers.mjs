// Shared E2E test helpers for Playwright
import { expect } from "@playwright/test";

/**
 * Helper to close the first-time user dialog by clicking "OK".
 */
export async function closeWelcomeDialog(page) {
  const dialog = page.locator("#firstTimeUserDialog");
  if (await dialog.isVisible().catch(() => false)) {
    // Try multiple selectors for the OK button
    let okBtn = dialog.locator('button, input[type="button"]', {
      hasText: /^ok$/i,
    });
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
 * Helper to assert the number of visible rows in the data song table
 * @param {import('@playwright/test').Page} page
 * @param {number} expectedCount - The expected number of rows
 */
export async function assertDataSongTableHasRowCount(page, expectedCount) {
  const table = page.locator("#dataSongTable tbody");
  const rows = await table.locator("tr");
  const rowCount = await rows.count();
  console.log("rowCount", rowCount);
  expect(
    rowCount,
    `songTable has ${rowCount} rows, expected to be ${expectedCount}`
  ).toBe(expectedCount);
}

/**
 * Helper to get the path to the MP3 file for a given song name
 * @param {string} songName - The name of the song (e.g., "A horse")
 * @returns {string} The path to the MP3 file
 */
export function getMP3Path(songName) {
  let MP3_PATH = new URL(`../test-files/${songName}`, import.meta.url).pathname;
  if (process.platform === "win32" && MP3_PATH.startsWith("/")) {
    MP3_PATH = MP3_PATH.slice(1);
  }
  MP3_PATH = decodeURIComponent(MP3_PATH);
  return MP3_PATH;
}

/**
 * Helper to click "I consent" in the notification up to the right
 */
export async function consentNotification(page) {
  const consentBtn = page.locator('button, input[type="button"]', {
    hasText: /consent/i,
  });
  if (await consentBtn.isVisible().catch(() => false)) {
    await consentBtn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(100);
    await consentBtn.click({ force: true });
    await page.waitForTimeout(300);
  }
}
