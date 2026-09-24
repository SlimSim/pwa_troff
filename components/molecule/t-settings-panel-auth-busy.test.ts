import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type SettingsPanelType = import('./t-settings-panel.js').SettingsPanel;

/**
 * Type-safe view of the authBusy contract on t-settings-panel:
 * `@property({ type: Boolean }) authBusy = false` (public, settable from
 * outside). The intersection cast keeps this test file valid both before
 * (RED) and after the property exists — no `any`, no @ts-expect-error that
 * would break once the feature lands.
 */
type SettingsPanelAuth = SettingsPanelType & { authBusy: boolean };

/**
 * Sign-in / sign-out busy state on the settings panel auth buttons.
 *
 * While `authBusy === true`:
 *  - a <t-loading> must be present in the panel shadow root,
 *  - the normal labelled auth t-butt ("Sign in" / "Sign out") must either be
 *    absent or carry the disabled attribute (t-butt reflects `disabled`), so
 *    a second click cannot re-dispatch `sign-in-requested`.
 * When authBusy returns to false, the normal buttons are restored.
 */
describe('t-settings-panel authBusy (sign-in/sign-out busy state)', () => {
  let settingsPanel: SettingsPanelType;

  beforeEach(async () => {
    // Dynamic import — child element registrations happen once (ESM cache),
    // same pattern as tests/settings-panel.test.ts.
    const { SettingsPanel } = await import('./t-settings-panel.js');

    settingsPanel = new SettingsPanel();
    document.body.appendChild(settingsPanel);
    await settingsPanel.updateComplete;
  });

  afterEach(() => {
    if (settingsPanel && document.body.contains(settingsPanel)) {
      document.body.removeChild(settingsPanel);
    }
    vi.restoreAllMocks();
  });

  /** Find a t-butt in the panel shadow root whose full label matches exactly. */
  function findButtByLabel(label: string): Element | null {
    const butts = Array.from(settingsPanel.shadowRoot?.querySelectorAll('t-butt') ?? []);
    return butts.find((b) => (b.textContent || '').trim() === label) ?? null;
  }

  /**
   * While busy the labelled auth button must not be an active control:
   * either it is gone from the DOM, or it has the disabled attribute.
   */
  function expectNoActiveButt(label: string) {
    const butt = findButtByLabel(label);
    if (butt) {
      expect(butt.hasAttribute('disabled')).toBe(true);
    }
  }

  it('1. defaults authBusy to false and renders a normal active Sign in button', async () => {
    const panel = settingsPanel as SettingsPanelAuth;
    expect(panel.authBusy).toBe(false);

    const signIn = findButtByLabel('Sign in');
    expect(signIn).toBeTruthy();
    expect(signIn!.hasAttribute('disabled')).toBe(false);
    expect(settingsPanel.shadowRoot?.querySelector('t-loading')).toBeFalsy();
  });

  it('2. authBusy=true while signed out shows t-loading + "Signing in" text and no active Sign in button', async () => {
    const panel = settingsPanel as SettingsPanelAuth;
    panel.authBusy = true;
    await settingsPanel.updateComplete;

    const shadow = settingsPanel.shadowRoot!;
    expect(shadow.querySelector('t-loading')).toBeTruthy();
    expect(shadow.textContent).toMatch(/Signing in/i);
    expectNoActiveButt('Sign in');
  });

  it('3. authBusy=true while signed in shows busy UI for the sign-out path', async () => {
    const panel = settingsPanel as SettingsPanelAuth;
    panel.signedIn = true;
    panel.authBusy = true;
    await settingsPanel.updateComplete;

    const shadow = settingsPanel.shadowRoot!;
    // Contract: busy sign-out shows t-loading ("Signing out…" text or at
    // least the t-loading indicator).
    expect(shadow.querySelector('t-loading')).toBeTruthy();
    expectNoActiveButt('Sign out');
  });

  it('4. clearing authBusy (false again) restores the normal Sign in button', async () => {
    const panel = settingsPanel as SettingsPanelAuth;

    panel.authBusy = true;
    await settingsPanel.updateComplete;
    expect(settingsPanel.shadowRoot?.querySelector('t-loading')).toBeTruthy();

    panel.authBusy = false;
    await settingsPanel.updateComplete;

    const shadow = settingsPanel.shadowRoot!;
    expect(shadow.querySelector('t-loading')).toBeFalsy();

    const signIn = findButtByLabel('Sign in');
    expect(signIn).toBeTruthy();
    expect(signIn!.hasAttribute('disabled')).toBe(false);
  });
});
