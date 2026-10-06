// Assumptions (per feature spec):
// - Meta in-app browser can only be detected heuristically via User-Agent. It typically
//   contains tokens like FBAN, FBAV, FB_IAB, or Messenger (e.g. `FBAN/MessengerForAndroid`,
//   `FBAN/FBIOS`, `FB_IAB/FB4A`). Custom Tabs may hide this — detection is best-effort,
//   not guaranteed.
// - A website CANNOT programmatically close Messenger and force-open the default browser
//   or installed PWA. The best we can do is: (a) show a message, (b) offer an action that
//   tries `window.open(url, '_blank')` / intent navigation on Android and falls back to
//   copy-link + manual instructions ("tap ... > Open in external browser").
// - Simplicity first: minimal pure functions + reuse existing `utils/notification.ts`
//   showToast with action (do NOT create new Lit components, do NOT use native <button>).

import { describe, it, expect } from 'vitest';

// NEVER re-implement: import the actual function under test.
import { isMessengerInAppBrowser } from '../utils/browserEnv.js';

const CHROME_DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const CHROME_ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

const MESSENGER_ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UP1A.231105.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 FBAN/MessengerForAndroid;FBAV/456.0.0.0.123;';

const FACEBOOK_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 FBAN/FBIOS;FBAV/456.0.0.0.123;FBBV/123456789;FBDV/iPhone16,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5;FBRV/0;FB_IAB/FB4A;';

describe('isMessengerInAppBrowser', () => {
  it('returns false for normal Chrome desktop UA', () => {
    expect(isMessengerInAppBrowser(CHROME_DESKTOP_UA)).toBe(false);
  });

  it('returns false for normal Chrome Android UA', () => {
    expect(isMessengerInAppBrowser(CHROME_ANDROID_UA)).toBe(false);
  });

  it('returns true for Messenger Android UA containing FBAN/Messenger', () => {
    expect(isMessengerInAppBrowser(MESSENGER_ANDROID_UA)).toBe(true);
  });

  it('returns true for Facebook iOS UA containing FBAN/FBIOS/FB_IAB', () => {
    expect(isMessengerInAppBrowser(FACEBOOK_IOS_UA)).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(isMessengerInAppBrowser('mozilla fban/messengerforandroid')).toBe(true);
    expect(isMessengerInAppBrowser('fb_iab/fb4a')).toBe(true);
    expect(isMessengerInAppBrowser('something MESSENGER something')).toBe(true);
  });

  it('returns false and does not throw for empty/undefined UA', () => {
    expect(() => isMessengerInAppBrowser('')).not.toThrow();
    expect(isMessengerInAppBrowser('')).toBe(false);
    expect(() => isMessengerInAppBrowser(undefined)).not.toThrow();
    expect(isMessengerInAppBrowser(undefined)).toBe(false);
  });
});
