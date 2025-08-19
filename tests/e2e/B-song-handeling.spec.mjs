// E2E test: Upload a song (A horse.mp3) after dismissing dialogs
import { test } from "@playwright/test";
import {
  closeWelcomeDialog,
  closeConsentNotification,
  clickSongInList,
  assertDataSongTableHasRowCount,
  screenshot,
  getMP3Path,
} from "./helpers/helpers.mjs";
import { assertSongLoadedUI } from "./helpers/assertions-feature.mjs";
import { addLocalSongToTroff } from "./helpers/assertions-atomic.mjs";
import { APP_URL, LION_PATH } from "./helpers/constants.mjs";
import { waitForAudioLoaded } from "./helpers/assertions-atomic.mjs";

/**
 * This test loads the app, dismisses dialogs, uploads a song, and takes screenshots along the way.
 */
test.describe("B - Handle songs", () => {
  let i = 1;
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await closeWelcomeDialog(page);
    await closeConsentNotification(page);
  });

  test("B1 - should load app, handle dialogs, add songs", async ({ page }) => {
    await screenshot(page, "B1_" + i++, "after_dialogs");

    // Upload the song file via helper
    await addLocalSongToTroff(page, getMP3Path("A Horse.mp3"), "B1");

    // Use shared assertion for loaded song UI
    await assertSongLoadedUI(page, "A horse");
    // await screenshot(page, "B1_" + i++, "after_1_assertion");

    await addLocalSongToTroff(page, getMP3Path("A Lion.mp3"), "B1");
    // await screenshot(page, "B1_" + i++, "after_2_assertion");
    await addLocalSongToTroff(page, getMP3Path("A Monkey.mp3"), "B1");
    // await screenshot(page, "B1_" + i++, "after_3_assertion");
    await addLocalSongToTroff(page, getMP3Path("A Tiger.mp3"), "B1");
    // await screenshot(page, "B1_" + i++, "after_4_assertion");
    await addLocalSongToTroff(page, getMP3Path("An Elephant.mp3"), "B1");
    // await screenshot(page, "B1_" + i++, "after_5_assertion");
    await assertDataSongTableHasRowCount(page, 5);

    await page.reload();
    await assertDataSongTableHasRowCount(page, 5);
    await assertSongLoadedUI(page, "A horse");

    await clickSongInList(page, "A Monkey");
    await screenshot(page, "B1_" + i++, "after_monkey");
    await assertSongLoadedUI(page, "A Monkey");
  });

  test("B2 - should load app, handle dialogs, download demo-song, screenshot", async ({
    page,
  }) => {
    let i = 1;
    // Go directly to the lion mp3 URL
    const lionUrl = APP_URL + LION_PATH;
    await page.goto(lionUrl);
    await screenshot(page, "B2_" + i++, "after_lion_url");

    // Wait for <audio> element to be attached and loaded
    await waitForAudioLoaded(page, 15000);
    await screenshot(page, "B2_" + i++, "after_audio_loadedmetadata");

    // Wait a small moment for logs to flush
    await page.waitForTimeout(500);
    // Use shared assertion for loaded song UI
    await assertSongLoadedUI(page, "A Lion");

    await assertDataSongTableHasRowCount(page, 1);

    await page.reload();
    await assertDataSongTableHasRowCount(page, 1);
    await assertSongLoadedUI(page, "A Lion");
  });
});
