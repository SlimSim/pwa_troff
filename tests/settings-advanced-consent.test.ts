import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Feature contract under test (NOT yet implemented → these tests are RED):
// Advanced settings gains an "Accept cookies" toggle whose state reflects
// cookie consent. Source of truth is the same key v2Script.ts checks at boot:
//   localStorage.getItem('TROFF_COOKIE_CONSENT_ACCEPTED') === 'true'
// (key comment points at assets/internal/cookie_consent.ts — legacy, DO NOT
// import). Granting must dispatch `cookieConsentGiven` (utils/sentry.ts already
// listens for it and calls addAndStartSentry); revoking persists false and
// must NOT dispatch (so Sentry never inits on next boot).
//
// Expected v2 API (new file utils/cookie-consent.ts):
//   COOKIE_CONSENT_KEY, hasCookieConsent(), setCookieConsent(accepted: boolean)
// plus a `cookieConsentAccepted` property + <t-butt toggle> labelled
// "Accept cookies" inside the Advanced Settings t-details of t-settings-panel.
import {
  COOKIE_CONSENT_KEY,
  hasCookieConsent,
  setCookieConsent,
} from '../utils/cookie-consent.js';

import type { SettingsPanel } from '../components/molecule/t-settings-panel.js';

type PanelWithConsent = SettingsPanel & { cookieConsentAccepted?: boolean };

const CONSENT_KEY = 'TROFF_COOKIE_CONSENT_ACCEPTED';

describe('cookie-consent store (utils/cookie-consent.js)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('uses the v2 Sentry boot key as source of truth', () => {
    expect(COOKIE_CONSENT_KEY).toBe(CONSENT_KEY);
  });

  it('hasCookieConsent() is false when nothing is stored', () => {
    expect(hasCookieConsent()).toBe(false);
  });

  it('hasCookieConsent() reflects stored "true"', () => {
    localStorage.setItem(CONSENT_KEY, 'true');
    expect(hasCookieConsent()).toBe(true);
  });

  it('setCookieConsent(true) persists "true" and dispatches cookieConsentGiven', () => {
    const seen: Event[] = [];
    const onGrant = (event: Event): void => {
      seen.push(event);
    };
    document.addEventListener('cookieConsentGiven', onGrant);
    try {
      setCookieConsent(true);
      expect(localStorage.getItem(CONSENT_KEY)).toBe('true');
      expect(hasCookieConsent()).toBe(true);
      expect(seen.length).toBe(1);
    } finally {
      document.removeEventListener('cookieConsentGiven', onGrant);
    }
  });

  it('setCookieConsent(false) persists "false" and does NOT dispatch cookieConsentGiven', () => {
    localStorage.setItem(CONSENT_KEY, 'true');
    const onGrant = vi.fn();
    document.addEventListener('cookieConsentGiven', onGrant);
    try {
      setCookieConsent(false);
      expect(localStorage.getItem(CONSENT_KEY)).toBe('false');
      expect(hasCookieConsent()).toBe(false);
      expect(onGrant).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('cookieConsentGiven', onGrant);
    }
  });
});

