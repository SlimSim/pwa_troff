// Shared assertions for Troff E2E tests

import {
  assertMarkerExists,
  assertSectionVisible,
  assertSongName,
} from "./assertions-atomic.mjs";

/**
 * Assert the main UI state after a song is loaded (downloaded or uploaded)
 * @param {import('@playwright/test').Page} page
 * @param {string} expectedSongText Substring expected in #currentSong (e.g., 'A Lion' or 'A horse')
 */
export async function assertSongLoadedUI(page, expectedSongText) {
  await assertSectionVisible(page, "Settings");
  await assertSongName(page, expectedSongText);
  await assertMarkerExists(page, "Start");
  await assertMarkerExists(page, "End");
}
