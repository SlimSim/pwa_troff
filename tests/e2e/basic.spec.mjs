// Basic Playwright E2E test
import { test, expect } from '@playwright/test';
import { APP_URL } from './constants.mjs';

test.describe('Basic App Load', () => {
  test('should load the homepage and have a title', async ({ page }) => {
    await page.goto(APP_URL);
    // Check that the page title exists (customize as needed)
    await expect(page).toHaveTitle(/.+/);
  });
});
