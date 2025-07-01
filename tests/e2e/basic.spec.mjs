// Basic Playwright E2E test
import { test, expect } from '@playwright/test';

// Replace this URL with the local URL your app runs on, e.g. http://localhost:3000
const APP_URL = 'http://localhost:8000';

test.describe('Basic App Load', () => {
  test('should load the homepage and have a title', async ({ page }) => {
    await page.goto(APP_URL);
    // Check that the page title exists (customize as needed)
    await expect(page).toHaveTitle(/.+/);
  });
});
