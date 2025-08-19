// E2E test: Welcome dialog + consent + screenshot
import { test, expect } from "@playwright/test";
import { closeWelcomeDialog, closeConsentNotification, screenshot } from "./helpers/helpers.mjs";
import { APP_URL } from "./helpers/constants.mjs";
import { expectArtistToBe, expectNotificationToHave } from "./helpers/assertions-atomic.mjs";

test.describe("A - First time Loading App & Consent flow", () => {
  test("A1 - should load the homepage and have a title", async ({ page }) => {
    await page.goto(APP_URL);
    // Check that the page title exists (customize as needed)
    await expect(page).toHaveTitle(/.+/);
  });

  test("A2 - OK welcome, OK consent notification, screenshot, OK offline notification", async ({ page }) => {
    await page.goto(APP_URL);
    // Assert: Welcome dialog is visible and contains correct h2
    const welcomeDialog = page.locator("#firstTimeUserDialog");
    await expect(welcomeDialog, "Welcome dialog NOT visible").toBeVisible();
    const welcomeH2 = welcomeDialog.locator("h2");
    await expect(welcomeH2, `Welcome dialog NOT containing welcome text`).toContainText("Welcome to the music player Troff");
    await closeWelcomeDialog(page);

    await expectNotificationToHave(page, "Cookie consent");

    await closeConsentNotification(page);

    await screenshot(page, "A2", "Startup_state");

    await expectNotificationToHave(page, "Troff is now cached and will work offline");

    await expectArtistToBe(page, "Please select a song or movie from the songs area");
    await page.goto(APP_URL);

    const welcomeDialogSecondTime = page.locator("#firstTimeUserDialog");
    await expect(welcomeDialogSecondTime, "Welcome dialog visible after reload").not.toBeVisible();
  });

  test("A3 - Testing reload", async ({ page }) => {
    await page.goto(APP_URL);
    // Assert: Welcome dialog is visible and contains correct h2
    await expectNotificationToHave(page, "Cookie consent");
    const welcomeDialog = page.locator("#firstTimeUserDialog");
    await expect(welcomeDialog, "Welcome dialog NOT visible").toBeVisible();

    await page.reload();
    const welcomeDialogReload = page.locator("#firstTimeUserDialog");
    await expectNotificationToHave(page, "Cookie consent");
    await expect(welcomeDialogReload, "Welcome dialog visible after reload").not.toBeVisible();

    await screenshot(page, "A3", "Reload_state");

  });

});
