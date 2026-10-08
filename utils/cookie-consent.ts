/**
 * Cookie-consent store (v2).
 *
 * Single source of truth for the consent key that gates Sentry startup.
 * Granting consent persists `"true"` and dispatches `cookieConsentGiven`
 * (utils/sentry.ts listens for it); revoking persists `"false"` and
 * dispatches nothing so Sentry never inits on next boot.
 */

export const COOKIE_CONSENT_KEY = 'TROFF_COOKIE_CONSENT_ACCEPTED';

export function hasCookieConsent(): boolean {
  return localStorage.getItem(COOKIE_CONSENT_KEY) === 'true';
}

export function setCookieConsent(accepted: boolean): void {
  localStorage.setItem(COOKIE_CONSENT_KEY, accepted ? 'true' : 'false');
  if (accepted) {
    document.dispatchEvent(new Event('cookieConsentGiven'));
  }
}
