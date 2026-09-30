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

// ---------------------------------------------------------------------------
// The feature under test: ONE helper in v2Script.ts (`saveSharedSongData`) is
// the single place that encodes "this change is a shared/synced change". It
// must (1) call saveSongData(songKey) and (2) synchronously clear the share
// URL: nDB.setOnSong(songKey, 'serverId', undefined) + setUrlToSong(undefined).
// Every saveSongData call site in v2Script.ts is replaced by that helper, so:
//  - shared actions (marker tools, marker CRUD, import, states, info, fileData
//    metadata, tap-tempo) clear BOTH the URL hash AND the nDB serverId,
//  - local-only actions (playback settings, setState, marker slider selection)
//    clear NEITHER and never call saveSongData,
//  - boot / song selection never clear a pre-existing navigation hash.
//
// Harness copied from tests/v2Script-selective-firebase-sync.test.ts (same
// firebaseClient / nDB / audio / util mocks, same boot sequence).
// ---------------------------------------------------------------------------

const SONG_KEY = 'test-song.mp3';
const SHARE_SERVER_ID = 123;
const SHARE_HASH = `#${SHARE_SERVER_ID}&${SONG_KEY}`;

interface MarkerStub {
  id: string;
  time: number | string;
  name?: string;
}

interface SongRecord {
  markers?: MarkerStub[];
  aStates?: string[];
  info?: string;
  serverId?: string | number;
  fileData?: Record<string, unknown>;
  [key: string]: unknown;
}

interface MarkerSliderStub extends HTMLElement {
  getPlaybackStart: () => number;
  startMarkerId: string;
  stopMarkerId: string;
  max: number;
  min: number;
  value: number;
  requestUpdate: () => void;
  selectPreviousMarker: () => void;
  selectNextMarker: () => void;
}

interface RequiredDom {
  header: HTMLElement;
  songList: HTMLElement;
  footer: HTMLElement;
  settingsPanel: HTMLElement;
  markerSlider: MarkerSliderStub;
  currentSongControls: HTMLElement;
}

