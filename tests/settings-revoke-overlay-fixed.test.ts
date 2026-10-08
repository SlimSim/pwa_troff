import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SettingsPanel } from '../components/molecule/t-settings-panel.js';

// v2 surgical RED: revoke popup overlay must NOT scroll with settings content.
// Bug: .overlay.open + .revoke-popup (role=dialog) render inside the scrolling
// .panel-content flow of t-settings-panel, whose :host has
// overflow-y:auto + transform:translateY(-100%) when [visible]. A transformed
// ancestor makes position:fixed behave like absolute, so the dim background
// and popup scroll away with the settings list. Required: viewport-fixed
// overlay (body-level portal / <dialog> / direct panel root outside the scroll
// flow) with position:fixed + inset covering the viewport.
// These tests assert portal-out-of-flow structure AND fixed CSS together, so
// they are RED while the overlay stays inline in .panel-content.

type PanelWithState = SettingsPanel & { cookieConsentAccepted: boolean };

const CONSENT_KEY = 'TROFF_COOKIE_CONSENT_ACCEPTED';
const REVOKE_PROMPT = 'Revoking cookie consent requires a reload. Do you want to continue?';

describe('revoke popup overlay is viewport-fixed (t-settings-panel)', () => {
  let panel: PanelWithState;
  let reloadSpy: ReturnType<typeof vi.fn>;

  async function mountPanel(): Promise<void> {
    const mod = await import('../components/molecule/t-settings-panel.js');
    panel = new mod.SettingsPanel() as PanelWithState;
    document.body.appendChild(panel);
    await panel.updateComplete;
  }

  function getAdvancedDetails(): Element | null {
    const all = Array.from(panel.shadowRoot?.querySelectorAll('t-details') ?? []);
    return all.find((d) => d.getAttribute('title') === 'Advanced Settings') ?? null;
  }

  function findConsentButt(): HTMLElement | null {
    const butts = Array.from(panel.shadowRoot?.querySelectorAll('t-butt') ?? []);
    return (
      (butts.find((b) => /accept.*cook|cook.*consent/i.test(b.textContent ?? '')) as
        | HTMLElement
        | undefined) ?? null
    );
  }

  function findOverlay(): Element | null {
    return panel.shadowRoot?.querySelector('.overlay.open[role="dialog"]') ?? null;
  }

  function findBodyPortal(): Element | null {
    const candidates = Array.from(
      document.body.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog')
    );
    return (
      candidates.find((el) => {
        if (el === panel) return false;
        return (el.textContent ?? '').toLowerCase().includes('revoking cookie consent');
      }) ?? null
    );
  }

  function styleText(): string {
    // Lit stores component CSS in the static `styles` CSSResult (adopted
    // style sheets in happy-dom), not in a shadowRoot <style> tag, so read
    // the static result first and fall back to any inline <style> tags.
    const ctor = panel.constructor as unknown as {
      styles?: { cssText?: string } | Array<{ cssText?: string }>;
    };
    const statics = ctor.styles;
    const staticText = Array.isArray(statics)
      ? statics.map((s) => s.cssText ?? '').join('\n')
      : (statics?.cssText ?? '');
    const tagText = Array.from(panel.shadowRoot?.querySelectorAll('style') ?? [])
      .map((s) => s.textContent ?? '')
      .join('\n');
    return staticText + '\n' + tagText;
  }

  async function openRevokePopup(): Promise<Element> {
    localStorage.setItem(CONSENT_KEY, 'true');
    if (document.body.contains(panel)) document.body.removeChild(panel);
    await mountPanel();
    await panel.updateComplete;
    expect(panel.cookieConsentAccepted).toBe(true);
    const butt = findConsentButt();
    expect(butt, 'expected an "Accept cookies" t-butt before clicking').toBeTruthy();
    (butt as HTMLElement).click();
    await panel.updateComplete;
    const overlay = findOverlay();
    expect(overlay, 'expected .overlay.open[role="dialog"] after revoke click').toBeTruthy();
    // Same texts/actions are preserved (panel contract, already GREEN).
    expect((overlay as Element).textContent ?? '').toContain(REVOKE_PROMPT);
    expect((overlay as Element).querySelector('.revoke-popup')).toBeTruthy();
    const buttons = Array.from((overlay as Element).querySelectorAll('t-butt')).map(
      (b) => b.textContent ?? ''
    );
    expect(buttons.some((t) => /revoke.*reload/i.test(t))).toBe(true);
    expect(buttons.some((t) => /keep.*consent/i.test(t))).toBe(true);
    return overlay as Element;
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
    for (const el of Array.from(document.body.querySelectorAll('.popup, .overlay.open'))) {
      const host = el.getRootNode() as ShadowRoot | Document;
      const portalHost = (host as ShadowRoot).host as Element | undefined;
      if (portalHost !== undefined && portalHost !== panel) portalHost.remove();
      else if (host === document) el.remove();
    }
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('overlay is NOT inside the scrolling settings flow (body portal / dialog / direct panel root)', async () => {
    const overlay = await openRevokePopup();
    const advanced = getAdvancedDetails();
    expect(advanced, 'expected t-details[title="Advanced Settings"]').toBeTruthy();
    // The overlay must escape the scroll flow: not nested in .panel-content,
    // not nested in any t-details, not an inline flow div.
    expect(
      overlay.closest('.panel-content'),
      'RED: overlay is inline inside scrolling .panel-content; move it to a ' +
        'body-level portal, <dialog>, or direct panel root outside the scroll flow'
    ).toBeNull();
    expect(
      overlay.closest('t-details'),
      'RED: overlay is nested inside a scrolling t-details flow'
    ).toBeNull();
    // Body-level portal (or native <dialog>): the prompt lives outside the
    // panel shadow flow so host transform/scroll cannot move it.
    const portal = findBodyPortal();
    const isDialog = overlay.tagName === 'DIALOG' || portal?.tagName === 'DIALOG';
    expect(
      portal ?? (isDialog ? overlay : null),
      'RED: expected revoke dialog portalled to document.body (or a <dialog> ' +
        'element) so it stays viewport-fixed while settings scroll'
    ).toBeTruthy();
  });

  it('overlay has non-scrolling semantics: position:fixed + full-viewport inset AND escapes transformed host', async () => {
    const overlay = await openRevokePopup();
    // CSS half (already true today): fixed + inset covering the viewport.
    const css = styleText();
    expect(css).toContain('.overlay.open');
    expect(css).toMatch(/position\s*:\s*fixed/);
    expect(css).toMatch(/inset\s*:\s*0/);
    const computed = getComputedStyle(overlay);
    if ((computed.position ?? '') !== '') {
      expect(computed.position).toBe('fixed');
    }
    // Escape half (RED today): fixed is contained by the panel :host which has
    // overflow-y:auto + transform:translateY(-100%) when [visible], so fixed
    // behaves like absolute and scrolls. A real fix portals the dialog out.
    const portal = findBodyPortal();
    const isDialog = overlay.tagName === 'DIALOG' || portal?.tagName === 'DIALOG';
    const escapesFlow =
      overlay.closest('.panel-content') === null && (portal !== null || isDialog);
    expect(
      escapesFlow,
      'RED: .overlay.open declares position:fixed but stays inside the ' +
        'transformed/scrolling panel host, so it scrolls with content; portal ' +
        'it to document.body (or <dialog>) so viewport-fixed holds'
    ).toBe(true);
    // Scroll invariance: moving the settings scroll position must not move the
    // overlay. Portalled overlays satisfy this; inline-flow overlays do not.
    const host = panel as unknown as HTMLElement;
    const before = overlay.getBoundingClientRect().top;
    host.scrollTop = (host.scrollTop ?? 0) + 120;
    panel.shadowRoot?.querySelector('.panel-content')?.scrollTo?.(0, 200);
    await panel.updateComplete;
    const after = overlay.getBoundingClientRect().top;
    const invariantOrPortalled = before === after || portal !== null || isDialog;
    expect(
      invariantOrPortalled && escapesFlow,
      'RED: overlay bounding rect follows the settings scroll (or has no ' +
        'portal); viewport-fixed overlay must not move when the container scrolls'
    ).toBe(true);
  });
});