describe('Advanced settings cookie-consent toggle (t-settings-panel)', () => {
  let panel: PanelWithConsent;

  async function mountPanel(): Promise<void> {
    const mod = await import('../components/molecule/t-settings-panel.js');
    panel = new mod.SettingsPanel() as PanelWithConsent;
    document.body.appendChild(panel);
    await panel.updateComplete;
  }

  function getAdvancedDetails(): Element | null {
    const all = Array.from(panel.shadowRoot?.querySelectorAll('t-details') ?? []);
    return all.find((d) => d.getAttribute('title') === 'Advanced Settings') ?? null;
  }

  function findConsentButt(advanced: Element): Element | null {
    const butts = Array.from(advanced.querySelectorAll('t-butt'));
    return (
      butts.find((b) => /accept.*cook|cook.*consent/i.test(b.textContent ?? '')) ?? null
    );
  }

  beforeEach(async () => {
    localStorage.clear();
    await mountPanel();
  });

  afterEach(() => {
    if (panel && document.body.contains(panel)) {
      document.body.removeChild(panel);
    }
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('exposes cookieConsentAccepted = false when consent was never granted', async () => {
    await panel.updateComplete;
    expect(panel.cookieConsentAccepted).toBe(false);
  });

  it('exposes cookieConsentAccepted = true when consent was granted before open', async () => {
    localStorage.setItem(CONSENT_KEY, 'true');
    if (document.body.contains(panel)) {
      document.body.removeChild(panel);
    }
    await mountPanel();
    expect(panel.cookieConsentAccepted).toBe(true);
  });

  it('renders a <t-butt toggle> labelled "Accept cookies" inside Advanced Settings', async () => {
    await panel.updateComplete;
    const advanced = getAdvancedDetails();
    expect(advanced, 'expected t-details[title="Advanced Settings"]').toBeTruthy();
    const butt = findConsentButt(advanced as Element);
    expect(butt, 'expected an "Accept cookies" t-butt in Advanced Settings').toBeTruthy();
    expect(butt?.hasAttribute('toggle')).toBe(true);
  });

  it('toggle reflects state: OFF when consent is false', async () => {
    await panel.updateComplete;
    const advanced = getAdvancedDetails();
    const butt = findConsentButt(advanced as Element);
    expect(butt, 'expected an "Accept cookies" t-butt').toBeTruthy();
    expect(panel.cookieConsentAccepted).toBe(false);
    expect(butt?.hasAttribute('active')).toBe(false);
  });

  it('clicking the toggle grants consent: persists "true" and dispatches cookieConsentGiven', async () => {
    await panel.updateComplete;
    const advanced = getAdvancedDetails();
    const butt = findConsentButt(advanced as Element);
    expect(butt, 'expected an "Accept cookies" t-butt before clicking').toBeTruthy();

    const seen: Event[] = [];
    const onGrant = (event: Event): void => {
      seen.push(event);
    };
    document.addEventListener('cookieConsentGiven', onGrant);
    try {
      (butt as HTMLElement).click();
      await panel.updateComplete;

      expect(localStorage.getItem(CONSENT_KEY)).toBe('true');
      expect(panel.cookieConsentAccepted).toBe(true);
      expect(seen.length).toBe(1);
    } finally {
      document.removeEventListener('cookieConsentGiven', onGrant);
    }
  });

  it('clicking the toggle again revokes consent via confirm: persists "false" and dispatches nothing', async () => {
    localStorage.setItem(CONSENT_KEY, 'true');
    if (document.body.contains(panel)) {
      document.body.removeChild(panel);
    }
    await mountPanel();

    const advanced = getAdvancedDetails();
    const butt = findConsentButt(advanced as Element);
    expect(butt, 'expected an "Accept cookies" t-butt before clicking').toBeTruthy();

    const onGrant = vi.fn();
    document.addEventListener('cookieConsentGiven', onGrant);
    const originalReload = Object.getOwnPropertyDescriptor(window.location, 'reload');
    const reloadSpy = vi.fn();
    Object.defineProperty(window.location, 'reload', {
      value: reloadSpy,
      configurable: true,
      writable: true,
    });
    try {
      (butt as HTMLElement).click();
      await panel.updateComplete;

      const revokeButt =
        Array.from(panel.shadowRoot?.querySelectorAll('t-butt') ?? []).find((b) =>
          /revoke.*reload/i.test(b.textContent ?? '')
        ) ?? null;
      expect(revokeButt, 'expected a confirm button matching /revoke.*reload/i').toBeTruthy();
      (revokeButt as HTMLElement).click();
      await panel.updateComplete;

      expect(localStorage.getItem(CONSENT_KEY)).toBe('false');
      expect(panel.cookieConsentAccepted).toBe(false);
      expect(onGrant).not.toHaveBeenCalled();
      expect(reloadSpy).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener('cookieConsentGiven', onGrant);
      if (originalReload !== undefined) {
        Object.defineProperty(window.location, 'reload', originalReload);
      }
    }
  });
});
