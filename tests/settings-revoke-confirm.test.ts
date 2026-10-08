import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { hasCookieConsent } from '../utils/cookie-consent.js';
import type { SettingsPanel } from '../components/molecule/t-settings-panel.js';

// Feature: revoking cookie consent (ON -> OFF) must show a confirm popup:
//   "Revoking cookie consent requires a reload. Do you want to continue?"
// with confirm "Revoke cookie consent and reload" (persists false + reloads)
// and cancel "Keep cookie consent" (no persist change, no reload, stays ON).
// Grant path (OFF -> ON) is unchanged: no popup, immediate persist + dispatch.
// Dialog patterns checked: t-text-input-dialog.ts / t-import-dialog.ts are
// single-purpose dialogs (no generic t-confirm exists); t-butt `confirm`
// (two-click inline) does not match this spec's explicit Revoke/Keep popup,
// so the panel is expected to render a small inline Lit confirm state.
// These tests assert the specified popup UI + behavior and are RED until
// t-settings-panel implements the revoke-confirm flow.

type PanelWithConsent = SettingsPanel & { cookieConsentAccepted: boolean };

const CONSENT_KEY = 'TROFF_COOKIE_CONSENT_ACCEPTED';
const REVOKE_PROMPT = 'Revoking cookie consent requires a reload. Do you want to continue?';

describe('cookie revoke confirm popup (t-settings-panel)', () => {
  let panel: PanelWithConsent;
  let reloadSpy: ReturnType<typeof vi.fn>;

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

  function findConsentButt(advanced: Element): HTMLElement | null {
    const butts = Array.from(advanced.querySelectorAll('t-butt'));
    return (
      (butts.find((b) => /accept.*cook|cook.*consent/i.test(b.textContent ?? '')) as HTMLElement | undefined) ??
      null
    );
  }

  function findRevokeButt(): HTMLElement | null {
    const butts = Array.from(panel.shadowRoot?.querySelectorAll('t-butt') ?? []);
    return (
      (butts.find((b) => /revoke.*reload/i.test(b.textContent ?? '')) as HTMLElement | undefined) ??
      null
    );
  }

  function findKeepButt(): HTMLElement | null {
    const butts = Array.from(panel.shadowRoot?.querySelectorAll('t-butt') ?? []);
    return (
      (butts.find((b) => /keep.*consent/i.test(b.textContent ?? '')) as HTMLElement | undefined) ??
      null
    );
  }

  async function mountWithConsentGranted(): Promise<HTMLElement> {
    localStorage.setItem(CONSENT_KEY, 'true');
    if (panel && document.body.contains(panel)) {
      document.body.removeChild(panel);
    }
    await mountPanel();
    await panel.updateComplete;
    expect(panel.cookieConsentAccepted).toBe(true);
    const advanced = getAdvancedDetails();
    expect(advanced, 'expected t-details[title="Advanced Settings"]').toBeTruthy();
    const butt = findConsentButt(advanced as Element);
    expect(butt, 'expected an "Accept cookies" t-butt before clicking').toBeTruthy();
    return butt as HTMLElement;
  }

  beforeEach(async () => {
    localStorage.clear();
    reloadSpy = vi.fn();
    Object.defineProperty(window.location, 'reload', {
      value: reloadSpy,
      configurable: true,
      writable: true,
    });
    await mountPanel();
  });

  afterEach(() => {
    if (panel && document.body.contains(panel)) {
      document.body.removeChild(panel);
    }
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('revoke click shows popup asking "Revoking cookie consent requires a reload. Do you want to continue?"', async () => {
    const butt = await mountWithConsentGranted();
    butt.click();
    await panel.updateComplete;

    const text = panel.shadowRoot?.textContent ?? '';
    expect(text.toLowerCase()).toContain(REVOKE_PROMPT.toLowerCase());
  });

  it('confirm "Revoke cookie consent and reload" persists revoke AND reloads the app', async () => {
    const butt = await mountWithConsentGranted();
    butt.click();
    await panel.updateComplete;

    const revokeButt = findRevokeButt();
    expect(revokeButt, 'expected a confirm button matching /revoke.*reload/i').toBeTruthy();
    (revokeButt as HTMLElement).click();
    await panel.updateComplete;

    expect(localStorage.getItem(CONSENT_KEY)).toBe('false');
    expect(hasCookieConsent()).toBe(false);
    expect(panel.cookieConsentAccepted).toBe(false);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('cancel "Keep cookie consent" changes nothing: no persist change, no reload, toggle stays ON', async () => {
    const butt = await mountWithConsentGranted();
    butt.click();
    await panel.updateComplete;

    const keepButt = findKeepButt();
    expect(keepButt, 'expected a cancel button matching /keep.*consent/i').toBeTruthy();
    (keepButt as HTMLElement).click();
    await panel.updateComplete;

    expect(localStorage.getItem(CONSENT_KEY)).toBe('true');
    expect(hasCookieConsent()).toBe(true);
    expect(panel.cookieConsentAccepted).toBe(true);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('grant path (OFF -> ON) shows no popup: immediate persist + dispatch', async () => {
    await panel.updateComplete;
    expect(panel.cookieConsentAccepted).toBe(false);
    const advanced = getAdvancedDetails();
    const butt = findConsentButt(advanced as Element);
    expect(butt, 'expected an "Accept cookies" t-butt before clicking').toBeTruthy();

    const seen: Event[] = [];
    const onGrant = (event: Event): void => {
      seen.push(event);
    };
    document.addEventListener('cookieConsentGiven', onGrant);
    try {
      butt?.click();
      await panel.updateComplete;

      expect(localStorage.getItem(CONSENT_KEY)).toBe('true');
      expect(panel.cookieConsentAccepted).toBe(true);
      expect(seen.length).toBe(1);
      const text = panel.shadowRoot?.textContent ?? '';
      expect(text.toLowerCase()).not.toContain(REVOKE_PROMPT.toLowerCase());
      expect(findRevokeButt()).toBeNull();
      expect(reloadSpy).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('cookieConsentGiven', onGrant);
    }
  });
});
