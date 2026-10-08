import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { hasCookieConsent } from '../utils/cookie-consent.js';
import type { SettingsPanel } from '../components/molecule/t-settings-panel.js';

// v2 surgical: revoke confirm must be a real POPUP, not an inline div.
// Current (wrong): div.revoke-confirm inside t-settings-panel shadow root,
// nested in the Advanced Settings t-details list flow.
// Required: real popup/dialog element using the project's existing popup
// pattern (t-popover.ts / t-text-input-dialog.ts / t-import-dialog.ts /
// t-zoom-info-dialog.ts style): overlay layer (body-level portal or dialog
// open state), NOT inline in the Advanced list. Same texts + same actions.
// These tests REQUIRE popup semantics, so they are RED while the inline
// div.revoke-confirm exists.

type PanelWithConsent = SettingsPanel & { cookieConsentAccepted: boolean };

const CONSENT_KEY = 'TROFF_COOKIE_CONSENT_ACCEPTED';
const REVOKE_PROMPT = 'Revoking cookie consent requires a reload. Do you want to continue?';

describe('cookie revoke confirm is a popup (t-settings-panel)', () => {
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
      (butts.find((b) => /accept.*cook|cook.*consent/i.test(b.textContent ?? '')) as
        | HTMLElement
        | undefined) ?? null
    );
  }

  function findPopup(): Element | null {
    const root = panel.shadowRoot;
    if (root !== null && root !== undefined) {
      const inPanel =
        root.querySelector(
          '[role="dialog"], [role="alertdialog"], dialog, ' +
            't-popover[open], t-text-input-dialog[open], t-import-dialog[open], ' +
            't-zoom-info-dialog[open], .overlay.open, .popup'
        ) ?? null;
      if (inPanel !== null) return inPanel;
    }
    // Body-level portal (t-popover renders its .popup into document.body).
    const bodyCandidates = Array.from(
      document.body.querySelectorAll(
        '[role="dialog"], [role="alertdialog"], dialog, .popup, .overlay.open'
      )
    );
    const withPrompt = bodyCandidates.find((el) => {
      if (el === panel) return false;
      const text = el.textContent ?? '';
      return text.toLowerCase().includes('revoking cookie consent');
    });
    return withPrompt ?? null;
  }

  function findPopupButt(popup: Element, pattern: RegExp): HTMLElement | null {
    if (pattern.test(popup.textContent ?? '')) {
      const scope: Element | ShadowRoot =
        popup.shadowRoot !== null && popup.shadowRoot !== undefined
          ? (popup.shadowRoot as ShadowRoot)
          : popup;
      const butts = Array.from(scope.querySelectorAll('t-butt'));
      const hit = butts.find((b) => pattern.test(b.textContent ?? ''));
      if (hit !== undefined) return hit as HTMLElement;
    }
    // Fallback: popup may be a plain overlay div whose buttons are light-DOM
    // children of the same popup element in the panel shadow root.
    const butts = Array.from(popup.querySelectorAll('t-butt'));
    return (
      (butts.find((b) => pattern.test(b.textContent ?? '')) as HTMLElement | undefined) ?? null
    );
  }

  async function mountWithConsentGranted(): Promise<HTMLElement> {
    localStorage.setItem(CONSENT_KEY, 'true');
    if (panel !== undefined && document.body.contains(panel)) {
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

  async function openRevokePopup(): Promise<Element> {
    const butt = await mountWithConsentGranted();
    butt.click();
    await panel.updateComplete;
    // Prompt text is rendered (currently inline — popup assertion below is RED).
    const allText =
      (panel.shadowRoot?.textContent ?? '') + ' ' + (document.body.textContent ?? '');
    expect(allText.toLowerCase()).toContain(REVOKE_PROMPT.toLowerCase());
    const popup = findPopup();
    expect(
      popup,
      'expected revoke confirm in a real popup: [role=dialog/alertdialog], ' +
        '<dialog>, *-dialog[open], t-popover[open], .overlay.open, or body-level ' +
        '.popup — NOT an inline div.revoke-confirm'
    ).toBeTruthy();
    return popup as Element;
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
    if (panel !== undefined && document.body.contains(panel)) {
      document.body.removeChild(panel);
    }
    // Clean any body-level portal left by a popup implementation.
    for (const el of Array.from(document.body.querySelectorAll('.popup, .overlay.open'))) {
      const host = el.getRootNode() as ShadowRoot | Document;
      const portalHost = (host as ShadowRoot).host as Element | undefined;
      if (portalHost !== undefined && portalHost !== panel) portalHost.remove();
    }
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('revoke confirm renders in overlay layer, NOT inline inside the Advanced t-details list flow', async () => {
    await openRevokePopup();
    const advanced = getAdvancedDetails();
    expect(advanced, 'expected t-details[title="Advanced Settings"]').toBeTruthy();
    // Strengthened: nothing inline in the Advanced flow may carry the prompt.
    expect(advanced?.querySelector('.revoke-confirm')).toBeNull();
    expect((advanced?.textContent ?? '').toLowerCase()).not.toContain(
      REVOKE_PROMPT.toLowerCase()
    );
  });

  it('confirm "Revoke cookie consent and reload" from the popup persists revoke AND reloads', async () => {
    const popup = await openRevokePopup();
    const revokeButt = findPopupButt(popup, /revoke.*reload/i);
    expect(revokeButt, 'expected popup confirm button matching /revoke.*reload/i').toBeTruthy();
    (revokeButt as HTMLElement).click();
    await panel.updateComplete;

    expect(localStorage.getItem(CONSENT_KEY)).toBe('false');
    expect(hasCookieConsent()).toBe(false);
    expect(panel.cookieConsentAccepted).toBe(false);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('cancel "Keep cookie consent" from the popup changes nothing: no persist change, no reload, stays ON', async () => {
    const popup = await openRevokePopup();
    const keepButt = findPopupButt(popup, /keep.*consent/i);
    expect(keepButt, 'expected popup cancel button matching /keep.*consent/i').toBeTruthy();
    (keepButt as HTMLElement).click();
    await panel.updateComplete;

    expect(localStorage.getItem(CONSENT_KEY)).toBe('true');
    expect(hasCookieConsent()).toBe(true);
    expect(panel.cookieConsentAccepted).toBe(true);
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
