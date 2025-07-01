// E2E test: Download demo-video after dialog & consent
import { test, expect } from "@playwright/test";
import { assertSongLoadedUI } from "./helpers/assertions-feature.mjs";
import { waitForAudioLoaded } from "./helpers/assertions-atomic.mjs";
import { closeWelcomeDialog, consentNotification } from "./helpers/helpers.mjs";
import { APP_URL, LION_PATH } from "./helpers/constants.mjs";

test.describe("Download demo", () => {
  test("should load app, handle dialogs, download demo-video, screenshot", async ({
    page,
  }) => {
    await page.goto(APP_URL);
    await closeWelcomeDialog(page);
    await consentNotification(page);

    // Go directly to the lion mp3 URL
    const lionUrl = APP_URL + LION_PATH;
    await page.goto(lionUrl);
    await page.screenshot({
      path: "test-artifacts/DD_d_after_lion_url.png",
      fullPage: true,
    });

    // Wait for <audio> element to be attached and loaded
    await waitForAudioLoaded(page, 15000);
    await page.screenshot({
      path: "test-artifacts/DD_g_after_audio_loadedmetadata.png",
      fullPage: true,
    });

    // Wait a small moment for logs to flush
    await page.waitForTimeout(500);
    // Use shared assertion for loaded song UI
    await assertSongLoadedUI(page, "A Lion");
  });
});