describe('v2Script clears the share URL (hash + serverId) for shared/synced changes', () => {
  // In-memory nDB backing store (updated by mocks).
  const nDBStore: Record<string, SongRecord> = {};

  // Will be assigned the spied saveSongData from the firebase-realtime mock.
  let saveSongDataMock: ReturnType<typeof vi.fn>;

  // Spied isSongInFirebaseGroup from the same mock (used by the song-saved
  // handler; clearing itself must NOT depend on it).
  let isSongInFirebaseGroupMock: ReturnType<typeof vi.fn>;

  // Captured audio mock so tests can inspect/set playback position.
  let audioMock: {
    currentTime: number;
    duration: number;
    playbackRate: number;
    volume: number;
    paused: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
  };

  function createRequiredDom(): RequiredDom {
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
    const slider = markerSlider as unknown as MarkerSliderStub;
    slider.getPlaybackStart = vi.fn(() => 10);
    slider.startMarkerId = 'markerNr0';
    slider.stopMarkerId = 'markerNr1S';
    slider.max = 180;
    slider.min = 0;
    slider.value = 0;
    slider.requestUpdate = vi.fn();
    slider.selectPreviousMarker = vi.fn();
    slider.selectNextMarker = vi.fn();
    document.body.appendChild(markerSlider);

    const currentSongControls = document.createElement('div');
    currentSongControls.id = 'currentSongControls';
    document.body.appendChild(currentSongControls);

    return { header, songList, footer, settingsPanel, markerSlider: slider, currentSongControls };
  }

  function mockModules() {
    vi.doMock('../utils/current-song.js', () => ({
      updateHeaderWithCurrentSong: vi.fn(),
      setCurrentSong: vi.fn(),
      getCurrentSongMetadata: vi.fn(() => ({ duration: 180 })),
      getCurrentSongKey: vi.fn(() => SONG_KEY),
      updateFooterWithCurrentSong: vi.fn(),
    }));

    vi.doMock('../assets/internal/db.js', () => ({
      nDB: {
        get: vi.fn((key: string) => nDBStore[key] ?? null),
        set: vi.fn((key: string, value: unknown) => {
          nDBStore[key] = value as SongRecord;
        }),
        setOnSong: vi.fn((key: string, path: string | string[], value: unknown) => {
          const songData: SongRecord = nDBStore[key] ?? {};
          const parts = Array.isArray(path) ? path : [path];
          let target: Record<string, unknown> = songData;
          for (let i = 0; i < parts.length - 1; i++) {
            const existing = target[parts[i]];
            if (typeof existing !== 'object' || existing === null) {
              target[parts[i]] = {};
            }
            target = target[parts[i]] as Record<string, unknown>;
          }
          target[parts[parts.length - 1]] = value;
          nDBStore[key] = songData;
        }),
      },
    }));

    audioMock = {
      currentTime: 0,
      duration: 180,
      playbackRate: 1,
      volume: 1,
      paused: true,
      addEventListener: vi.fn(),
    };
    vi.doMock('../services/audio.js', () => ({ audio: audioMock, loadSong: vi.fn() }));

    vi.doMock('../utils/firebase-sync.js', () => ({
      syncFirebaseGroups: vi.fn().mockResolvedValue(undefined),
    }));

    saveSongDataMock = vi.fn().mockResolvedValue(undefined);
    isSongInFirebaseGroupMock = vi.fn(() => true);
    vi.doMock('../utils/firebase-realtime.js', () => ({
      setupListeners: vi.fn().mockResolvedValue(undefined),
      setupGroupSongListeners: vi.fn().mockResolvedValue(undefined),
      teardownListeners: vi.fn(),
      saveSongData: saveSongDataMock,
      isSongInFirebaseGroup: isSongInFirebaseGroupMock,
      setLiveUpdateCallback: vi.fn(),
      setGroupUpdateCallback: vi.fn(),
    }));

    // Keep the hash-download flow inert: arming window.location.hash queues a
    // happy-dom hashchange, and v2Script's boot/hashchange listener would
    // otherwise run the real download path (Firebase/network). parseHash →
    // null makes handleHashDownload a no-op, so the tests only observe the
    // behaviour under test.
    vi.doMock('../utils/hash-download.js', () => ({
      parseHash: vi.fn(() => null),
      downloadSongFromHash: vi.fn(),
      fetchServerTroffDataResult: vi.fn(),
      fetchServerTroffData: vi.fn(),
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
      copyMarkers: vi.fn((markers: MarkerStub[]) => [...markers]),
      moveMarkers: vi.fn((markers: MarkerStub[]) => [...markers]),
      stretchMarkers: vi.fn((markers: MarkerStub[]) => [...markers]),
      deleteMarkers: vi.fn((markers: MarkerStub[]) => markers.slice(0, 1)),
      normalizeMarkerTime: vi.fn((t: number) => t),
      mergeNearbyMarkers: vi.fn((markers: MarkerStub[]) => markers),
    }));

    vi.doMock('../utils/marker-import.js', () => ({
      mergeImportedMarkers: vi.fn((existing: MarkerStub[], imported: MarkerStub[]) => [
        ...existing,
        ...imported,
      ]),
    }));

    vi.doMock('../utils/troff-settings.js', () => ({
      configureMarkerSlider: vi.fn(),
      getStartBefore: vi.fn(() => 0),
      getStopAfter: vi.fn(() => 0),
      getIncrementUntil: vi.fn(() => 0),
      ensureDefaultMarkers: vi.fn(
        (songData: { markers?: MarkerStub[] } | null | undefined) => songData?.markers ?? []
      ),
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

  const flush = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * Seed the "shared song" state: a shareable URL hash plus the matching nDB
   * serverId, exactly as a song that was shared/uploaded would have.
   */
  function armShareUrl() {
    window.location.hash = SHARE_HASH;
    nDBStore[SONG_KEY] = { ...nDBStore[SONG_KEY], serverId: SHARE_SERVER_ID };
  }

  /** Assert both halves of the share URL are gone: the hash AND nDB serverId. */
  function expectShareUrlCleared(label: string) {
    expect(window.location.hash, `${label}: window.location.hash must be cleared`).toBe('');
    expect(nDBStore[SONG_KEY]?.serverId, `${label}: nDB serverId must be cleared`).toBeUndefined();
  }

  beforeEach(() => {
    vi.resetModules();
    Object.keys(nDBStore).forEach((key) => delete nDBStore[key]);
    document.body.innerHTML = '';
    saveSongDataMock = vi.fn().mockResolvedValue(undefined);
    isSongInFirebaseGroupMock = vi.fn(() => true);

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

    window.location.hash = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  // ------------------------------------------------------------------
  // 1. Marker tool actions (copy / move / delete / stretch)
  // ------------------------------------------------------------------
  describe('clears the share URL for marker tool actions', () => {
    const markerToolCases: Array<{ action: string; dialogAction: string }> = [
      { action: 'copy', dialogAction: 'copyMarkers' },
      { action: 'moveUp', dialogAction: 'moveMarkers' },
      { action: 'moveDown', dialogAction: 'moveMarkers' },
      { action: 'moveAllUp', dialogAction: 'moveMarkers' },
      { action: 'moveAllDown', dialogAction: 'moveMarkers' },
      { action: 'deleteSelected', dialogAction: 'deleteMarkers' },
      { action: 'deleteAll', dialogAction: 'deleteMarkers' },
      { action: 'stretchSelected', dialogAction: 'stretchMarkers' },
      { action: 'stretchAll', dialogAction: 'stretchMarkers' },
    ];

    for (const toolCase of markerToolCases) {
      it(`clears the share URL for marker tool action "${toolCase.action}"`, async () => {
        createRequiredDom();
        nDBStore[SONG_KEY] = {
          markers: [
            { id: 'm0', time: 0 },
            { id: 'm1', time: 10 },
            { id: 'm2', time: 20 },
          ],
          aStates: [],
        };
        mockModules();
        await bootV2Script();
        saveSongDataMock.mockClear();
        armShareUrl();

        const settingsPanel = document.getElementById('settingsPanel')!;
        // Open the tools dialog (created lazily by v2Script).
        settingsPanel.dispatchEvent(
          new CustomEvent('song-action-requested', {
            detail: { action: toolCase.dialogAction },
            bubbles: true,
            composed: true,
          })
        );

        const toolsDialog = document.querySelector('t-marker-tools-dialog');
        expect(toolsDialog, 'marker tools dialog must open').toBeTruthy();

        (toolsDialog as HTMLElement).dispatchEvent(
          new CustomEvent('marker-tools-action', {
            detail: { action: toolCase.action, value: 10 },
          })
        );

        expectShareUrlCleared(`marker tool "${toolCase.action}"`);
        // The sync half of the rule must not regress either.
        expect(
          saveSongDataMock,
          'marker tool action must still call saveSongData'
        ).toHaveBeenCalledTimes(1);
        expect(saveSongDataMock).toHaveBeenCalledWith(SONG_KEY);
      }, 30000);
    }

    it('clears the share URL even when the song is NOT in a Firebase group', async () => {
      createRequiredDom();
      nDBStore[SONG_KEY] = {
        markers: [
          { id: 'm0', time: 0 },
          { id: 'm1', time: 10 },
          { id: 'm2', time: 20 },
        ],
        aStates: [],
      };
      mockModules();
      await bootV2Script();
      // Clearing must be unconditional: it does NOT depend on group membership.
      isSongInFirebaseGroupMock.mockReturnValue(false);
      saveSongDataMock.mockClear();
      armShareUrl();

      const settingsPanel = document.getElementById('settingsPanel')!;
      settingsPanel.dispatchEvent(
        new CustomEvent('song-action-requested', {
          detail: { action: 'copyMarkers' },
          bubbles: true,
          composed: true,
        })
      );
      const toolsDialog = document.querySelector('t-marker-tools-dialog');
      expect(toolsDialog, 'marker tools dialog must open').toBeTruthy();
      (toolsDialog as HTMLElement).dispatchEvent(
        new CustomEvent('marker-tools-action', { detail: { action: 'copy', value: 10 } })
      );

      expectShareUrlCleared('marker tool outside a Firebase group');
      expect(saveSongDataMock).toHaveBeenCalledWith(SONG_KEY);
    }, 30000);
  });

  // ------------------------------------------------------------------
  // 2. The other synced actions
  // ------------------------------------------------------------------
  describe('clears the share URL for the other synced actions', () => {
    it('clears the share URL for marker-created / marker-updated / marker-deleted', async () => {
      const { footer } = createRequiredDom();
      nDBStore[SONG_KEY] = { markers: [{ id: 'm1', time: 10, name: 'One' }], aStates: [] };
      mockModules();
      await bootV2Script();
      saveSongDataMock.mockClear();

      const markerEvents: CustomEvent[] = [
        new CustomEvent('marker-created', {
          detail: { marker: { id: 'm-new', time: 42, name: 'New' } },
        }),
        new CustomEvent('marker-updated', {
          detail: { marker: { id: 'm1', time: 15, name: 'Updated' } },
        }),
        new CustomEvent('marker-deleted', { detail: { markerId: 'm1' } }),
      ];

      for (const markerEvent of markerEvents) {
        armShareUrl();
        footer.dispatchEvent(markerEvent);
        expectShareUrlCleared(`footer event "${markerEvent.type}"`);
      }

      expect(saveSongDataMock).toHaveBeenCalledTimes(3);
      expect(saveSongDataMock).toHaveBeenCalledWith(SONG_KEY);
    }, 30000);

    it('clears the share URL after rememberState confirms the dialog', async () => {
      createRequiredDom();
      nDBStore[SONG_KEY] = { markers: [], aStates: [] };
      mockModules();
      await bootV2Script();
      saveSongDataMock.mockClear();
      armShareUrl();

      const settingsPanel = document.getElementById('settingsPanel')!;
      settingsPanel.dispatchEvent(
        new CustomEvent('song-action-requested', {
          detail: { action: 'rememberState' },
          bubbles: true,
          composed: true,
        })
      );

      const dialog = document.querySelector('t-text-input-dialog') as
        | (HTMLElement & { open: boolean })
        | null;
      expect(dialog, 't-text-input-dialog must open for rememberState').toBeTruthy();
      expect(dialog!.open).toBe(true);

      dialog!.dispatchEvent(
        new CustomEvent('text-input-confirmed', {
          detail: { value: 'Share URL State' },
          bubbles: true,
          composed: true,
        })
      );

      expect(saveSongDataMock).toHaveBeenCalledTimes(1);
      expect(saveSongDataMock).toHaveBeenCalledWith(SONG_KEY);
      expectShareUrlCleared('rememberState');
    }, 30000);

    it('clears the share URL after removeState', async () => {
      createRequiredDom();
      nDBStore[SONG_KEY] = {
        markers: [],
        aStates: ['{"name":"s1","currentMarker":"markerNr0"}'],
      };
      mockModules();
      await bootV2Script();
      saveSongDataMock.mockClear();
      armShareUrl();

      const settingsPanel = document.getElementById('settingsPanel')!;
      settingsPanel.dispatchEvent(
        new CustomEvent('song-action-requested', {
          detail: { action: 'removeState', index: 0 },
          bubbles: true,
          composed: true,
        })
      );

      expect(saveSongDataMock).toHaveBeenCalledTimes(1);
      expect(saveSongDataMock).toHaveBeenCalledWith(SONG_KEY);
      expectShareUrlCleared('removeState');
    }, 30000);

    it('clears the share URL after import markers', async () => {
      createRequiredDom();
      nDBStore[SONG_KEY] = { markers: [] };
      mockModules();
      await bootV2Script();
      saveSongDataMock.mockClear();
      armShareUrl();

      const settingsPanel = document.getElementById('settingsPanel')!;
      settingsPanel.dispatchEvent(
        new CustomEvent('song-action-requested', {
          detail: { action: 'importExport' },
          bubbles: true,
          composed: true,
        })
      );

      const importDialog = document.querySelector('t-import-export-dialog');
      expect(importDialog, 't-import-export-dialog must open').toBeTruthy();

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
      await flush(10);

      expect(saveSongDataMock).toHaveBeenCalledTimes(1);
      expect(saveSongDataMock).toHaveBeenCalledWith(SONG_KEY);
      expectShareUrlCleared('import markers');
    }, 30000);

    it('clears the share URL after the debounced song-info-saved sync', async () => {
      createRequiredDom();
      nDBStore[SONG_KEY] = { markers: [] };
      mockModules();
      await bootV2Script();
      saveSongDataMock.mockClear();
      armShareUrl();

      vi.useFakeTimers();
      try {
        document.dispatchEvent(new CustomEvent('song-info-saved', { detail: { info: 'edited' } }));
        expect(nDBStore[SONG_KEY].info, 'nDB info write stays immediate').toBe('edited');

        // The clear rides along with the debounced save, so it must not
        // happen before the 2000ms window has elapsed.
        expect(window.location.hash, 'not cleared before the 2000ms debounce').toBe(SHARE_HASH);

        vi.advanceTimersByTime(2000);
        expect(saveSongDataMock).toHaveBeenCalledTimes(1);
        expect(saveSongDataMock).toHaveBeenCalledWith(SONG_KEY);
        expectShareUrlCleared('song-info-saved');
      } finally {
        vi.useRealTimers();
      }
    }, 30000);

    it('clears the share URL after song-saved (fileData metadata)', async () => {
      createRequiredDom();
      nDBStore[SONG_KEY] = { markers: [] };
      mockModules();
      await bootV2Script();
      saveSongDataMock.mockClear();
      armShareUrl();

      document.dispatchEvent(
        new CustomEvent('song-saved', {
          detail: { songKey: SONG_KEY, fileData: { title: 'New Title' } },
        })
      );
      await flush(50);

      expect(saveSongDataMock).toHaveBeenCalledTimes(1);
      expect(saveSongDataMock).toHaveBeenCalledWith(SONG_KEY);
      expectShareUrlCleared('song-saved');
    }, 30000);

    it('clears the share URL after the debounced tap-tempo sync', async () => {
      createRequiredDom();
      nDBStore[SONG_KEY] = { markers: [] };
      mockModules();
      await bootV2Script();
      saveSongDataMock.mockClear();
      armShareUrl();

      vi.useFakeTimers();
      try {
        const settingsPanel = document.getElementById('settingsPanel')!;
        settingsPanel.dispatchEvent(
          new CustomEvent('setting-changed', {
            detail: { setting: 'tempo', value: 100 },
            bubbles: true,
            composed: true,
          })
        );
        expect(nDBStore[SONG_KEY].TROFF_VALUE_tapTempo, 'nDB tempo write stays immediate').toBe(
          100
        );

        // The clear rides along with the debounced save (900ms), not with the
        // nDB write.
        expect(window.location.hash, 'not cleared before the 900ms debounce').toBe(SHARE_HASH);

        vi.advanceTimersByTime(1000);
        expect(saveSongDataMock).toHaveBeenCalledTimes(1);
        expect(saveSongDataMock).toHaveBeenCalledWith(SONG_KEY);
        expectShareUrlCleared('tap-tempo');
      } finally {
        vi.useRealTimers();
      }
    }, 30000);
  });

  // ------------------------------------------------------------------
  // 3. Local-only actions must keep the share URL intact
  // ------------------------------------------------------------------
  describe('does NOT clear the share URL for local-only playback settings', () => {
    it('keeps the share URL and never calls saveSongData for disallowed actions', async () => {
      const { footer, settingsPanel, markerSlider } = createRequiredDom();
      nDBStore[SONG_KEY] = {
        markers: [{ id: 'm0', time: 0 }],
        aStates: ['{"name":"s1","currentMarker":"markerNr0"}'],
      };
      mockModules();
      await bootV2Script();
      saveSongDataMock.mockClear();
      armShareUrl();

      const disallowedSettings: Array<{ setting: string; value: string | number | boolean }> = [
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
      for (const detail of disallowedSettings) {
        settingsPanel.dispatchEvent(
          new CustomEvent('setting-changed', { detail, bubbles: true, composed: true })
        );
      }

      footer.dispatchEvent(new CustomEvent('speed-changed', { detail: { speed: 95 } }));
      footer.dispatchEvent(new CustomEvent('volume-changed', { detail: { volume: 70 } }));
      footer.dispatchEvent(
        new CustomEvent('pause-before-changed', {
          detail: { pauseBefore: 3, disabled: false },
        })
      );
      footer.dispatchEvent(
        new CustomEvent('wait-between-changed', {
          detail: { waitBetween: 2, disabled: true },
        })
      );

      markerSlider.dispatchEvent(
        new CustomEvent('set-start-marker', { detail: { markerId: 'markerNr0' } })
      );
      markerSlider.dispatchEvent(
        new CustomEvent('set-stop-marker', { detail: { markerId: 'markerNr1' } })
      );

      settingsPanel.dispatchEvent(
        new CustomEvent('song-action-requested', {
          detail: { action: 'setState', index: 0 },
          bubbles: true,
          composed: true,
        })
      );

      expect(
        window.location.hash,
        'local-only playback settings must keep the share URL hash'
      ).toBe(SHARE_HASH);
      expect(
        nDBStore[SONG_KEY].serverId,
        'local-only playback settings must keep the nDB serverId'
      ).toBe(SHARE_SERVER_ID);
      expect(
        saveSongDataMock,
        'disallowed actions must not trigger a shared save'
      ).not.toHaveBeenCalled();
    }, 30000);
  });

  // ------------------------------------------------------------------
  // 4. Boot / song selection must not clear a pre-existing navigation hash
  // ------------------------------------------------------------------
  describe('boot / song selection does not clear a pre-existing navigation hash', () => {
    it('keeps a pre-existing hash through boot and through song selection', async () => {
      createRequiredDom();
      nDBStore[SONG_KEY] = { markers: [{ id: 'm0', time: 0 }], aStates: [] };
      mockModules();

      // Arm the hash BEFORE boot and drain happy-dom's queued hashchange while
      // no listener exists (mirrors tests/v2Script-hash-import-loading.test.ts).
      armShareUrl();
      await flush(20);

      saveSongDataMock.mockClear();
      await bootV2Script();

      expect(window.location.hash, 'boot must not clear a pre-existing navigation hash').toBe(
        SHARE_HASH
      );
      expect(nDBStore[SONG_KEY].serverId, 'boot must not clear serverId').toBe(SHARE_SERVER_ID);

      // Song selection must not clear it either.
      const songList = document.getElementById('songList')!;
      songList.dispatchEvent(
        new CustomEvent('media-selected', {
          detail: { songKey: SONG_KEY },
          bubbles: true,
          composed: true,
        })
      );
      await flush(30);

      expect(
        window.location.hash,
        'song selection must not clear a pre-existing navigation hash'
      ).toBe(SHARE_HASH);
      expect(nDBStore[SONG_KEY].serverId, 'song selection must not clear serverId').toBe(
        SHARE_SERVER_ID
      );
      expect(
        saveSongDataMock,
        'boot / selection must not call saveSongData'
      ).not.toHaveBeenCalled();
    }, 30000);
  });
});
