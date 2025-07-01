// E2E test: Upload a song (A horse.mp3) after dismissing dialogs
import { test } from "@playwright/test";
import { closeWelcomeDialog, consentNotification } from "./helpers/helpers.mjs";
import { assertSongLoadedUI } from "./helpers/assertions-feature.mjs";
import { uploadSongFile as loadSongFromComputerFileViaLabel } from "./helpers/assertions-atomic.mjs";
import { APP_URL } from "./helpers/constants.mjs";
import { getMP3Path } from "./helpers/helpers.mjs";
import { assertDataSongTableHasRowCount } from "./helpers/helpers.mjs";

const ARTIFACTS = "test-artifacts";
// Cross-platform: fix Windows path (remove leading slash if present)

/**
 * 
true  C:\Users\simon\Dropbox\prog\Troff collection\pwa_troff\tests\e2e
      C:\Users\simon\Dropbox\prog\Troff collection\pwa_troff\tests\e2e\test-files\A horse.mp3

 * 
 * This test loads the app, dismisses dialogs, uploads a song, and takes screenshots along the way.
 */
test.describe("Add song to Troff", () => {
  test("should load app, handle dialogs, add songs, screenshot", async ({
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
    await loadSongFromComputerFileViaLabel(
      page,
      getMP3Path("A Horse.mp3"),
      "US"
    );

    // Use shared assertion for loaded song UI
    await assertSongLoadedUI(page, "A horse");
    await page.screenshot({
      path: `${ARTIFACTS}/US_d_after_assertion.png`,
      fullPage: true,
    });

    await loadSongFromComputerFileViaLabel(
      page,
      getMP3Path("A Lion.mp3"),
      "US"
    );
    await loadSongFromComputerFileViaLabel(
      page,
      getMP3Path("A Monkey.mp3"),
      "US"
    );
    await loadSongFromComputerFileViaLabel(
      page,
      getMP3Path("A Tiger.mp3"),
      "US"
    );
    await loadSongFromComputerFileViaLabel(
      page,
      getMP3Path("An Elephant.mp3"),
      "US"
    );

    await assertDataSongTableHasRowCount(page, 5);
  });
});
