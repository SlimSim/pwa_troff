import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BottomNav } from '../components/molecule/t-footer.js';

/**
 * Feature: "Larger play button on mobile" must also apply on tablets (iPad /
 * Android tablets), which are wide (>768px) but touch devices.
 *
 * Contract under test:
 *  1. utils/browserEnv.ts exports isTablet(): boolean, true for tablets only
 *     and false (never throwing) otherwise.
 *  2. t-footer's BottomNav sets a `tablet` attribute on its host when the
 *     device is a tablet (absent otherwise).
 *  3. The min-width:768px reset of --play-button-size is scoped with
 *     :host(:not([tablet])) so tablets keep the larger button.
 *  4. Both play buttons remain inside .play-button-wrapper (mobile unchanged).
 *
 * Nothing is re-implemented here: isTablet, BottomNav and its CSS come from
 * the real source modules.
 */

// Mock Firebase and nDB — never call real services in tests (vi.hoisted so the
// factories can close over the mocks).
const { nDBGetMock, nDBSetMock } = vi.hoisted(() => ({
  nDBGetMock: vi.fn(),
  nDBSetMock: vi.fn(),
}));
vi.mock('../assets/internal/db.js', () => ({
  nDB: {
    get: nDBGetMock,
    set: nDBSetMock,
    setOnSong: vi.fn(),
  },
}));
vi.mock('../services/firebaseClient.js', () => ({}));

// Controllable isTablet mock (same hoisted-getter pattern as
// components/organisms/t-video-player.test.ts uses for isAndroid).
const mockBrowserEnv = vi.hoisted(() => ({ isTablet: false }));
vi.mock('../utils/browserEnv.js', () => ({
  isTablet: () => mockBrowserEnv.isTablet,
  isSafari: false,
  isIphone: false,
  isIpad: false,
  isAndroid: false,
  isPhone: false,
  usePhoneLog: false,
  isMessengerInAppBrowser: () => false,
}));

type BrowserEnvWithIsTablet = { isTablet: () => boolean };

/**
 * The real browserEnv module is file-level mocked (for the BottomNav tests).
 * vi.importActual bypasses that mock; resetModules + a navigator stub before
 * the import make any module-load UA reads (isSafari, isPhone, ...) match the
 * simulated device.
 */
async function importRealIsTablet(
  nav: { userAgent?: unknown; maxTouchPoints?: number } | undefined
): Promise<() => boolean> {
  vi.stubGlobal('navigator', nav);
  vi.resetModules();
  const mod = (await vi.importActual(
    '../utils/browserEnv.js'
  )) as unknown as BrowserEnvWithIsTablet;
  return mod.isTablet;
}

const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const ANDROID_TABLET_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const ANDROID_PHONE_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function collectCssText(root: ShadowRoot | null): string {
  if (!root) return '';
  const parts: string[] = [];
  root.querySelectorAll('style').forEach((style) => {
    parts.push(style.textContent ?? '');
  });
  const sheets: CSSStyleSheet[] = root.adoptedStyleSheets ?? [];
  for (const sheet of sheets) {
    try {
      for (let i = 0; i < sheet.cssRules.length; i++) {
        const rule = sheet.cssRules[i];
        if (rule) {
          parts.push(rule.cssText);
        }
      }
    } catch {
      // ignore unreadable sheets
    }
  }
  return parts.join('\n');
}

describe('isTablet() in utils/browserEnv.ts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('is exported as a function', async () => {
    const isTablet = await importRealIsTablet({ userAgent: WINDOWS_UA, maxTouchPoints: 0 });
    expect(typeof isTablet).toBe('function');
  });

  it('returns true for an iPad UA', async () => {
    const isTablet = await importRealIsTablet({ userAgent: IPAD_UA, maxTouchPoints: 0 });
    expect(isTablet()).toBe(true);
  });

  it('returns true for iPadOS 13+ desktop-mode (Macintosh UA + maxTouchPoints > 1)', async () => {
    const isTablet = await importRealIsTablet({ userAgent: IPAD_DESKTOP_UA, maxTouchPoints: 5 });
    expect(isTablet()).toBe(true);
  });

  it('returns true for an Android tablet UA (Android, no "Mobile")', async () => {
    const isTablet = await importRealIsTablet({
      userAgent: ANDROID_TABLET_UA,
      maxTouchPoints: 5,
    });
    expect(isTablet()).toBe(true);
  });

  it('returns false for an iPhone UA', async () => {
    const isTablet = await importRealIsTablet({ userAgent: IPHONE_UA, maxTouchPoints: 5 });
    expect(isTablet()).toBe(false);
  });

  it('returns false for an Android phone UA (Android + "Mobile")', async () => {
    const isTablet = await importRealIsTablet({
      userAgent: ANDROID_PHONE_UA,
      maxTouchPoints: 5,
    });
    expect(isTablet()).toBe(false);
  });

  it('returns false for a desktop Mac UA with maxTouchPoints <= 1', async () => {
    const isTabletNone = await importRealIsTablet({
      userAgent: IPAD_DESKTOP_UA,
      maxTouchPoints: 0,
    });
    expect(isTabletNone()).toBe(false);

    const isTabletOne = await importRealIsTablet({
      userAgent: IPAD_DESKTOP_UA,
      maxTouchPoints: 1,
    });
    expect(isTabletOne()).toBe(false);
  });

  it('returns false for a Windows desktop UA', async () => {
    const isTablet = await importRealIsTablet({ userAgent: WINDOWS_UA, maxTouchPoints: 0 });
    expect(isTablet()).toBe(false);
  });

  it('returns false when navigator.userAgent is not a string (must not throw)', async () => {
    // Import with a tablet UA so a cached-constant implementation cannot pass by
    // accident; isTablet must read navigator safely at call time.
    const isTablet = await importRealIsTablet({ userAgent: IPAD_UA, maxTouchPoints: 5 });
    vi.stubGlobal('navigator', { userAgent: undefined, maxTouchPoints: 5 });
    expect(() => isTablet()).not.toThrow();
    expect(isTablet()).toBe(false);
  });

  it('returns false when navigator is unavailable (must not throw)', async () => {
    const isTablet = await importRealIsTablet({ userAgent: IPAD_DESKTOP_UA, maxTouchPoints: 5 });
    vi.stubGlobal('navigator', undefined);
    expect(() => isTablet()).not.toThrow();
    expect(isTablet()).toBe(false);
  });
});

