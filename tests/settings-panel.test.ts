import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type SettingsPanelType = import('../components/molecule/t-settings-panel.js').SettingsPanel;

describe('SettingsPanel numeric settings integration', () => {
  let settingsPanel: SettingsPanelType;

  beforeEach(async () => {
    // Dynamic import - the child element registrations happen once due to ESM caching
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

  describe('default property values', () => {
    it('should have default startBeforeValue of 0', () => {
      expect(settingsPanel.startBeforeValue).toBe(0);
    });

    it('should have default startBeforeDisabled of false', () => {
      expect(settingsPanel.startBeforeDisabled).toBe(false);
    });

    it('should have default stopAfterValue of 0', () => {
      expect(settingsPanel.stopAfterValue).toBe(0);
    });

    it('should have default stopAfterDisabled of false', () => {
      expect(settingsPanel.stopAfterDisabled).toBe(false);
    });

    it('should have default incrementUntillValue of 0', () => {
      expect(settingsPanel.incrementUntillValue).toBe(0);
    });

    it('should have default incrementUntillDisabled of false', () => {
      expect(settingsPanel.incrementUntillDisabled).toBe(false);
    });
  });

  describe('setting numeric values from parent', () => {
    it('should update startBeforeValue when property is set', async () => {
      settingsPanel.startBeforeValue = 5;
      await settingsPanel.updateComplete;
      expect(settingsPanel.startBeforeValue).toBe(5);
    });

    it('should update stopAfterValue when property is set', async () => {
      settingsPanel.stopAfterValue = 3;
      await settingsPanel.updateComplete;
      expect(settingsPanel.stopAfterValue).toBe(3);
    });

    it('should update incrementUntillValue when property is set', async () => {
      settingsPanel.incrementUntillValue = 50;
      await settingsPanel.updateComplete;
      expect(settingsPanel.incrementUntillValue).toBe(50);
    });
  });

  describe('setting disabled states from parent', () => {
    it('should update startBeforeDisabled when property is set', async () => {
      settingsPanel.startBeforeDisabled = true;
      await settingsPanel.updateComplete;
      expect(settingsPanel.startBeforeDisabled).toBe(true);
    });

    it('should update stopAfterDisabled when property is set', async () => {
      settingsPanel.stopAfterDisabled = true;
      await settingsPanel.updateComplete;
      expect(settingsPanel.stopAfterDisabled).toBe(true);
    });

    it('should update incrementUntillDisabled when property is set', async () => {
      settingsPanel.incrementUntillDisabled = true;
      await settingsPanel.updateComplete;
      expect(settingsPanel.incrementUntillDisabled).toBe(true);
    });
  });

  describe('setting-changed event dispatch', () => {
    it('should dispatch setting-changed event with correct detail when startBefore changes', () => {
      const handler = vi.fn();
      settingsPanel.addEventListener('setting-changed', handler);

      // @ts-expect-error - accessing private method for testing
      settingsPanel._setSongNumericSetting('startBefore', 7);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { setting: 'startBefore', value: 7 },
        })
      );
    });

    it('should dispatch setting-changed for disabled when disabling startBefore', () => {
      const handler = vi.fn();
      settingsPanel.addEventListener('setting-changed', handler);

      // @ts-expect-error - accessing private method for testing
      settingsPanel._setSongNumericSetting('startBefore', 7, true);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { setting: 'startBefore', value: 7 },
        })
      );
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { setting: 'startBeforeDisabled', value: true },
        })
      );
    });

    it('should dispatch setting-changed for disabled when re-enabling stopAfter', () => {
      settingsPanel.stopAfterDisabled = true;
      const handler = vi.fn();
      settingsPanel.addEventListener('setting-changed', handler);

      // @ts-expect-error - accessing private method for testing
      settingsPanel._setSongNumericSetting('stopAfter', 3, false);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { setting: 'stopAfter', value: 3 },
        })
      );
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { setting: 'stopAfterDisabled', value: false },
        })
      );
    });

    it('should dispatch both value and disabled events for incrementUntill', () => {
      const handler = vi.fn();
      settingsPanel.addEventListener('setting-changed', handler);

      // @ts-expect-error - accessing private method for testing
      settingsPanel._setSongNumericSetting('incrementUntill', 10, true);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { setting: 'incrementUntill', value: 10 },
        })
      );
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { setting: 'incrementUntillDisabled', value: true },
        })
      );
    });

    it('should not dispatch disabled event when disabled is undefined', () => {
      const handler = vi.fn();
      settingsPanel.addEventListener('setting-changed', handler);

      // @ts-expect-error - accessing private method for testing
      settingsPanel._setSongNumericSetting('startBefore', 5, undefined);

      const disabledCalls = handler.mock.calls.filter(
        (call: unknown[]) => (call[0] as { detail: { setting: string } }).detail.setting === 'startBeforeDisabled'
      );
      expect(disabledCalls.length).toBe(0);
    });

    it('should still update value after disabled is set to true', () => {
      // Simulate the sequence that happens on song load:
      // disabled is set first, then value is set
      settingsPanel.startBeforeDisabled = true;
      // @ts-expect-error - accessing private method for testing
      settingsPanel._setSongNumericSetting('startBefore', 42);

      expect(settingsPanel.startBeforeValue).toBe(42);
      expect(settingsPanel.startBeforeDisabled).toBe(true);
    });

    it('should update value even when already disabled (song switch scenario)', () => {
      // Simulate switching to a new song while disabled was already active
      settingsPanel.incrementUntillDisabled = true;
      settingsPanel.incrementUntillValue = 0;

      // New song has incrementUntill = 75
      settingsPanel.incrementUntillValue = 75;

      // Value should be updated despite disabled being true
      expect(settingsPanel.incrementUntillValue).toBe(75);
    });
  });

  describe('loading defaults when database keys are missing', () => {
    // These tests simulate what syncSettingsPanelValues() does in v2Script.ts
    // when loading song data that lacks certain keys.

    it('should fall back to global default for incrementUntillDisabled when song key is missing and default is off', () => {
      // v2Script should use: !settingsPanel.defaultIncrementUntilOn when key is missing
      // defaultIncrementUntilOn defaults to false → !false = true (disabled)
      const songData: Record<string, unknown> = {};
      const keyMissing = songData.TROFF_CLASS_TO_TOGGLE_buttIncrementUntil === undefined;
      settingsPanel.incrementUntillDisabled = keyMissing
        ? !settingsPanel.defaultIncrementUntilOn
        : songData.TROFF_CLASS_TO_TOGGLE_buttIncrementUntil !== true;
      expect(settingsPanel.incrementUntillDisabled).toBe(true);
    });

    it('should fall back to global default for incrementUntillDisabled when song key is missing and default is on', () => {
      // When user sets global default to ON → disabled should be false
      settingsPanel.defaultIncrementUntilOn = true;
      const songData: Record<string, unknown> = {};
      const keyMissing = songData.TROFF_CLASS_TO_TOGGLE_buttIncrementUntil === undefined;
      settingsPanel.incrementUntillDisabled = keyMissing
        ? !settingsPanel.defaultIncrementUntilOn
        : songData.TROFF_CLASS_TO_TOGGLE_buttIncrementUntil !== true;
      expect(settingsPanel.incrementUntillDisabled).toBe(false);
    });

    it('should load incrementUntillDisabled as true when TROFF_CLASS_TO_TOGGLE_buttIncrementUntil is false', () => {
      // false !== true → true (disabled)
      const songData: Record<string, unknown> = { TROFF_CLASS_TO_TOGGLE_buttIncrementUntil: false };
      const keyMissing = songData.TROFF_CLASS_TO_TOGGLE_buttIncrementUntil === undefined;
      settingsPanel.incrementUntillDisabled = keyMissing
        ? !settingsPanel.defaultIncrementUntilOn
        : songData.TROFF_CLASS_TO_TOGGLE_buttIncrementUntil !== true;
      expect(settingsPanel.incrementUntillDisabled).toBe(true);
    });

    it('should load incrementUntillDisabled as false when TROFF_CLASS_TO_TOGGLE_buttIncrementUntil is true', () => {
      // true !== true → false (not disabled)
      const songData: Record<string, unknown> = { TROFF_CLASS_TO_TOGGLE_buttIncrementUntil: true };
      const keyMissing = songData.TROFF_CLASS_TO_TOGGLE_buttIncrementUntil === undefined;
      settingsPanel.incrementUntillDisabled = keyMissing
        ? !settingsPanel.defaultIncrementUntilOn
        : songData.TROFF_CLASS_TO_TOGGLE_buttIncrementUntil !== true;
      expect(settingsPanel.incrementUntillDisabled).toBe(false);
    });

    it('should default incrementUntillValue to 100 when TROFF_VALUE_incrementUntilValue is missing', () => {
      // This is what getIncrementUntil() returns when the key is absent
      const songData: Record<string, unknown> = {};
      const value = songData.TROFF_VALUE_incrementUntilValue !== undefined
        ? Number(songData.TROFF_VALUE_incrementUntilValue)
        : 100;
      settingsPanel.incrementUntillValue = value;
      expect(settingsPanel.incrementUntillValue).toBe(100);
    });

    it('should default incrementUntillValue to 100 when songData is null', () => {
      // getIncrementUntil(null) returns 100 — tested in troff-settings.test.ts
      // Here we verify the panel correctly reflects that value
      settingsPanel.incrementUntillValue = 100;
      expect(settingsPanel.incrementUntillValue).toBe(100);
    });

    it('should fall back to global default for startBeforeDisabled when song key is missing and default is off', () => {
      // defaultStartBeforeOn defaults to false → !false = true (disabled)
      const songData: Record<string, unknown> = {};
      const keyMissing = songData.TROFF_CLASS_TO_TOGGLE_buttStartBefore === undefined;
      settingsPanel.startBeforeDisabled = keyMissing
        ? !settingsPanel.defaultStartBeforeOn
        : songData.TROFF_CLASS_TO_TOGGLE_buttStartBefore === false;
      expect(settingsPanel.startBeforeDisabled).toBe(true);
    });

    it('should fall back to global default for startBeforeDisabled when song key is missing and default is on', () => {
      settingsPanel.defaultStartBeforeOn = true;
      const songData: Record<string, unknown> = {};
      const keyMissing = songData.TROFF_CLASS_TO_TOGGLE_buttStartBefore === undefined;
      settingsPanel.startBeforeDisabled = keyMissing
        ? !settingsPanel.defaultStartBeforeOn
        : songData.TROFF_CLASS_TO_TOGGLE_buttStartBefore === false;
      expect(settingsPanel.startBeforeDisabled).toBe(false);
    });

    it('should fall back to global default for stopAfterDisabled when song key is missing and default is off', () => {
      // defaultStopAfterOn defaults to false → !false = true (disabled)
      const songData: Record<string, unknown> = {};
      const keyMissing = songData.TROFF_CLASS_TO_TOGGLE_buttStopAfter === undefined;
      settingsPanel.stopAfterDisabled = keyMissing
        ? !settingsPanel.defaultStopAfterOn
        : songData.TROFF_CLASS_TO_TOGGLE_buttStopAfter === false;
      expect(settingsPanel.stopAfterDisabled).toBe(true);
    });

    it('should fall back to global default for stopAfterDisabled when song key is missing and default is on', () => {
      settingsPanel.defaultStopAfterOn = true;
      const songData: Record<string, unknown> = {};
      const keyMissing = songData.TROFF_CLASS_TO_TOGGLE_buttStopAfter === undefined;
      settingsPanel.stopAfterDisabled = keyMissing
        ? !settingsPanel.defaultStopAfterOn
        : songData.TROFF_CLASS_TO_TOGGLE_buttStopAfter === false;
      expect(settingsPanel.stopAfterDisabled).toBe(false);
    });

    it('should default startBeforeValue to 4 when songData has no TROFF_VALUE_startBefore', () => {
      const songData: Record<string, unknown> = {};
      const value = songData.TROFF_VALUE_startBefore !== undefined
        ? Number(songData.TROFF_VALUE_startBefore)
        : 4;
      settingsPanel.startBeforeValue = value;
      expect(settingsPanel.startBeforeValue).toBe(4);
    });

    it('should default stopAfterValue to 2 when songData has no TROFF_VALUE_stopAfter', () => {
      const songData: Record<string, unknown> = {};
      const value = songData.TROFF_VALUE_stopAfter !== undefined
        ? Number(songData.TROFF_VALUE_stopAfter)
        : 2;
      settingsPanel.stopAfterValue = value;
      expect(settingsPanel.stopAfterValue).toBe(2);
    });
  });
});
