import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type SettingsPanelType = import('../components/molecule/t-settings-panel.js').SettingsPanel;

// ── SettingsPanel component no longer has play button behavior properties ──
// The play button now always: seeks to start marker, uses timer, resets counter.

describe('SettingsPanel global control default properties', () => {
  let settingsPanel: SettingsPanelType;

  beforeEach(async () => {
    const { SettingsPanel } = await import('../components/molecule/t-settings-panel.js');
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

  it('should not have play button behavior properties (removed)', () => {
    // These properties were removed since play button behavior is now hardcoded
    const panel = settingsPanel as unknown as Record<string, unknown>;
    expect(panel.playUseTimer).toBeUndefined();
    expect(panel.playResetCounter).toBeUndefined();
    expect(panel.playGoToMarker).toBeUndefined();
  });
});