describe('BottomNav tablet host attribute (components/molecule/t-footer.ts)', () => {
  let footer: BottomNav | undefined;

  const createFooter = async (): Promise<BottomNav> => {
    const el = new BottomNav();
    document.body.appendChild(el);
    await el.updateComplete;
    return el;
  };

  beforeEach(() => {
    nDBGetMock.mockReset();
    nDBGetMock.mockReturnValue(null);
    nDBSetMock.mockReset();
    mockBrowserEnv.isTablet = false;
  });

  afterEach(() => {
    if (footer && document.body.contains(footer)) {
      document.body.removeChild(footer);
    }
    footer = undefined;
  });

  it('adds the "tablet" attribute on the host when isTablet() is true', async () => {
    mockBrowserEnv.isTablet = true;
    footer = await createFooter();
    expect(footer.hasAttribute('tablet')).toBe(true);
  });

  it('does NOT add the "tablet" attribute when isTablet() is false', async () => {
    mockBrowserEnv.isTablet = false;
    footer = await createFooter();
    expect(footer.hasAttribute('tablet')).toBe(false);
  });

  it('removes a stale "tablet" attribute on reconnect when isTablet() is false', async () => {
    mockBrowserEnv.isTablet = false;
    footer = await createFooter();
    footer.setAttribute('tablet', '');
    document.body.removeChild(footer);
    document.body.appendChild(footer);
    await footer.updateComplete;
    expect(footer.hasAttribute('tablet')).toBe(false);
  });
});

describe('t-footer wide-screen reset is scoped for tablets', () => {
  let footer: BottomNav;

  beforeEach(async () => {
    nDBGetMock.mockReset();
    nDBGetMock.mockReturnValue(null);
    mockBrowserEnv.isTablet = false;
    footer = new BottomNav();
    document.body.appendChild(footer);
    await footer.updateComplete;
  });

  afterEach(() => {
    if (footer && document.body.contains(footer)) {
      document.body.removeChild(footer);
    }
  });

  it('the 768px --play-button-size reset only applies to :host(:not([tablet]))', () => {
    const css = collectCssText(footer.shadowRoot);
    const compact = css.replace(/\s+/g, ' ');

    expect(
      compact,
      `expected scoped selector :host(:not([tablet])) in footer CSS.\nCSS:\n${compact}`
    ).toContain(':host(:not([tablet]))');

    expect(
      compact,
      `expected @media (min-width: 768px) to scope the --play-button-size reset to non-tablet hosts.\nCSS:\n${compact}`
    ).toMatch(
      /@media \(min-width: 768px\) \{ [^}]*:host\(:not\(\[tablet\]\)\) [^}]*\.play-button-wrapper \{ [^}]*--play-button-size: 3\.2rem/
    );

    expect(
      compact,
      `the old unconditional @media (min-width: 768px) { .play-button-wrapper { ... } } reset must be gone.\nCSS:\n${compact}`
    ).not.toMatch(/@media \(min-width: 768px\) \{ \.play-button-wrapper \{/);
  });

  it('keeps both play buttons inside .play-button-wrapper (mobile behaviour unchanged)', () => {
    const wrapper = footer.shadowRoot?.querySelector('.play-button-wrapper');
    expect(wrapper, 'expected a .play-button-wrapper in the footer').toBeTruthy();
    const main = wrapper?.querySelector('.main-play-button');
    const quick = wrapper?.querySelector('.quick-play-button');
    expect(main, 'expected .main-play-button inside .play-button-wrapper').toBeTruthy();
    expect(quick, 'expected .quick-play-button inside .play-button-wrapper').toBeTruthy();
  });
});
