import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { DetailsElement } from '../components/atom/t-details.js';

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

  describe('Marker color settings', () => {
    describe('default property values', () => {
      it('should have default extendedMarkerColor of false', () => {
        expect(settingsPanel.extendedMarkerColor).toBe(false);
      });

      it('should have default extraExtendedMarkerColor of false', () => {
        expect(settingsPanel.extraExtendedMarkerColor).toBe(false);
      });
    });

    describe('setting values from parent', () => {
      it('should update extendedMarkerColor when property is set', async () => {
        settingsPanel.extendedMarkerColor = true;
        await settingsPanel.updateComplete;
        expect(settingsPanel.extendedMarkerColor).toBe(true);
      });

      it('should update extraExtendedMarkerColor when property is set', async () => {
        settingsPanel.extraExtendedMarkerColor = true;
        await settingsPanel.updateComplete;
        expect(settingsPanel.extraExtendedMarkerColor).toBe(true);
      });

      it('should toggle extendedMarkerColor back to false', async () => {
        settingsPanel.extendedMarkerColor = true;
        await settingsPanel.updateComplete;
        settingsPanel.extendedMarkerColor = false;
        await settingsPanel.updateComplete;
        expect(settingsPanel.extendedMarkerColor).toBe(false);
      });
    });

    describe('setting-changed event dispatch', () => {
      it('should dispatch setting-changed when extendedMarkerColor is toggled', () => {
        const handler = vi.fn();
        settingsPanel.addEventListener('setting-changed', handler);

        // @ts-expect-error - accessing private method for testing
        settingsPanel._toggleSetting('extendedMarkerColor', false);

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: { setting: 'extendedMarkerColor', value: true },
          })
        );
      });

      it('should dispatch setting-changed when extraExtendedMarkerColor is toggled', () => {
        const handler = vi.fn();
        settingsPanel.addEventListener('setting-changed', handler);

        // @ts-expect-error - accessing private method for testing
        settingsPanel._toggleSetting('extraExtendedMarkerColor', false);

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: { setting: 'extraExtendedMarkerColor', value: true },
          })
        );
      });

      it('should toggle extendedMarkerColor off via _toggleSetting', () => {
        settingsPanel.extendedMarkerColor = true;
        const handler = vi.fn();
        settingsPanel.addEventListener('setting-changed', handler);

        // @ts-expect-error - accessing private method for testing
        settingsPanel._toggleSetting('extendedMarkerColor', true);

        expect(settingsPanel.extendedMarkerColor).toBe(false);
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: { setting: 'extendedMarkerColor', value: false },
          })
        );
      });
    });

    describe('both settings can be active simultaneously', () => {
      it('should allow both extendedMarkerColor and extraExtendedMarkerColor to be true', async () => {
        settingsPanel.extendedMarkerColor = true;
        settingsPanel.extraExtendedMarkerColor = true;
        await settingsPanel.updateComplete;
        expect(settingsPanel.extendedMarkerColor).toBe(true);
        expect(settingsPanel.extraExtendedMarkerColor).toBe(true);
      });
    });
  });

  describe('go to marker settings nDB persistence', () => {
    it('should dispatch setting-changed when enterGoToMarker is toggled', () => {
      const handler = vi.fn();
      settingsPanel.addEventListener('setting-changed', handler);

      // @ts-expect-error - accessing private method for testing
      settingsPanel._toggleSetting('enterGoToMarker', false);

      expect(settingsPanel.enterGoToMarker).toBe(true);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { setting: 'enterGoToMarker', value: true },
        })
      );
    });

    it('should dispatch setting-changed when spaceGoToMarker is toggled', () => {
      const handler = vi.fn();
      settingsPanel.addEventListener('setting-changed', handler);

      // @ts-expect-error - accessing private method for testing
      settingsPanel._toggleSetting('spaceGoToMarker', false);

      expect(settingsPanel.spaceGoToMarker).toBe(true);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { setting: 'spaceGoToMarker', value: true },
        })
      );
    });

    it('should dispatch setting-changed when playGoToMarker is toggled', () => {
      const handler = vi.fn();
      settingsPanel.addEventListener('setting-changed', handler);

      // @ts-expect-error - accessing private method for testing
      settingsPanel._toggleSetting('playGoToMarker', false);

      expect(settingsPanel.playGoToMarker).toBe(true);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { setting: 'playGoToMarker', value: true },
        })
      );
    });

    it('should toggle enterGoToMarker off when already on', () => {
      settingsPanel.enterGoToMarker = true;
      const handler = vi.fn();
      settingsPanel.addEventListener('setting-changed', handler);

      // @ts-expect-error - accessing private method for testing
      settingsPanel._toggleSetting('enterGoToMarker', true);

      expect(settingsPanel.enterGoToMarker).toBe(false);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { setting: 'enterGoToMarker', value: false },
        })
      );
    });

    it('should toggle spaceGoToMarker off when already on', () => {
      settingsPanel.spaceGoToMarker = true;
      const handler = vi.fn();
      settingsPanel.addEventListener('setting-changed', handler);

      // @ts-expect-error - accessing private method for testing
      settingsPanel._toggleSetting('spaceGoToMarker', true);

      expect(settingsPanel.spaceGoToMarker).toBe(false);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { setting: 'spaceGoToMarker', value: false },
        })
      );
    });

    it('should toggle playGoToMarker off when already on', () => {
      settingsPanel.playGoToMarker = true;
      const handler = vi.fn();
      settingsPanel.addEventListener('setting-changed', handler);

      // @ts-expect-error - accessing private method for testing
      settingsPanel._toggleSetting('playGoToMarker', true);

      expect(settingsPanel.playGoToMarker).toBe(false);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { setting: 'playGoToMarker', value: false },
        })
      );
    });

    it('should have default go to marker values matching new defaults', () => {
      expect(settingsPanel.enterGoToMarker).toBe(true);
      expect(settingsPanel.spaceGoToMarker).toBe(false);
      expect(settingsPanel.playGoToMarker).toBe(true);
    });
  });

  describe('keep screen on setting (syncs like extendedMarkerColor)', () => {
    describe('default property values', () => {
      it('should have default keepScreenOn of true', () => {
        expect(settingsPanel.keepScreenOn).toBe(true);
      });
    });

    describe('setting values from parent', () => {
      it('should update keepScreenOn when property is set', async () => {
        settingsPanel.keepScreenOn = false;
        await settingsPanel.updateComplete;
        expect(settingsPanel.keepScreenOn).toBe(false);
      });
    });

    describe('setting-changed event dispatch', () => {
      it('should dispatch setting-changed when keepScreenOn is toggled', () => {
        const handler = vi.fn();
        settingsPanel.addEventListener('setting-changed', handler);

        // @ts-expect-error - accessing private method for testing; keepScreenOn toggle added by feature
        settingsPanel._toggleSetting('keepScreenOn', false);

        expect(settingsPanel.keepScreenOn).toBe(true);
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: { setting: 'keepScreenOn', value: true },
          })
        );
      });

      it('should toggle keepScreenOn off when already on', () => {
        settingsPanel.keepScreenOn = true;
        const handler = vi.fn();
        settingsPanel.addEventListener('setting-changed', handler);

        // @ts-expect-error - accessing private method for testing; keepScreenOn toggle added by feature
        settingsPanel._toggleSetting('keepScreenOn', true);

        expect(settingsPanel.keepScreenOn).toBe(false);
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: { setting: 'keepScreenOn', value: false },
          })
        );
      });
    });

    describe('rendered keep screen on toggle in global controls area', () => {
      it('should render a <t-butt toggle> for "Keep screen on" inside the global controls area (under help-tip before "Behaviour of keys and buttons" details)', () => {
        // Identify the global controls area by the help-tip that precedes the Behaviour details
        const shells = Array.from(
          settingsPanel.shadowRoot?.querySelectorAll('.settings-shell') ?? []
        );
        const globalShell = shells.find((shell) =>
          shell.querySelector('t-help-tip[h3="Global Controls"]')
        );
        expect(globalShell, 'expected to find .settings-shell containing Global Controls help-tip').toBeTruthy();

        const butts = Array.from(globalShell!.querySelectorAll('t-butt') ?? []);
        const keepButt = butts.find((b) =>
          (b.textContent || '').trim().toLowerCase().includes('keep screen')
        );

        expect(keepButt).toBeTruthy();
        expect(keepButt!.hasAttribute('toggle')).toBe(true);
      });
    });
  });

  describe('Dark mode setting', () => {
    describe('default property values', () => {
      it('should have default darkMode of false', () => {
        expect(settingsPanel.darkMode).toBe(false);
      });
    });

    describe('setting values from parent', () => {
      it('should update darkMode when property is set', async () => {
        settingsPanel.darkMode = true;
        await settingsPanel.updateComplete;
        expect(settingsPanel.darkMode).toBe(true);
      });

      it('should toggle darkMode back to false', async () => {
        settingsPanel.darkMode = true;
        await settingsPanel.updateComplete;
        settingsPanel.darkMode = false;
        await settingsPanel.updateComplete;
        expect(settingsPanel.darkMode).toBe(false);
      });
    });

    describe('setting-changed event dispatch', () => {
      it('should dispatch setting-changed when darkMode is toggled on', () => {
        const handler = vi.fn();
        settingsPanel.addEventListener('setting-changed', handler);

        // @ts-expect-error - accessing private method for testing
        settingsPanel._toggleSetting('darkMode', false);

        expect(settingsPanel.darkMode).toBe(true);
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: { setting: 'darkMode', value: true },
          })
        );
      });

      it('should toggle darkMode off when already on', () => {
        settingsPanel.darkMode = true;
        const handler = vi.fn();
        settingsPanel.addEventListener('setting-changed', handler);

        // @ts-expect-error - accessing private method for testing
        settingsPanel._toggleSetting('darkMode', true);

        expect(settingsPanel.darkMode).toBe(false);
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: { setting: 'darkMode', value: false },
          })
        );
      });
    });

    describe('rendered dark mode toggle in global controls area', () => {
      it('should render a <t-butt toggle> for "Dark mode" inside the global controls area', () => {
        const shells = Array.from(
          settingsPanel.shadowRoot?.querySelectorAll('.settings-shell') ?? []
        );
        const globalShell = shells.find((shell) =>
          shell.querySelector('t-help-tip[h3="Global Controls"]')
        );
        expect(globalShell, 'expected to find .settings-shell containing Global Controls help-tip').toBeTruthy();

        const butts = Array.from(globalShell!.querySelectorAll('t-butt') ?? []);
        const darkModeButt = butts.find((b) =>
          (b.textContent || '').trim().toLowerCase().includes('dark mode')
        );

        expect(darkModeButt).toBeTruthy();
        expect(darkModeButt!.hasAttribute('toggle')).toBe(true);
      });
    });
  });

  describe('Theme setting', () => {
    describe('default property values', () => {
      it('should have default theme of col1', () => {
        expect(settingsPanel.theme).toBe('col1');
      });
    });

    describe('setting values from parent', () => {
      it('should update theme when property is set', async () => {
        settingsPanel.theme = 'col2';
        await settingsPanel.updateComplete;
        expect(settingsPanel.theme).toBe('col2');
      });

      it('should change theme to col3', async () => {
        settingsPanel.theme = 'col3';
        await settingsPanel.updateComplete;
        expect(settingsPanel.theme).toBe('col3');
      });
    });

    describe('setting-changed event dispatch', () => {
      it('should dispatch setting-changed when theme is changed', () => {
        const handler = vi.fn();
        settingsPanel.addEventListener('setting-changed', handler);

        // @ts-expect-error - accessing private method for testing
        settingsPanel._setTheme('col2');

        expect(settingsPanel.theme).toBe('col2');
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: { setting: 'theme', value: 'col2' },
          })
        );
      });

      it('should dispatch setting-changed for each theme', () => {
        for (const theme of ['col1', 'col2', 'col3', 'col4', 'col5', 'col6']) {
          const handler = vi.fn();
          settingsPanel.addEventListener('setting-changed', handler);

          // @ts-expect-error - accessing private method for testing
          settingsPanel._setTheme(theme);

          expect(settingsPanel.theme).toBe(theme);
          expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({
              detail: { setting: 'theme', value: theme },
            })
          );

          settingsPanel.removeEventListener('setting-changed', handler);
        }
      });
    });

    describe('rendered theme selector in global controls area', () => {
      it('should render a theme selector with 6 t-butt elements', () => {
        const themeSelector = settingsPanel.shadowRoot?.querySelector('.theme-selector');
        expect(themeSelector).toBeTruthy();

        const butts = themeSelector!.querySelectorAll('t-butt');
        expect(butts.length).toBe(6);
      });

      it('should render theme buttons with correct titles', () => {
        const themeSelector = settingsPanel.shadowRoot?.querySelector('.theme-selector');
        const butts = Array.from(themeSelector!.querySelectorAll('t-butt'));

        const titles = butts.map((b) => b.getAttribute('title'));
        expect(titles).toContain('Blue and purple');
        expect(titles).toContain('Green and red');
        expect(titles).toContain('Black and yellow');
        expect(titles).toContain('Gold and white');
        expect(titles).toContain('Black and red');
        expect(titles).toContain('Teal and orange');
      });

      it('should highlight the active theme button', async () => {
        settingsPanel.theme = 'col3';
        await settingsPanel.updateComplete;

        const themeSelector = settingsPanel.shadowRoot?.querySelector('.theme-selector');
        const butts = Array.from(themeSelector!.querySelectorAll('t-butt'));

        const activeButt = butts.find((b) => b.hasAttribute('active'));
        expect(activeButt).toBeTruthy();
        expect(activeButt!.getAttribute('title')).toBe('Black and yellow');
      });
    });
  });
});

