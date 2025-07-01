// E2E test: Upload a song (A horse.mp3) after dismissing dialogs
import { test } from "@playwright/test";
import { closeWelcomeDialog, consentNotification } from "./helpers.mjs";
import { assertSongLoadedUI } from "./assertions-feature.mjs";
import { uploadSongFile as loadSongFromComputerFileViaLabel } from "./assertions-atomic.mjs";
import { APP_URL } from "./constants.mjs";

const ARTIFACTS = "test-artifacts";
// Cross-platform: fix Windows path (remove leading slash if present)
let MP3_PATH = new URL("./test-files/A horse.mp3", import.meta.url).pathname;
if (process.platform === "win32" && MP3_PATH.startsWith("/")) {
  MP3_PATH = MP3_PATH.slice(1);
}
MP3_PATH = decodeURIComponent(MP3_PATH);

/**
 * 
true  C:\Users\simon\Dropbox\prog\Troff collection\pwa_troff\tests\e2e
      C:\Users\simon\Dropbox\prog\Troff collection\pwa_troff\tests\e2e\test-files\A horse.mp3

 * 
 * This test loads the app, dismisses dialogs, uploads a song, and takes screenshots along the way.
 */
test.describe("Upload song", () => {
  test("should load app, handle dialogs, upload A horse.mp3, screenshot", async ({
    page,
  }) => {
    await page.goto(APP_URL);
    await closeWelcomeDialog(page);
    await consentNotification(page);
    await page.screenshot({
      path: `${ARTIFACTS}/US_a_after_dialogs.png`,
      fullPage: true,
    });

    // Upload the song file via helper
    await loadSongFromComputerFileViaLabel(page, MP3_PATH, "US");

    // Use shared assertion for loaded song UI
    await assertSongLoadedUI(page, "A horse");
    await page.screenshot({
      path: `${ARTIFACTS}/US_d_after_assertion.png`,
      fullPage: true,
    });
  });
});
