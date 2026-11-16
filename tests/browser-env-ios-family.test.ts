import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * FEATURE SPEC: utils/browserEnv.ts must export a call-time, never-throwing
 * `isIOSFamily(): boolean`:
 *  - true when navigator.userAgent matches /iPhone|iPad|iPod/,
 *  - true for iPadOS 13+ desktop mode (/Macintosh/ UA + maxTouchPoints > 1),
 *  - false for Windows / Android / desktop Mac (maxTouchPoints <= 1),
 *  - false when navigator is missing, userAgent is missing/non-string, or
 *    anything throws.
 *
 * The module-scope UA constants (isSafari, isIphone, isIpad, isAndroid,
 * isPhone, usePhoneLog) must also stop throwing when navigator is `{}` or
 * navigator.userAgent is undefined — importing the real module with such a
 * navigator must succeed and yield `false` for every constant.
 *
 * Every assertion exercises the REAL utils/browserEnv.ts: the module is
 * re-imported after vi.resetModules() with a stubbed navigator, and nothing is
 * re-implemented here.
 */

interface BrowserEnvModule {
  isSafari: boolean;
  isIphone: boolean;
  isIpad: boolean;
  isAndroid: boolean;
  isPhone: boolean;
  usePhoneLog: boolean;
  isIOSFamily?: () => boolean;
}

/** Stub navigator, drop the module cache, then import the real module. */
async function importBrowserEnv(nav: unknown): Promise<BrowserEnvModule> {
  vi.stubGlobal('navigator', nav);
  vi.resetModules();
  return (await import('../utils/browserEnv.js')) as unknown as BrowserEnvModule;
}

/**
 * Call the real isIOSFamily(), failing with an explicit message while the
 * export is still missing (RED state).
 */
function callIsIOSFamily(mod: BrowserEnvModule): boolean {
  const fn = mod.isIOSFamily;
  if (typeof fn !== 'function') {
    throw new Error('utils/browserEnv.ts must export isIOSFamily(): boolean');
  }
  return fn();
}

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1';
const IPOD_UA =
  'Mozilla/5.0 (iPod touch; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1';
const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1';
const MAC_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15';
const WINDOWS_CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const ANDROID_PHONE_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('isIOSFamily() in utils/browserEnv.ts', () => {
  it('is exported as a function', async () => {
    const mod = await importBrowserEnv({ userAgent: WINDOWS_CHROME_UA, maxTouchPoints: 0 });
    expect(typeof mod.isIOSFamily).toBe('function');
  });

  it('returns true for an iPhone UA', async () => {
    const mod = await importBrowserEnv({ userAgent: IPHONE_UA, maxTouchPoints: 5 });
    expect(callIsIOSFamily(mod)).toBe(true);
  });

  it('returns true for an iPod UA', async () => {
    const mod = await importBrowserEnv({ userAgent: IPOD_UA, maxTouchPoints: 5 });
    expect(callIsIOSFamily(mod)).toBe(true);
  });

  it('returns true for an iPad UA', async () => {
    const mod = await importBrowserEnv({ userAgent: IPAD_UA, maxTouchPoints: 5 });
    expect(callIsIOSFamily(mod)).toBe(true);
  });

  it('returns true for iPadOS desktop mode (Macintosh UA + maxTouchPoints 5)', async () => {
    const mod = await importBrowserEnv({ userAgent: MAC_DESKTOP_UA, maxTouchPoints: 5 });
    expect(callIsIOSFamily(mod)).toBe(true);
  });

  it('returns false for a desktop Mac (Macintosh UA + maxTouchPoints 0)', async () => {
    const mod = await importBrowserEnv({ userAgent: MAC_DESKTOP_UA, maxTouchPoints: 0 });
    expect(callIsIOSFamily(mod)).toBe(false);
  });

  it('returns false for a desktop Mac with a single touch point', async () => {
    const mod = await importBrowserEnv({ userAgent: MAC_DESKTOP_UA, maxTouchPoints: 1 });
    expect(callIsIOSFamily(mod)).toBe(false);
  });

  it('returns false for Windows Chrome', async () => {
    const mod = await importBrowserEnv({ userAgent: WINDOWS_CHROME_UA, maxTouchPoints: 0 });
    expect(callIsIOSFamily(mod)).toBe(false);
  });

  it('returns false for an Android phone', async () => {
    const mod = await importBrowserEnv({ userAgent: ANDROID_PHONE_UA, maxTouchPoints: 5 });
    expect(callIsIOSFamily(mod)).toBe(false);
  });

  it('returns false when navigator is unavailable (must not throw)', async () => {
    // Import with an iPhone UA so a cached-constant implementation cannot pass
    // by accident; isIOSFamily must read navigator safely at call time.
    const mod = await importBrowserEnv({ userAgent: IPHONE_UA, maxTouchPoints: 5 });
    vi.stubGlobal('navigator', undefined);
    expect(() => callIsIOSFamily(mod)).not.toThrow();
    expect(callIsIOSFamily(mod)).toBe(false);
  });

  it('returns false when navigator.userAgent is undefined (must not throw)', async () => {
    const mod = await importBrowserEnv({ userAgent: IPHONE_UA, maxTouchPoints: 5 });
    vi.stubGlobal('navigator', { userAgent: undefined, maxTouchPoints: 5 });
    expect(() => callIsIOSFamily(mod)).not.toThrow();
    expect(callIsIOSFamily(mod)).toBe(false);
  });

  it('returns false when navigator.userAgent is not a string (must not throw)', async () => {
    const mod = await importBrowserEnv({ userAgent: IPHONE_UA, maxTouchPoints: 5 });
    vi.stubGlobal('navigator', { userAgent: 42, maxTouchPoints: 5 });
    expect(() => callIsIOSFamily(mod)).not.toThrow();
    expect(callIsIOSFamily(mod)).toBe(false);
  });
});

describe('module-scope UA constants tolerate a missing navigator.userAgent', () => {
  it('importing with navigator = {} does not throw and every UA constant is false', async () => {
    const mod = await importBrowserEnv({});
    expect(mod.isSafari).toBe(false);
    expect(mod.isIphone).toBe(false);
    expect(mod.isIpad).toBe(false);
    expect(mod.isAndroid).toBe(false);
    expect(mod.isPhone).toBe(false);
    expect(mod.usePhoneLog).toBe(false);
    expect(callIsIOSFamily(mod)).toBe(false);
  });

  it('importing with navigator.userAgent undefined does not throw', async () => {
    const mod = await importBrowserEnv({ userAgent: undefined });
    expect(mod.isSafari).toBe(false);
    expect(mod.isIphone).toBe(false);
    expect(mod.isIpad).toBe(false);
    expect(mod.isAndroid).toBe(false);
    expect(mod.isPhone).toBe(false);
  });
});
