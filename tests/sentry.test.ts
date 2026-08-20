// Tests for utils/sentry.ts — Sentry observability with v1/v2 app-generation tagging.
//
// Feature contract under test (implemented — these tests are GREEN):
//   1. utils/sentry.ts exports setSentryApp(generation: 'v1' | 'v2').
//   2. Sentry.init receives tags: { app: generation }, defaulting to 'v1'
//      (legacy pages — v1 script.ts / find.ts — never call setSentryApp, so
//      their events must be tagged app: 'v1' without any modification).
//   3. setSentryApp('v2') before addAndStartSentry() results in tags: { app: 'v2' }.
//   4. SentryCaptureException forwards the error to the global Sentry.captureException.
//
// The tests import the REAL module (../utils/sentry.js) — nothing is reimplemented.
// The real Sentry SDK is never loaded: a typed mock is installed on globalThis so
// checkSentry()'s `typeof Sentry !== 'undefined'` resolves synchronously (no timers).
// The cookieConsentGiven listener registered at import time is harmless — tests
// call addAndStartSentry() directly.

import { describe, it, expect, vi } from 'vitest';

// ---- Types ----------------------------------------------------------------

// Shape of the Sentry.init options. `tags` does not exist in the current
// implementation — it is part of the feature contract under test.
interface SentryInitOptions {
  dsn: string;
  environment: string;
  release: string;
  sendDefaultPii: boolean;
  beforeSend: (event: unknown) => unknown;
  tags?: { app: 'v1' | 'v2' };
}

// Future contract shape of the utils/sentry.js module. setSentryApp is not yet
// exported by the current code — the cast keeps the test type-safe while still
// hitting the real (missing) export at runtime.
interface SentryModule {
  SentryCaptureException: (error: Error) => void;
  setSentryVersion: (v: string) => void;
  setSentryEnvironment: (env: string) => void;
  setSentryApp: (generation: 'v1' | 'v2') => void;
  addAndStartSentry: () => void;
}

// ---- Helpers --------------------------------------------------------------

// Install a typed mock as the global `Sentry` (declared `const` in
// utils/sentry.ts) so checkSentry() resolves synchronously and the SDK script
// is never loaded. Object.assign on globalThis avoids TS complaints about the
// declared global const.
function installSentryMock() {
  const mock = {
    init: vi.fn<(options: SentryInitOptions) => void>(),
    captureException: vi.fn<(error: Error) => void>(),
  };
  Object.assign(globalThis, { Sentry: mock });
  return mock;
}

// Load a FRESH copy of the real module per test — version/environment/
// generation are module-level mutable state, so vi.resetModules() + dynamic
// import gives each test a clean slate.
async function loadSentryModule() {
  vi.resetModules();
  const sentryMock = installSentryMock();
  const module = (await import('../utils/sentry.js')) as SentryModule;
  return { module, sentryMock };
}

// ---- Tests ----------------------------------------------------------------

describe('utils/sentry.ts — app-generation tagging', () => {
  it('calls Sentry.init with tags.app === "v1" when setSentryApp was never called (legacy default)', async () => {
    const { module, sentryMock } = await loadSentryModule();

    module.addAndStartSentry();

    const initOptions = sentryMock.init.mock.calls[0]![0];
    expect(initOptions?.tags?.app).toBe('v1');
    // Full contract: the init options carry tags: { app: 'v1' } as a whole.
    expect(sentryMock.init).toHaveBeenCalledWith(
      expect.objectContaining({ tags: { app: 'v1' } })
    );
  });

  it('calls Sentry.init with tags.app === "v2" after setSentryApp("v2") before addAndStartSentry()', async () => {
    const { module, sentryMock } = await loadSentryModule();

    module.setSentryApp('v2');
    module.addAndStartSentry();

    const initOptions = sentryMock.init.mock.calls[0]![0];
    expect(initOptions?.tags?.app).toBe('v2');
    // Full contract: the init options carry tags: { app: 'v2' } as a whole.
    expect(sentryMock.init).toHaveBeenCalledWith(
      expect.objectContaining({ tags: { app: 'v2' } })
    );
  });

  it('forwards exceptions to the global Sentry.captureException', async () => {
    const { module, sentryMock } = await loadSentryModule();

    const error = new Error('boom');
    module.SentryCaptureException(error);

    expect(sentryMock.captureException).toHaveBeenCalledWith(error);
  });
});
