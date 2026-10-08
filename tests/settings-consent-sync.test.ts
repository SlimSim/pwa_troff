import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { COOKIE_CONSENT_KEY, setCookieConsent } from '../utils/cookie-consent.js';
import type { SettingsPanel } from '../components/molecule/t-settings-panel.js';

// v2 surgical: consent toggle syncs when granted via the boot toast.
// Bug: load app without consent -> boot toast asks -> press Accept ->
// settings "Accept cookies" button stays inactive (panel only read the store
// once in connectedCallback, never listens for `cookieConsentGiven`).
// Required: t-settings-panel cookieConsentAccepted reflects the live store.
// The panel must listen for the existing `cookieConsentGiven` document event
// (utils/cookie-consent.ts grant path, utils/sentry.ts listener, legacy
// assets/internal/cookie_consent.ts toast flow) and/or the storage event, so
// the toggle becomes active without reload. Both writers use the same
// localStorage key TROFF_COOKIE_CONSENT_ACCEPTED, so tests simulate the grant
// via the real helper AND via the legacy-style direct write + event.
// These tests are RED while the panel has no live sync listener.

type PanelWithConsent = SettingsPanel & { cookieConsentAccepted: boolean };

const CONSENT_KEY = 'TROFF_COOKIE_CONSENT_ACCEPTED';

describe('settings consent toggle syncs on boot-toast grant (t-settings-panel)', () => {
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

  function findConsentButt(): Element | null {
    const advanced = getAdvancedDetails();
    if (advanced === null) return null;
    const butts = Array.from(advanced.querySelectorAll('t-butt'));
    return butts.find((b) => /accept.*cook|cook.*consent/i.test(b.textContent ?? '')) ?? null;
  }

  async function flushPanel(): Promise<void> {
    await panel.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
    await panel.updateComplete;
  }

  beforeEach(async () => {
    localStorage.clear();
    expect(COOKIE_CONSENT_KEY).toBe(CONSENT_KEY);
    await mountPanel();
  });

  afterEach(() => {
    if (panel !== undefined && document.body.contains(panel)) {
      document.body.removeChild(panel);
    }
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts inactive when consent was never granted', async () => {
    await panel.updateComplete;
    expect(panel.cookieConsentAccepted).toBe(false);
    const butt = findConsentButt();
    expect(butt, 'expected an "Accept cookies" t-butt').toBeTruthy();
    expect(butt?.hasAttribute('active')).toBe(false);
  });

  it('grant via the real v2 helper (boot-toast Accept path) activates the toggle without reload', async () => {
    await panel.updateComplete;
    expect(panel.cookieConsentAccepted).toBe(false);

    // The boot toast grants consent through the shared store: same key +
    // same `cookieConsentGiven` document event the panel must observe.
    setCookieConsent(true);
    await flushPanel();

    expect(localStorage.getItem(CONSENT_KEY)).toBe('true');
    expect(panel.cookieConsentAccepted).toBe(true);
    const butt = findConsentButt();
    expect(butt, 'expected an "Accept cookies" t-butt').toBeTruthy();
    expect(butt?.hasAttribute('active')).toBe(true);
  });

  it('grant via legacy-style direct write + cookieConsentGiven event activates the toggle without reload', async () => {
    await panel.updateComplete;
    expect(panel.cookieConsentAccepted).toBe(false);

    // Legacy toast flow writes its own DB then dispatches the same event:
    // localStorage key TROFF_COOKIE_CONSENT_ACCEPTED = JSON "true" + event.
    localStorage.setItem(CONSENT_KEY, JSON.stringify(true));
    document.dispatchEvent(new Event('cookieConsentGiven'));
    await flushPanel();

    expect(panel.cookieConsentAccepted).toBe(true);
    const butt = findConsentButt();
    expect(butt, 'expected an "Accept cookies" t-butt').toBeTruthy();
    expect(butt?.hasAttribute('active')).toBe(true);
  });

  it('revoke elsewhere deactivates the toggle without reload', async () => {
    setCookieConsent(true);
    await flushPanel();
    expect(panel.cookieConsentAccepted).toBe(true);

    // Revoke persists "false" and dispatches nothing, so the panel must stay
    // in sync via the store (storage event from another tab/context).
    localStorage.setItem(CONSENT_KEY, 'false');
    window.dispatchEvent(
      new StorageEvent('storage', { key: CONSENT_KEY, newValue: 'false' })
    );
    await flushPanel();

    expect(panel.cookieConsentAccepted).toBe(false);
    const butt = findConsentButt();
    expect(butt, 'expected an "Accept cookies" t-butt').toBeTruthy();
    expect(butt?.hasAttribute('active')).toBe(false);
  });
});
