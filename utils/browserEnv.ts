/** UA string at import time; empty when navigator/userAgent is unavailable. */
function readUserAgent(): string {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') {
      return '';
    }
    return navigator.userAgent;
  } catch {
    return '';
  }
}

const initialUserAgent = readUserAgent();

export const isSafari: boolean = /^((?!chrome|android).)*safari/i.test(initialUserAgent);
export const isIphone: boolean = initialUserAgent.indexOf('iPhone') !== -1;
export const isIpad: boolean = initialUserAgent.indexOf('iPad') !== -1;
export const isAndroid: boolean = /Android/i.test(initialUserAgent);

export const isPhone: boolean = /Android|iPhone|iPad/i.test(initialUserAgent);

export const usePhoneLog = isPhone;

/**
 * Detects tablets (iPad, iPadOS 13+ desktop mode, Android tablets) at call time.
 * Never throws when navigator is unavailable.
 */
export function isTablet(): boolean {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') {
      return false;
    }
    const ua = navigator.userAgent;
    if (/iPad/i.test(ua)) {
      return true;
    }
    if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) {
      return true;
    }
    return /Android/i.test(ua) && !/Mobile/i.test(ua);
  } catch {
    return false;
  }
}

/**
 * Detects iOS-family browsers (iPhone, iPad, iPod, iPadOS desktop mode) at call
 * time. Never throws when navigator is unavailable.
 */
export function isIOSFamily(): boolean {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') {
      return false;
    }
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) {
      return true;
    }
    if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isMessengerInAppBrowser(userAgent?: string): boolean {
  try {
    let ua = userAgent;
    if (typeof ua === 'undefined') {
      if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') {
        return false;
      }
      ua = navigator.userAgent;
    }
    if (typeof ua !== 'string' || ua.length === 0) {
      return false;
    }
    return /FBAN|FBAV|FB_IAB|Messenger/i.test(ua);
  } catch {
    return false;
  }
}
