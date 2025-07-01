// E2E test: Welcome dialog + consent + screenshot
import { test, expect } from "@playwright/test";
import { closeWelcomeDialog, consentNotification } from "./helpers/helpers.mjs";
import { APP_URL } from "./helpers/constants.mjs";

test.describe("Dialog & Consent flow", () => {
  test("should load app, OK welcome, consent, screenshot", async ({ page }) => {
    await page.goto(APP_URL);
    // Assert: Welcome dialog is visible and contains correct h2
    const welcomeDialog = page.locator("#firstTimeUserDialog");
    await expect(welcomeDialog).toBeVisible();
    const welcomeH2 = welcomeDialog.locator("h2");
    await expect(welcomeH2).toContainText("Welcome to the music player Troff");
    await closeWelcomeDialog(page);
    // Assert: Consent notification is visible and contains correct h2
    const consentNotify = page.locator(
      '.notifyjs-wrapper:has(h2:text("Cookie consent"))'
    );
    await expect(consentNotify).toBeVisible();
    const consentH2 = consentNotify.locator("h2");
    await expect(consentH2).toContainText("Cookie consent");
    await consentNotification(page);
    // Take screenshot for verification
    await page.screenshot({
      path: "test-artifacts/DCF_Startup_state.png",
      fullPage: true,
    });
    // Assert: notification is visible in the top right with the correct text
    const notify = page.locator(".notifyjs-corner");
    await expect(notify).toBeVisible();
    await expect(notify).toContainText(
      "Troff is now cached and will work offline"
    );
  });
});
