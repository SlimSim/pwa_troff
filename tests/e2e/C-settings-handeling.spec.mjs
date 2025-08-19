// E2E test: Upload a song (A horse.mp3) after dismissing dialogs
import { test } from "@playwright/test";
import {
  closeWelcomeDialog,
  closeConsentNotification,
  screenshot,
  assertDataSongTableHasRowCount,
  getMP3Path,
} from "./helpers/helpers.mjs";
import { assertSongLoadedUI } from "./helpers/assertions-feature.mjs";
import { APP_URL } from "./helpers/constants.mjs";
import {
  expectElementToHaveClass,
  addLocalSongToTroff,
  expectElementToNotHaveClass,
  expectInputToHave,
} from "./helpers/assertions-atomic.mjs";

/**
 * This test loads the app, dismisses dialogs, uploads a song, and takes screenshots along the way.
 */
test.describe("C - Handle settings", () => {
  let i = 1;
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await closeWelcomeDialog(page);
    await closeConsentNotification(page);
    await addLocalSongToTroff(page, getMP3Path("A Horse.mp3"), "C1");
    await addLocalSongToTroff(page, getMP3Path("A Lion.mp3"), "C1");
  });

  test("C1 - should load app, handle dialogs, add songs", async ({ page }) => {
    await screenshot(page, "C1_" + i++, "before_settings");

    await expectElementToNotHaveClass(page, "#buttStartBefore", "active");
    await expectInputToHave(page, "#startBefore", "4");

    await expectElementToNotHaveClass(page, "#buttStopAfter", "active");
    await expectInputToHave(page, "#stopAfter", "2");

    await expectElementToHaveClass(page, "#buttPauseBefStart", "active");
    await expectInputToHave(page, "#pauseBeforeStart", "3");

    await expectElementToHaveClass(page, "#buttWaitBetweenLoops", "active");
    await expectInputToHave(page, "#waitBetweenLoops", "1");

    await expectElementToNotHaveClass(page, "#buttIncrementUntil", "active");
    await expectInputToHave(page, "#incrementUntilValue", "100");

    await page.locator("#buttStartBefore").click();
    await page.locator("#startBefore").fill("6");

    await page.locator("#buttStopAfter").click();
    await page.locator("#stopAfter").fill("6");

    // await page.locator("#buttPauseBefStart").click();
    await page.locator("#pauseBeforeStart").fill("6");

    // await page.locator("#buttWaitBetweenLoops").click();
    await page.locator("#waitBetweenLoops").fill("6");

    // await page.locator("#buttIncrementUntil").click();
    await page.locator("#incrementUntilValue").fill("60");
    await screenshot(page, "C1_" + i++, "after_settings");

    await expectElementToHaveClass(page, "#buttStartBefore", "active");
    await expectInputToHave(page, "#startBefore", "6");

    await expectElementToHaveClass(page, "#buttStopAfter", "active");
    await expectInputToHave(page, "#stopAfter", "6");

    await expectElementToHaveClass(page, "#buttPauseBefStart", "active");
    await expectInputToHave(page, "#pauseBeforeStart", "6");

    await expectElementToHaveClass(page, "#buttWaitBetweenLoops", "active");
    await expectInputToHave(page, "#waitBetweenLoops", "6");

    await expectElementToHaveClass(page, "#buttIncrementUntil", "active");
    await expectInputToHave(page, "#incrementUntilValue", "60");

    await screenshot(page, "C1_" + i++, "after_settings");
    await assertDataSongTableHasRowCount(page, 2);
    await assertSongLoadedUI(page, "A horse");

    // reload and expect again :)
    // await clickSongInList(page, "A Monkey");
    // await screenshot(page, "B1" + i++, "after_monkey");
    // await assertSongLoadedUI(page, "A Monkey");
  });
});
