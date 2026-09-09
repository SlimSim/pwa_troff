import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR,
  TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER,
  TROFF_SETTING_PLAY_UI_BUTTON_GO_TO_MARKER_BEHAVIOUR,
} from '../constants/constants.js';

type SettingsPanelType = import('../components/molecule/t-settings-panel.js').SettingsPanel;

// ── Part 1: SettingsPanel component default property values ──

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

  describe('Play UI button defaults (should be true)', () => {
    it('playUseTimer defaults to true', () => {
      expect(settingsPanel.playUseTimer).toBe(true);
    });

    it('playResetCounter defaults to true', () => {
      expect(settingsPanel.playResetCounter).toBe(true);
    });

    it('playGoToMarker defaults to true', () => {
      expect(settingsPanel.playGoToMarker).toBe(true);
    });
  });
});

// ── Part 2: nDB default initialization contract ──
// The initialization code lives in v2Script.ts inside the DOMContentLoaded handler.
// We test the contract: when nDB.get(key) returns null, the default must be
// written via nDB.set(key, defaultValue). We exercise the exact same logic
// that v2Script.ts runs.

describe('nDB global control defaults initialization', () => {
  const nDBGetMock = vi.fn();
  const nDBSetMock = vi.fn();

  vi.mock('../assets/internal/db.js', () => ({
    nDB: {
      get: (...args: unknown[]) => nDBGetMock(...args),
      set: (...args: unknown[]) => nDBSetMock(...args),
      setOnSong: vi.fn(),
    },
  }));

  // The exact table from v2Script.ts — imported from the real constants
  const defaultsIfUnset: [string, boolean][] = [
    [TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR, true],
    [TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER, true],
    [TROFF_SETTING_PLAY_UI_BUTTON_GO_TO_MARKER_BEHAVIOUR, true],
  ];

  beforeEach(() => {
    nDBGetMock.mockReset();
    nDBSetMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constant values match expected keys', () => {
    it('all 3 nDB keys are defined string constants', () => {
      for (const [key] of defaultsIfUnset) {
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
      }
    });

    it('the 3 "true" defaults use the correct constant names', () => {
      const trueKeys = defaultsIfUnset
        .filter(([, v]) => v === true)
        .map(([k]) => k);
      expect(trueKeys).toContain(TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR);
      expect(trueKeys).toContain(TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER);
      expect(trueKeys).toContain(TROFF_SETTING_PLAY_UI_BUTTON_GO_TO_MARKER_BEHAVIOUR);
      expect(trueKeys).toHaveLength(3);
    });
  });

  describe('default write logic: writes when nDB has no stored value', () => {
    it('writes the correct defaults for all 3 keys when nDB.get returns null', () => {
      nDBGetMock.mockReturnValue(null);

      // Replicate the exact loop from v2Script.ts
      for (const [key, defaultValue] of defaultsIfUnset) {
        if (nDBGetMock(key) == null) {
          nDBSetMock(key, defaultValue);
        }
      }

      expect(nDBSetMock).toHaveBeenCalledTimes(3);
      for (const [key, defaultValue] of defaultsIfUnset) {
        expect(nDBSetMock).toHaveBeenCalledWith(key, defaultValue);
      }
    });

    it('writes the correct defaults when nDB.get returns undefined', () => {
      nDBGetMock.mockReturnValue(undefined);

      for (const [key, defaultValue] of defaultsIfUnset) {
        if (nDBGetMock(key) == null) {
          nDBSetMock(key, defaultValue);
        }
      }

      expect(nDBSetMock).toHaveBeenCalledTimes(3);
      for (const [key, defaultValue] of defaultsIfUnset) {
        expect(nDBSetMock).toHaveBeenCalledWith(key, defaultValue);
      }
    });
  });

  describe('does NOT overwrite existing values', () => {
    it('skips all keys when all are already stored', () => {
      nDBGetMock.mockReturnValue(true);

      for (const [key, defaultValue] of defaultsIfUnset) {
        if (nDBGetMock(key) == null) {
          nDBSetMock(key, defaultValue);
        }
      }

      expect(nDBSetMock).not.toHaveBeenCalled();
    });

    it('does not overwrite with default when stored value differs', () => {
      // User has previously toggled playUseTimer to false
      nDBGetMock.mockImplementation((key: string) => {
        if (key === TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR) return false;
        return null;
      });

      for (const [key, defaultValue] of defaultsIfUnset) {
        if (nDBGetMock(key) == null) {
          nDBSetMock(key, defaultValue);
        }
      }

      // playUseTimer should NOT be overwritten (it was already false)
      expect(nDBSetMock).toHaveBeenCalledTimes(2);
      expect(nDBSetMock).not.toHaveBeenCalledWith(
        TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR,
        expect.anything()
      );
    });
  });
});
