import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Static mock for firebaseClient to prevent real Firebase during v2Script boot (auth IIFE + any dynamic).
vi.mock('../services/firebaseClient.js', () => ({
  auth: {},
  onAuthStateChanged: vi.fn(() => () => {}),
  db: {},
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
}));

describe('v2Script selective Firebase sync (saveSongData triggers)', () => {
  // In-memory nDB backing store (updated by mocks).
  const nDBStore: Record<string, any> = {};

  // Will be assigned the spied saveSongData from the firebase-realtime mock.
  let saveSongDataMock: ReturnType<typeof vi.fn>;

  function createRequiredDom() {
    document.body.innerHTML = '';

    const header = document.createElement('div');
    header.id = 'header';
    document.body.appendChild(header);

    const songList = document.createElement('div');
    songList.id = 'songList';
    document.body.appendChild(songList);

    const footer = document.createElement('div');
    footer.id = 'footer';
    document.body.appendChild(footer);

    const settingsPanel = document.createElement('div');
    settingsPanel.id = 'settingsPanel';
    document.body.appendChild(settingsPanel);

    const markerSlider = document.createElement('div');
    markerSlider.id = 'markerSlider';
    (markerSlider as any).getPlaybackStart = vi.fn(() => 10);
    (markerSlider as any).startMarkerId = 'markerNr0';
    (markerSlider as any).stopMarkerId = 'markerNr1S';
    (markerSlider as any).max = 180;
    (markerSlider as any).min = 0;
    (markerSlider as any).value = 0;
    (markerSlider as any).requestUpdate = vi.fn();
    (markerSlider as any).selectPreviousMarker = vi.fn();
    (markerSlider as any).selectNextMarker = vi.fn();
    document.body.appendChild(markerSlider);

    const currentSongControls = document.createElement('div');
    currentSongControls.id = 'currentSongControls';
    document.body.appendChild(currentSongControls);

    return { header, songList, footer, settingsPanel, markerSlider, currentSongControls };
  }

  function mockModules(songKey = 'test-song.mp3') {
    vi.doMock('../utils/current-song.js', () => ({
      updateHeaderWithCurrentSong: vi.fn(),
      setCurrentSong: vi.fn(),
      getCurrentSongMetadata: vi.fn(() => ({ duration: 180 })),
      getCurrentSongKey: vi.fn(() => songKey),
      updateFooterWithCurrentSong: vi.fn(),
    }));

    vi.doMock('../assets/internal/db.js', () => ({
      nDB: {
        get: vi.fn((key: string) => nDBStore[key] ?? null),
        set: vi.fn((key: string, value: unknown) => {
          nDBStore[key] = value;
        }),
        setOnSong: vi.fn((key: string, path: string | string[], value: unknown) => {
          let songData = nDBStore[key] ?? {};
          if (Array.isArray(path)) {
            let target: any = songData;
            for (let i = 0; i < path.length - 1; i++) {
              if (!target[path[i]]) target[path[i]] = {};
              target = target[path[i]];
            }
            target[path[path.length - 1]] = value;
          } else {
            songData[path] = value;
          }
          nDBStore[key] = songData;
        }),
      },
    }));

    vi.doMock('../services/audio.js', () => ({
      audio: {
        currentTime: 0,
        duration: 180,
        playbackRate: 1,
        volume: 1,
        paused: true,
        addEventListener: vi.fn(),
      },
      loadSong: vi.fn(),
    }));

    vi.doMock('../utils/firebase-sync.js', () => ({
      syncFirebaseGroups: vi.fn().mockResolvedValue(undefined),
    }));

    saveSongDataMock = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../utils/firebase-realtime.js', () => ({
      setupListeners: vi.fn().mockResolvedValue(undefined),
      setupGroupSongListeners: vi.fn().mockResolvedValue(undefined),
      teardownListeners: vi.fn(),
      saveSongData: saveSongDataMock,
      setLiveUpdateCallback: vi.fn(),
      setGroupUpdateCallback: vi.fn(),
    }));

    vi.doMock('../assets/internal/notify-js/notify.config.js', () => ({}));

    vi.doMock('../utils/log.js', () => ({
      default: {
        i: vi.fn(),
        w: vi.fn(),
        e: vi.fn(),
      },
    }));

    vi.doMock('../utils/notification.js', () => ({
      showToast: vi.fn(),
    }));

    // Pure utils used inside handlers — provide no-op implementations so no real logic runs.
    vi.doMock('../utils/marker-actions.js', () => ({
      getSelectedMarkerRange: vi.fn(() => [0, 2]),
      copyMarkers: vi.fn((markers: any[]) => [...markers]),
      moveMarkers: vi.fn((markers: any[]) => [...markers]),
      stretchMarkers: vi.fn((markers: any[]) => [...markers]),
      deleteMarkers: vi.fn((markers: any[]) => markers.slice(0, 1)),
      normalizeMarkerTime: vi.fn((t: number) => t),
      mergeNearbyMarkers: vi.fn((markers: any[]) => markers),
    }));

    vi.doMock('../utils/marker-import.js', () => ({
      mergeImportedMarkers: vi.fn((existing: any[], imported: any[]) => [...existing, ...imported]),
    }));

    vi.doMock('../utils/troff-settings.js', () => ({
      configureMarkerSlider: vi.fn(),
      getStartBefore: vi.fn(() => 0),
      getStopAfter: vi.fn(() => 0),
      getIncrementUntil: vi.fn(() => 0),
      ensureDefaultMarkers: vi.fn((songData: any) => songData.markers || []),
    }));

    vi.doMock('../utils/formatters.js', () => ({
      formatDuration: vi.fn((t: number) => String(t)),
      countLast30Days: vi.fn(() => 0),
    }));

    vi.doMock('../utils/utils.js', () => ({
      toSongKey: vi.fn((k: string) => k),
    }));
  }

  async function bootV2Script() {
    await import('../v2Script.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    // Allow auth IIFE + any setTimeout in boot to settle (mirrors existing v2 tests).
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  beforeEach(() => {
    vi.resetModules();
    Object.keys(nDBStore).forEach((key) => delete nDBStore[key]);
    document.body.innerHTML = '';
    saveSongDataMock = vi.fn().mockResolvedValue(undefined);

    // Make rAF synchronous (happy-dom does not implement it; v2Script uses for UI timing).
    const raf = (cb: Function) => {
      cb();
      return 0;
    };
    vi.stubGlobal('requestAnimationFrame', raf);
    window.requestAnimationFrame = raf;

    // Prevent duplicate custom element define errors on repeated v2Script imports (see v2Script.test.ts).
    const registry = customElements;
    const originalDefine = registry.define.bind(registry);
    const patched = Object.create(registry);
    patched.define = (name: string, constructor: CustomElementConstructor, options?: ElementDefinitionOptions) => {
      if (!registry.get(name)) {
        originalDefine(name, constructor, options);
      }
    };
    vi.stubGlobal('customElements', patched);

    window.location.hash = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  describe('MUST NOT call saveSongData for disallowed actions', () => {
    it('does not call saveSongData during initial boot / load for a synced song', async () => {
      createRequiredDom();
      nDBStore['test-song.mp3'] = { markers: [{ id: 'm0', time: 0 }] };
      mockModules();
      // spy starts clean before boot
      saveSongDataMock.mockClear();
      await bootV2Script();
      // No saveSongData should be invoked by loadSong, selectFirstAndLastMarkers, sync, auth setup, etc.
      expect(saveSongDataMock).not.toHaveBeenCalled();
    });

    it('does not call saveSongData for setting-changed except the debounced tempo case', async () => {
      createRequiredDom();
      nDBStore['test-song.mp3'] = { markers: [] };
      mockModules();
      await bootV2Script();
      saveSongDataMock.mockClear();

      const settingsPanel = document.getElementById('settingsPanel')!;

      // Disallowed settings that currently eagerly call saveSongData.
      const disallowedSettings = [
        { setting: 'speed', value: 110 },
        { setting: 'volume', value: 80 },
        { setting: 'pauseBefore', value: 2 },
        { setting: 'waitBetween', value: 1 },
        { setting: 'loopTimes', value: '3' },
        { setting: 'startBefore', value: 5 },
        { setting: 'stopAfter', value: 10 },
        { setting: 'incrementUntill', value: 2 },
        { setting: 'startBeforeDisabled', value: true },
        { setting: 'stopAfterDisabled', value: false },
        { setting: 'pauseBeforeDisabled', value: true },
        { setting: 'waitBetweenDisabled', value: false },
      ];

      for (const d of disallowedSettings) {
        settingsPanel.dispatchEvent(
          new CustomEvent('setting-changed', {
            detail: d,
            bubbles: true,
            composed: true,
          })
        );
      }

      // Currently the code calls save for all of these -> test is RED.
      expect(saveSongDataMock).not.toHaveBeenCalled();
    });

    it('does not call saveSongData for footer speed/volume/pause/wait changes', async () => {
      const { footer } = createRequiredDom();
      nDBStore['test-song.mp3'] = { markers: [] };
      mockModules();
      await bootV2Script();
      saveSongDataMock.mockClear();

      footer.dispatchEvent(
        new CustomEvent('speed-changed', { detail: { speed: 95 } })
      );
      footer.dispatchEvent(
        new CustomEvent('volume-changed', { detail: { volume: 70 } })
      );
      footer.dispatchEvent(
        new CustomEvent('pause-before-changed', { detail: { pauseBefore: 3, disabled: false } })
      );
      footer.dispatchEvent(
        new CustomEvent('wait-between-changed', { detail: { waitBetween: 2, disabled: true } })
      );

      expect(saveSongDataMock).not.toHaveBeenCalled();
    });

    it('does not call saveSongData for markerSlider current marker select (set-start-marker, set-stop-marker)', async () => {
      const { markerSlider } = createRequiredDom();
      nDBStore['test-song.mp3'] = { markers: [] };
      mockModules();
      await bootV2Script();
      saveSongDataMock.mockClear();

      markerSlider.dispatchEvent(
        new CustomEvent('set-start-marker', { detail: { markerId: 'markerNr0' } })
      );
      markerSlider.dispatchEvent(
        new CustomEvent('set-stop-marker', { detail: { markerId: 'markerNr1' } })
      );

      expect(saveSongDataMock).not.toHaveBeenCalled();
    });

    it('does not call saveSongData for song-info-saved or song-saved (metadata edit)', async () => {
      createRequiredDom();
      nDBStore['test-song.mp3'] = { markers: [] };
      mockModules();
      await bootV2Script();
      saveSongDataMock.mockClear();

      document.dispatchEvent(
        new CustomEvent('song-info-saved', { detail: { info: 'new info' } })
      );
      document.dispatchEvent(
        new CustomEvent('song-saved', {
          detail: { songKey: 'test-song.mp3', fileData: { title: 'New Title' } },
        })
      );

      expect(saveSongDataMock).not.toHaveBeenCalled();
    });
  });

  describe('MUST call saveSongData ONLY after allowed marker/state/import actions', () => {
    it('calls saveSongData after marker-created from footer', async () => {
      const { footer } = createRequiredDom();
      nDBStore['test-song.mp3'] = { markers: [] };
      mockModules();
      await bootV2Script();
      saveSongDataMock.mockClear();

      footer.dispatchEvent(
        new CustomEvent('marker-created', {
          detail: { marker: { id: 'm-new', time: 42, name: 'New' } },
        })
      );

      expect(saveSongDataMock).toHaveBeenCalledTimes(1);
      expect(saveSongDataMock).toHaveBeenCalledWith('test-song.mp3');
    });

    it('calls saveSongData after marker-updated from footer', async () => {
      const { footer } = createRequiredDom();
      nDBStore['test-song.mp3'] = {
        markers: [{ id: 'm1', time: 10, name: 'Old' }],
      };
      mockModules();
      await bootV2Script();
      saveSongDataMock.mockClear();

      footer.dispatchEvent(
        new CustomEvent('marker-updated', {
          detail: { marker: { id: 'm1', time: 15, name: 'Updated' } },
        })
      );

      expect(saveSongDataMock).toHaveBeenCalledTimes(1);
      expect(saveSongDataMock).toHaveBeenCalledWith('test-song.mp3');
    });

    it('calls saveSongData after marker-deleted from footer', async () => {
      const { footer } = createRequiredDom();
      nDBStore['test-song.mp3'] = {
        markers: [{ id: 'm1', time: 10, name: 'One' }],
      };
      mockModules();
      await bootV2Script();
      saveSongDataMock.mockClear();

      footer.dispatchEvent(
        new CustomEvent('marker-deleted', { detail: { markerId: 'm1' } })
      );

      expect(saveSongDataMock).toHaveBeenCalledTimes(1);
      expect(saveSongDataMock).toHaveBeenCalledWith('test-song.mp3');
    });

    it('calls saveSongData after create state (rememberCurrentState / prompt)', async () => {
      createRequiredDom();
      nDBStore['test-song.mp3'] = { markers: [], aStates: [] };
      mockModules();
      await bootV2Script();
      saveSongDataMock.mockClear();

      const promptSpy = vi.fn(() => 'Test Prompt State');
      vi.stubGlobal('prompt', promptSpy);

      const settingsPanel = document.getElementById('settingsPanel')!;
      settingsPanel.dispatchEvent(
        new CustomEvent('song-action-requested', {
          detail: { action: 'rememberState' },
          bubbles: true,
          composed: true,
        })
      );

      expect(promptSpy).toHaveBeenCalled();
      expect(saveSongDataMock).toHaveBeenCalledTimes(1);
      expect(saveSongDataMock).toHaveBeenCalledWith('test-song.mp3');

      vi.unstubAllGlobals();
    });

    it('calls saveSongData after removeState', async () => {
      createRequiredDom();
      nDBStore['test-song.mp3'] = {
        markers: [],
        aStates: ['{"name":"s1","currentMarker":"markerNr0"}'],
      };
      mockModules();
      await bootV2Script();
      // Re-acquire the mocked save fn (helps with vitest module mock + resetModules timing in this suite)
      const { saveSongData: boundSave } = await import('../utils/firebase-realtime.js');
      saveSongDataMock = boundSave as ReturnType<typeof vi.fn>;
      saveSongDataMock.mockClear();

      // Dispatch directly to settingsPanel (the handler lives there)
      const settingsPanel = document.getElementById('settingsPanel')!;
      settingsPanel.dispatchEvent(
        new CustomEvent('song-action-requested', {
          detail: { action: 'removeState', index: 0 },
          bubbles: true,
          composed: true,
        })
      );

      // Verify remove handler ran (aStates reduced) and save was invoked.
      const afterStates = nDBStore['test-song.mp3']?.aStates || [];
      expect(afterStates.length).toBe(0);
      expect(saveSongDataMock).toHaveBeenCalledTimes(1);
      expect(saveSongDataMock).toHaveBeenCalledWith('test-song.mp3');
    });

    it('calls saveSongData for rememberState (add) and removeState, even with multiple, but not for setState or disallowed', async () => {
      createRequiredDom();
      nDBStore['test-song.mp3'] = { markers: [], aStates: [] };
      mockModules();
      await bootV2Script();
      // Re-acquire (consistent with removeState test for mock timing)
      const { saveSongData: boundSave } = await import('../utils/firebase-realtime.js');
      saveSongDataMock = boundSave as ReturnType<typeof vi.fn>;
      saveSongDataMock.mockClear();

      const settingsPanel = document.getElementById('settingsPanel')!;
      const promptSpy = vi.fn(() => 'MultiState1');
      vi.stubGlobal('prompt', promptSpy);

      // first add (remember) -> 1 save
      settingsPanel.dispatchEvent(
        new CustomEvent('song-action-requested', {
          detail: { action: 'rememberState' },
          bubbles: true,
          composed: true,
        })
      );
      expect(saveSongDataMock).toHaveBeenCalledTimes(1);

      // second add -> 2 saves
      promptSpy.mockReturnValueOnce('MultiState2');
      settingsPanel.dispatchEvent(
        new CustomEvent('song-action-requested', {
          detail: { action: 'rememberState' },
          bubbles: true,
          composed: true,
        })
      );
      expect(saveSongDataMock).toHaveBeenCalledTimes(2);

      // setState must NOT trigger save (just applies)
      settingsPanel.dispatchEvent(
        new CustomEvent('song-action-requested', {
          detail: { action: 'setState', index: 0 },
          bubbles: true,
          composed: true,
        })
      );
      expect(saveSongDataMock).toHaveBeenCalledTimes(2);

      // remove one -> +1 save =3
      settingsPanel.dispatchEvent(
        new CustomEvent('song-action-requested', {
          detail: { action: 'removeState', index: 0 },
          bubbles: true,
          composed: true,
        })
      );
      expect(saveSongDataMock).toHaveBeenCalledTimes(3);

      // disallowed after does not increase
      settingsPanel.dispatchEvent(
        new CustomEvent('setting-changed', {
          detail: { setting: 'loopTimes', value: '5' },
          bubbles: true,
          composed: true,
        })
      );
      expect(saveSongDataMock).toHaveBeenCalledTimes(3);

      vi.unstubAllGlobals();
    });

    it('calls saveSongData after import markers succeeds (handleImportRequested)', async () => {
      createRequiredDom();
      nDBStore['test-song.mp3'] = { markers: [] };
      mockModules();
      await bootV2Script();
      saveSongDataMock.mockClear();

      const settingsPanel = document.getElementById('settingsPanel')!;
      // Trigger importExport action -> creates dialog and attaches once listener.
      settingsPanel.dispatchEvent(
        new CustomEvent('song-action-requested', {
          detail: { action: 'importExport' },
          bubbles: true,
          composed: true,
        })
      );

      // The created dialog (even if plain tag) has the listener attached by v2Script.
      const importDialog = document.querySelector('t-import-export-dialog');
      expect(importDialog).toBeTruthy();

      // Dispatch the import-requested that the handler listens for.
      (importDialog as HTMLElement).dispatchEvent(
        new CustomEvent('import-requested', {
          detail: {
            data: {
              aoMarkers: [{ id: 'imp1', time: 30, name: 'Imported' }],
              aoStates: [],
              strSongInfo: 'imported info',
            },
            mode: 'merge' as const,
          },
        })
      );

      // Allow the async handler (await saveSongData) to run.
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(saveSongDataMock).toHaveBeenCalledTimes(1);
      expect(saveSongDataMock).toHaveBeenCalledWith('test-song.mp3');
    });

    it('calls saveSongData exactly once after stretchMarkers tool action', async () => {
      createRequiredDom();
      nDBStore['test-song.mp3'] = {
        markers: [
          { id: 'm0', time: 0 },
          { id: 'm1', time: 10 },
          { id: 'm2', time: 20 },
        ],
      };
      mockModules();
      await bootV2Script();
      saveSongDataMock.mockClear();

      const settingsPanel = document.getElementById('settingsPanel')!;

      // open the tools dialog for stretch
      settingsPanel.dispatchEvent(
        new CustomEvent('song-action-requested', {
          detail: { action: 'stretchMarkers' },
          bubbles: true,
          composed: true,
        })
      );

      const toolsDialog = document.querySelector('t-marker-tools-dialog');
      expect(toolsDialog).toBeTruthy();

      // simulate the action from dialog -> applyMarkerToolsAction which does the save
      (toolsDialog as HTMLElement).dispatchEvent(
        new CustomEvent('marker-tools-action', {
          detail: { action: 'stretchSelected', value: 150 },
        })
      );

      // no async await needed (save is sync void call)
      expect(saveSongDataMock).toHaveBeenCalledTimes(1);
      expect(saveSongDataMock).toHaveBeenCalledWith('test-song.mp3');
    });
  });

  describe('tempo setting-changed: nDB immediate, saveSongData DEBOUNCED', () => {
    it('multiple rapid tempo changes update nDB instantly but call saveSongData only once after debounce quiet period', async () => {
      createRequiredDom();
      nDBStore['test-song.mp3'] = { markers: [] };
      mockModules();
      await bootV2Script();
      saveSongDataMock.mockClear();

      vi.useFakeTimers();

      const settingsPanel = document.getElementById('settingsPanel')!;

      // Rapid taps (current code calls save immediately on each -> RED).
      settingsPanel.dispatchEvent(
        new CustomEvent('setting-changed', {
          detail: { setting: 'tempo', value: 100 },
          bubbles: true,
          composed: true,
        })
      );
      expect(nDBStore['test-song.mp3'].TROFF_VALUE_tapTempo).toBe(100);
      expect(saveSongDataMock).not.toHaveBeenCalled();

      settingsPanel.dispatchEvent(
        new CustomEvent('setting-changed', {
          detail: { setting: 'tempo', value: 110 },
          bubbles: true,
          composed: true,
        })
      );
      expect(nDBStore['test-song.mp3'].TROFF_VALUE_tapTempo).toBe(110);
      expect(saveSongDataMock).not.toHaveBeenCalled();

      settingsPanel.dispatchEvent(
        new CustomEvent('setting-changed', {
          detail: { setting: 'tempo', value: 120 },
          bubbles: true,
          composed: true,
        })
      );
      expect(nDBStore['test-song.mp3'].TROFF_VALUE_tapTempo).toBe(120);
      // Still no save yet (debounce pending).
      expect(saveSongDataMock).not.toHaveBeenCalled();

      // Advance less than debounce window (e.g. 800ms).
      vi.advanceTimersByTime(700);
      expect(saveSongDataMock).not.toHaveBeenCalled();

      // Advance past quiet period (total > ~1000ms since last).
      vi.advanceTimersByTime(400);
      expect(saveSongDataMock).toHaveBeenCalledTimes(1);
      expect(saveSongDataMock).toHaveBeenCalledWith('test-song.mp3');

      vi.useRealTimers();
    });

    it('after a disallowed setting change + a tempo tap, the save is only the debounced one (not the disallowed)', async () => {
      createRequiredDom();
      nDBStore['test-song.mp3'] = { markers: [] };
      mockModules();
      await bootV2Script();
      saveSongDataMock.mockClear();

      vi.useFakeTimers();

      const settingsPanel = document.getElementById('settingsPanel')!;

      // disallowed (should never save)
      settingsPanel.dispatchEvent(
        new CustomEvent('setting-changed', {
          detail: { setting: 'speed', value: 95 },
          bubbles: true,
          composed: true,
        })
      );
      expect(saveSongDataMock).not.toHaveBeenCalled();

      // tempo change (nDB now, save debounced)
      settingsPanel.dispatchEvent(
        new CustomEvent('setting-changed', {
          detail: { setting: 'tempo', value: 108 },
          bubbles: true,
          composed: true,
        })
      );
      expect(nDBStore['test-song.mp3'].TROFF_VALUE_tapTempo).toBe(108);
      expect(saveSongDataMock).not.toHaveBeenCalled();

      // advance past debounce
      vi.advanceTimersByTime(1000);
      expect(saveSongDataMock).toHaveBeenCalledTimes(1);
      expect(saveSongDataMock).toHaveBeenCalledWith('test-song.mp3');

      vi.useRealTimers();
    });
  });

  describe('allowed vs disallowed exact call counts (summary)', () => {
    it('produces exactly the expected number of saveSongData calls for a mix of actions (current impl fails this)', async () => {
      const { footer, settingsPanel, markerSlider } = createRequiredDom();
      nDBStore['test-song.mp3'] = {
        markers: [{ id: 'm0', time: 0 }],
        aStates: ['{"name":"old"}'],
      };
      mockModules();
      await bootV2Script();
      saveSongDataMock.mockClear();

      // 3 disallowed that currently call
      settingsPanel.dispatchEvent(
        new CustomEvent('setting-changed', { detail: { setting: 'speed', value: 100 }, bubbles: true, composed: true })
      );
      footer.dispatchEvent(new CustomEvent('volume-changed', { detail: { volume: 50 } }));
      markerSlider.dispatchEvent(new CustomEvent('set-start-marker', { detail: { markerId: 'm0' } }));

      const disallowedCallsSoFar = saveSongDataMock.mock.calls.length;

      // 1 allowed
      footer.dispatchEvent(
        new CustomEvent('marker-created', { detail: { marker: { id: 'm-new', time: 5 } } })
      );

      // After fix: disallowed so far 0, exactly 1 call for the allowed marker-created.
      expect(disallowedCallsSoFar).toBe(0);
      expect(saveSongDataMock).toHaveBeenCalledTimes(1);
      expect(saveSongDataMock).toHaveBeenLastCalledWith('test-song.mp3');

      // marker tool actions also trigger save (simulate 'marker-tools-action' after requesting open)
      settingsPanel.dispatchEvent(
        new CustomEvent('song-action-requested', {
          detail: { action: 'stretchMarkers' },
          bubbles: true,
          composed: true,
        })
      );
      const markerToolsDialog = document.querySelector('t-marker-tools-dialog');
      expect(markerToolsDialog).toBeTruthy();
      (markerToolsDialog as HTMLElement).dispatchEvent(
        new CustomEvent('marker-tools-action', {
          detail: { action: 'stretchSelected', value: 120 },
        })
      );
      // now 2 calls total (marker create + stretch tool)
      expect(saveSongDataMock).toHaveBeenCalledTimes(2);
      expect(saveSongDataMock).toHaveBeenLastCalledWith('test-song.mp3');

      // further disallowed does not add calls
      settingsPanel.dispatchEvent(
        new CustomEvent('setting-changed', { detail: { setting: 'pauseBefore', value: 1 }, bubbles: true, composed: true })
      );
      expect(saveSongDataMock).toHaveBeenCalledTimes(2);
    });
  });
});
