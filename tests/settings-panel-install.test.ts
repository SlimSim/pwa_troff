import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Tests for the "Install Troff" button in the settings panel.
 *
 * t-settings-panel renders an "Install Troff" t-butt in .panel-header (driven
 * by utils/pwa.ts) only while the PWA install state is 'available', and hides
 * it again once the app is installed.
 */

// Type-only imports — erased at runtime, so they never trigger resolution errors.
type SettingsPanelType = import('../components/molecule/t-settings-panel.js').SettingsPanel;
type PwaModule = typeof import('../utils/pwa.js');

/** Minimal stand-in for the browser's BeforeInstallPromptEvent. */
class MockBeforeInstallPromptEvent extends Event {
  preventDefault = vi.fn();
  prompt = vi.fn(() => Promise.resolve());
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;

  constructor(outcome: 'accepted' | 'dismissed' = 'accepted') {
    super('beforeinstallprompt');
    this.userChoice = Promise.resolve({ outcome });
  }
}

describe('SettingsPanel Install Troff button', () => {
  let settingsPanel: SettingsPanelType;
  let pwa: PwaModule;

  beforeEach(async () => {
    vi.resetModules();

    // Silence network fetches for manifest and icons in happy-dom (no dev server)
    const fetchMock = vi.fn(() => Promise.reject(new Error('network disabled in test')));
    vi.stubGlobal('fetch', fetchMock);
    // Make requestAnimationFrame fire synchronously
    const raf = (cb: Function) => {
      cb();
      return 0;
    };
    vi.stubGlobal('requestAnimationFrame', raf);

    // Ignore duplicate custom element registrations that happen when multiple
    // tests re-import the panel module (which re-runs @customElement).
    const registry = customElements;
    const originalDefine = registry.define.bind(registry);
    const patched = Object.create(registry);
    patched.define = (
      name: string,
      constructor: CustomElementConstructor,
      options?: ElementDefinitionOptions
    ) => {
      if (!registry.get(name)) {
        originalDefine(name, constructor, options);
      }
    };
    vi.stubGlobal('customElements', patched);

    // Fresh module state for BOTH the pwa module and the panel per test.
    pwa = await import('../utils/pwa.js');
    await import('../components/molecule/t-settings-panel.js');

    // Construct via createElement (like tap-tempo tests): happy-dom's
    // NodeFactory can only support `new SettingsPanel()` once per fork.
    settingsPanel = document.createElement('t-settings-panel') as SettingsPanelType;
    document.body.appendChild(settingsPanel);
    await settingsPanel.updateComplete;
    // Yield so the dynamic import in connectedCallback resolves and the
    // install-state subscription is wired before tests dispatch events.
    await new Promise<void>((r) => setTimeout(r, 0));
  });

  afterEach(() => {
    if (settingsPanel && document.body.contains(settingsPanel)) {
      document.body.removeChild(settingsPanel);
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function findInstallButt(): Element | null {
    const butts = Array.from(settingsPanel.shadowRoot?.querySelectorAll('t-butt') || []);
    return (
      butts.find((b) => (b.textContent || '').trim().toLowerCase() === 'install troff') || null
    );
  }

  function panelHeader(): HTMLElement | null {
    return settingsPanel.shadowRoot?.querySelector('.panel-header') || null;
  }

  it('hides Install Troff by default and shows it once install becomes available', async () => {
    // Default install state is 'unavailable' → no Install Troff button
    expect(findInstallButt()).toBeNull();
    expect(panelHeader()?.textContent || '').not.toContain('Install');

    // Make install available → the button must appear (RED until implemented)
    pwa.initPwa();
    window.dispatchEvent(new MockBeforeInstallPromptEvent('accepted'));
    await settingsPanel.updateComplete;

    expect(findInstallButt()).toBeTruthy();
  });

  it('does not show Install Troff when the app is already installed', async () => {
    pwa.initPwa();
    window.dispatchEvent(new Event('appinstalled'));
    await settingsPanel.updateComplete;

    expect(findInstallButt()).toBeNull();
    expect(panelHeader()?.textContent || '').not.toContain('Install');
  });

  it('calls prompt() when the Install Troff button is clicked', async () => {
    pwa.initPwa();
    const event = new MockBeforeInstallPromptEvent('accepted');
    window.dispatchEvent(event);
    await settingsPanel.updateComplete;

    const installButt = findInstallButt();
    expect(installButt).toBeTruthy();

    installButt?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    // _handleInstallClick dynamically imports pwa.ts before calling promptInstall
    await vi.waitFor(() => {
      expect(event.prompt).toHaveBeenCalledTimes(1);
    });
  });

  it('hides the Install Troff button after the user accepts the install prompt', async () => {
    pwa.initPwa();
    window.dispatchEvent(new MockBeforeInstallPromptEvent('accepted'));
    await settingsPanel.updateComplete;

    const installButt = findInstallButt();
    expect(installButt).toBeTruthy();

    installButt?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    // State becomes 'installed' → the button disappears again
    await vi.waitFor(() => {
      expect(findInstallButt()).toBeNull();
    });
  });
});
