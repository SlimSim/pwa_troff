import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';

// NEVER re-implement: import the actual function under test.
vi.mock('../utils/notification.js', () => ({
  showToast: vi.fn(),
}));

import { showToast } from '../utils/notification.js';
import { maybeShowMessengerBrowserNotice } from '../utils/messengerBrowser.js';

const CHROME_DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const MESSENGER_ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UP1A.231105.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 FBAN/MessengerForAndroid;FBAV/456.0.0.0.123;';

type ToastAction = { label: string; onClick: () => void };

function setUserAgent(ua: string): void {
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: ua,
  });
}

function getToastArgs(): [string, string, number, ToastAction?] | undefined {
  const mocked = vi.mocked(showToast);
  if (mocked.mock.calls.length === 0) return undefined;
  return mocked.mock.calls[0] as unknown as [string, string, number, ToastAction?];
}

describe('maybeShowMessengerBrowserNotice (copy-only)', () => {
  const originalUserAgent = navigator.userAgent;
  const originalClipboard = (navigator as Navigator & { clipboard?: unknown }).clipboard;
  let openSpy: MockInstance<typeof window.open> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    openSpy?.mockRestore();
    openSpy = null;
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
    if (typeof originalClipboard === 'undefined') {
      delete (navigator as Omit<Navigator, 'clipboard'> & { clipboard?: unknown }).clipboard;
    } else {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      });
    }
    vi.restoreAllMocks();
  });

  it('(a) shows no toast when UA is normal Chrome', () => {
    setUserAgent(CHROME_DESKTOP_UA);
    maybeShowMessengerBrowserNotice();
    expect(vi.mocked(showToast)).not.toHaveBeenCalled();
  });

  it("(b) shows a sticky info toast mentioning Messenger + system/native browser when UA is Messenger", () => {
    setUserAgent(MESSENGER_ANDROID_UA);
    maybeShowMessengerBrowserNotice();
    expect(vi.mocked(showToast)).toHaveBeenCalledTimes(1);
    const args = getToastArgs();
    expect(args).toBeTruthy();
    const [message, type, duration] = args as [string, string, number, ToastAction?];
    expect(message).toMatch(/Messenger/i);
    expect(message).toMatch(/system browser|native browser|works better/i);
    expect(type).toBe('info');
    expect(duration).toBe(0);
  });

  it('(c) action label is exactly "Copy link"', () => {
    setUserAgent(MESSENGER_ANDROID_UA);
    maybeShowMessengerBrowserNotice();
    const args = getToastArgs();
    expect(args).toBeTruthy();
    const action = (args as [string, string, number, ToastAction?])[3];
    expect(action).toBeTruthy();
    expect(action?.label).toBe('Copy link');
  });

  it('(d) invoking the action copies location.href and never calls window.open', async () => {
    setUserAgent(MESSENGER_ANDROID_UA);
    maybeShowMessengerBrowserNotice();
    const args = getToastArgs();
    const action = (args as [string, string, number, ToastAction?])[3];
    expect(action).toBeTruthy();

    const writeText = vi.mocked(
      (navigator.clipboard as unknown as { writeText: (...a: string[]) => Promise<void> }).writeText
    );
    writeText.mockClear();
    openSpy?.mockClear();

    action?.onClick();
    await Promise.resolve();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(window.open).not.toHaveBeenCalled();
  });
});
