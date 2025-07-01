# Playwright E2E Tests

## How to run E2E tests

1. **Start your app locally**
   - Make sure your app is running and accessible at the URL specified in `basic.spec.mjs` (default is `http://localhost:3000`).
   - If your app runs on another port or path, update the `APP_URL` variable in the test file.

2. **Run Playwright tests**
   ```sh
   npx playwright test tests/e2e
   ```
   This will run all Playwright tests in the `tests/e2e` directory.

3. **If you get errors about missing browsers:**
   ```sh
   npx playwright install
   ```
   This will download the necessary browser binaries.

---

- You can add more `.spec.mjs` files in this folder for additional E2E tests.
- See the [Playwright docs](https://playwright.dev/docs/intro) for more details.