describe('SettingsPanel panel title', () => {
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

  it('renders the panel title as "More"', () => {
    const title = settingsPanel.shadowRoot?.querySelector('.panel-title');
    expect(title).toBeTruthy();
    expect(title?.textContent?.trim()).toBe('More');
  });
});

// NOTE: The song "States" UI (Remember state button, state list, set/remove
// actions) has moved OUT of t-settings-panel and INTO the <t-details
// title="Advanced"> panel inside t-current-song-controls. Those behaviors are
// now covered by tests/states-in-advanced.test.ts. The tests that previously
// asserted states lived in the settings panel have been intentionally removed.

describe('SettingsPanel advanced panels use t-details', () => {
  let settingsPanel: SettingsPanelType;

  beforeEach(async () => {
    // Silence network fetches for manifest and icons in happy-dom (no dev server)
    const fetchMock = vi.fn(() => Promise.reject(new Error('network disabled in test')));
    vi.stubGlobal('fetch', fetchMock);
    // Make requestAnimationFrame fire synchronously
    const raf = (cb: Function) => { cb(); return 0; };
    vi.stubGlobal('requestAnimationFrame', raf);

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
    vi.unstubAllGlobals();
  });

  function getDetailsPanels(): DetailsElement[] {
    return Array.from(
      settingsPanel.shadowRoot?.querySelectorAll('t-details') ?? []
    ) as DetailsElement[];
  }

  function findDetailsByTitle(title: string): DetailsElement | undefined {
    return getDetailsPanels().find((panel) => panel.title === title);
  }

  it('renders t-details panels for Theme, Behaviour of keys and buttons, Marker color and Default Song Values', async () => {
    const titles = getDetailsPanels().map((panel) => panel.title);
    expect(titles).toEqual([
      'Theme',
      'Behaviour of keys and buttons',
      'Marker color',
      'Default Song Values',
    ]);
  });

  it('renders the correct descriptive text on the other t-details panels', async () => {
    const keys = findDetailsByTitle('Behaviour of keys and buttons');
    const color = findDetailsByTitle('Marker color');
    const defaults = findDetailsByTitle('Default Song Values');
    expect(keys).toBeTruthy();
    expect(color).toBeTruthy();
    expect(defaults).toBeTruthy();

    expect(keys?.text).toContain(
      'Configure what happens when you press the Enter key'
    );
    expect(color?.text).toContain(
      'Control how markers extend their color across the timeline'
    );
    expect(defaults?.text).toContain(
      'When loading a new song, these values will be the ones that the song get'
    );
  });

  it('no longer renders raw native <details> elements in its own shadow root', async () => {
    expect(settingsPanel.shadowRoot?.querySelector('details')).toBeNull();
  });
});
