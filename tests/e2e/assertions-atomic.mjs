// Shared assertions for Troff E2E tests
import { expect } from "@playwright/test";

/**
 * Wait for an <audio> element to be attached and loaded (readyState >= 1 or loadedmetadata event)
 * @param {import('@playwright/test').Page} page
 * @param {number} timeoutMs
 * @returns {Promise<import('@playwright/test').Locator>} the audio element locator
 */
/**
 * Upload a file by clicking the first visible label[for="fileUploader"] and setting the file input.
 * @param {import('@playwright/test').Page} page
 * @param {string} filePath - Path to the file to upload
 * @param {string} [artifactPrefix] - Optional prefix for screenshots
 */
export async function uploadSongFile(page, filePath, artifactPrefix = "US") {
  // Find the label(s)
  const allLabels = await page
    .locator('label[for="fileUploader"][title*="Add songs"]')
    .all();
  let found = false;
  for (const [i, label] of allLabels.entries()) {
    if (await label.isVisible()) {
      await label.click({ force: true });
      found = true;
      if (artifactPrefix)
        await page.screenshot({
          path: `test-artifacts/${artifactPrefix}_b_after_label_click_${i}.png`,
          fullPage: true,
        });
      break;
    }
  }
  if (!found) {
    if (artifactPrefix)
      await page.screenshot({
        path: `test-artifacts/${artifactPrefix}_b_label_NOT_found.png`,
        fullPage: true,
      });
    throw new Error("No visible upload label found!");
  }
  if (artifactPrefix)
    await page.screenshot({
      path: `test-artifacts/${artifactPrefix}_b_after_label_click.png`,
      fullPage: true,
    });
  // Set the file input
  const input = await page.locator('input[type="file"]#fileUploader');
  if (artifactPrefix)
    await page.screenshot({
      path: `test-artifacts/${artifactPrefix}_c_before_upload.png`,
      fullPage: true,
    });
  await input.setInputFiles(filePath);
  if (artifactPrefix)
    await page.screenshot({
      path: `test-artifacts/${artifactPrefix}_c_after_upload.png`,
      fullPage: true,
    });
}

export async function waitForAudioLoaded(page, timeoutMs = 15000) {
  // Wait for <audio> to be attached
  const audioEl = await page.waitForSelector("audio", {
    timeout: timeoutMs,
    state: "attached",
  });
  if (!audioEl) {
    throw new Error("Audio element NOT found!");
  }
  // Force .load() in case browser needs a nudge
  await audioEl.evaluate((audio) => audio.load());
  // Wait for loadedmetadata event
  try {
    await audioEl.evaluate((audio) => {
      return new Promise((resolve, reject) => {
        if (audio.readyState >= 1) return resolve("already loaded");
        let timeout = setTimeout(
          () => reject("Timeout waiting for loadedmetadata"),
          15000
        );
        audio.addEventListener(
          "loadedmetadata",
          () => {
            clearTimeout(timeout);
            resolve("event fired");
          },
          { once: true }
        );
      });
    });
  } catch (err) {
    throw new Error(
      "Audio element found but loadedmetadata did not fire in time."
    );
  }
  return audioEl;
}

export async function assertMarkerExists(page, markerName) {
  const markerList = await page.locator("#markerList");
  await expect(markerList).toBeVisible();
  // Find button with value="Start"
  const markerBtn = markerList.locator(
    `input[type="button"][value="${markerName}"]`
  );

  const markerBtnCount = await markerBtn.count();
  expect(markerBtnCount, `Marker ${markerName} not found`).toBeGreaterThan(0);
}

export async function assertSectionVisible(page, sectionButtonName) {
  let buttonId = "";
  let sectionId = "";

  switch (sectionButtonName.toLowerCase()) {
    case "songs":
      buttonId = "buttSongsDialog";
      sectionId = "songPickerAttachedArea";
      break;
    case "states":
      buttonId = "statesTab";
      sectionId = "stateSection";
      break;
    case "settings":
      buttonId = "settingsTab";
      sectionId = "timeSection";
      break;
    case "info":
      buttonId = "infoTab";
      sectionId = "userNoteSection";
      break;
    case "countdown":
      buttonId = "countTab";
      sectionId = "infoSection";
      break;
    default:
      throw new Error(`Unknown section button name: ${sectionButtonName}`);
  }

  const section = await page.locator(`#${sectionId}`);
  await expect(
    section,
    `Section for button ${sectionButtonName} not found`
  ).toBeVisible();

  const button = await page.locator(`#${buttonId}`);
  const classAttr = await button.getAttribute("class");
  await expect(
    classAttr,
    `Button ${sectionButtonName} is not active`
  ).toContain("active");
}

export async function assertSongName(page, expectedSongText) {
  // Assert: div with id="currentSong" contains expected text
  const currentSong = await page.locator("#currentSong");
  await expect(
    currentSong,
    `Current song is not ${expectedSongText}`
  ).toContainText(expectedSongText.toLowerCase(), {
    ignoreCase: true,
  });
}
