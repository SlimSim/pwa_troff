import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Feature spec — Clear logs button (follow-up, surgical):
// Advanced settings already has "Copy logs" (t-settings-panel.ts). Add a
// "Clear logs" button ON THE SAME ROW as "Copy logs" (same flex
// container/row, not a new section, not moving Copy).
// - Label matches /clear.*log/i, rendered as <t-butt> (not raw <button>).
// - Click calls existing clearConsoleBuffer() from utils/console-buffer.ts.
// - After clear, getConsoleEntries() is empty (except possibly a single
//   clear-confirmation entry — prefer none).
// - Optional toast confirming cleared via showToast pattern, never alert().
// These tests are RED until the panel adds the button.
import {
  installConsoleBuffer,
  uninstallConsoleBuffer,
  clearConsoleBuffer,
  getConsoleEntries,
} from '../utils/console-buffer.js';
import type { SettingsPanel } from '../components/molecule/t-settings-panel.js';

vi.mock('../utils/notification.js', () => ({
  showToast: vi.fn(),
}));

async function mountPanel(): Promise<SettingsPanel> {
  const mod = await import('../components/molecule/t-settings-panel.js');
  const panel = new mod.SettingsPanel() as SettingsPanel;
  document.body.appendChild(panel);
  await panel.updateComplete;
  return panel;
}

function getAdvancedDetails(panel: SettingsPanel): Element | null {
  const all = Array.from(panel.shadowRoot?.querySelectorAll('t-details') ?? []);
  return all.find((d) => d.getAttribute('title') === 'Advanced Settings') ?? null;
}

function findButtByLabel(root: ParentNode, re: RegExp): Element | null {
  const butts = Array.from(root.querySelectorAll('t-butt'));
  return butts.find((b) => re.test(b.textContent ?? '')) ?? null;
}

describe('Advanced settings Clear logs button (t-settings-panel)', () => {
  let panel: SettingsPanel | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    installConsoleBuffer();
    clearConsoleBuffer();
  });

  afterEach(async () => {
    if (panel && document.body.contains(panel)) {
      document.body.removeChild(panel);
    }
    panel = null;
    uninstallConsoleBuffer();
    vi.restoreAllMocks();
  });

  it('renders a <t-butt> labelled "Clear logs" (/clear.*log/i) inside Advanced Settings', async () => {
    panel = await mountPanel();
    await panel.updateComplete;
    const advanced = getAdvancedDetails(panel);
    expect(advanced, 'expected t-details[title="Advanced Settings"]').toBeTruthy();
    const clearButt = findButtByLabel(advanced as Element, /clear.*log/i);
    expect(clearButt, 'expected a "Clear logs" t-butt in Advanced Settings').toBeTruthy();
    expect(clearButt?.tagName.toLowerCase()).toBe('t-butt');
  });

  it('places "Clear logs" in the SAME row container as "Copy logs" (same parent, no move)', async () => {
    panel = await mountPanel();
    await panel.updateComplete;
    const advanced = getAdvancedDetails(panel);
    expect(advanced).toBeTruthy();
    const copyButt = findButtByLabel(advanced as Element, /copy.*log/i);
    const clearButt = findButtByLabel(advanced as Element, /clear.*log/i);
    expect(copyButt, 'expected existing "Copy logs" t-butt').toBeTruthy();
    expect(clearButt, 'expected new "Clear logs" t-butt').toBeTruthy();
    expect(clearButt?.parentElement).toBeTruthy();
    expect(clearButt?.parentElement).toBe(copyButt?.parentElement);
  });

  it('clicking "Clear logs" empties the console buffer via clearConsoleBuffer()', async () => {
    panel = await mountPanel();
    await panel.updateComplete;
    console.log('clear-logs-seed-marker');
    expect(
      getConsoleEntries().some((e) => e.message.includes('clear-logs-seed-marker'))
    ).toBe(true);

    const advanced = getAdvancedDetails(panel);
    const clearButt = findButtByLabel(advanced as Element, /clear.*log/i);
    expect(clearButt, 'expected a "Clear logs" t-butt before clicking').toBeTruthy();

    (clearButt as HTMLElement).click();
    await panel.updateComplete;

    const entries = getConsoleEntries();
    // Prefer zero entries; tolerate a single clear-confirmation entry.
    expect(entries.length).toBeLessThanOrEqual(1);
    if (entries.length === 1) {
      expect(entries[0]?.message ?? '').toMatch(/clear/i);
    }
  });

  it('clicking "Clear logs" never calls alert()', async () => {
    panel = await mountPanel();
    await panel.updateComplete;
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    try {
      console.log('clear-logs-no-alert-marker');
      const advanced = getAdvancedDetails(panel);
      const clearButt = findButtByLabel(advanced as Element, /clear.*log/i);
      expect(clearButt, 'expected a "Clear logs" t-butt before clicking').toBeTruthy();
      (clearButt as HTMLElement).click();
      await panel.updateComplete;
      expect(alertSpy).not.toHaveBeenCalled();
    } finally {
      alertSpy.mockRestore();
    }
  });
});
