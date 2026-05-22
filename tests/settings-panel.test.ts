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

      (settingsPanel as any)._setSongNumericSetting('startBefore', 7);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { setting: 'startBefore', value: 7 },
        })
      );
    });

    it('should dispatch setting-changed for disabled when disabling startBefore', () => {
      const handler = vi.fn();
      settingsPanel.addEventListener('setting-changed', handler);

      (settingsPanel as any)._setSongNumericSetting('startBefore', 7, true);

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

      (settingsPanel as any)._setSongNumericSetting('stopAfter', 3, false);

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

      (settingsPanel as any)._setSongNumericSetting('incrementUntill', 10, true);

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

      (settingsPanel as any)._setSongNumericSetting('startBefore', 5, undefined);

      const disabledCalls = handler.mock.calls.filter(
        (call: unknown[]) => (call[0] as { detail: { setting: string } }).detail.setting === 'startBeforeDisabled'
      );
      expect(disabledCalls.length).toBe(0);
    });
  });
});
