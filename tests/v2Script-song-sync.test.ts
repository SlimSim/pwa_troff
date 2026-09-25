import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Same firebaseClient mock as the other v2Script harnesses (auth IIFE + boot dynamic import).
vi.mock('../services/firebaseClient.js', () => ({
  auth: {},
  onAuthStateChanged: vi.fn(() => () => {}),
  db: {},
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
}));

/**
 * Wiring contract for song metadata sync (v2Script `song-saved` /
 * `song-info-saved` listeners):
 *
 *  - `song-saved` for a song that IS in a Firebase group → saveSongData(songKey)
 *    wrapped in `song-sync-status` {songKey, syncing:true} before the save and
 *    {songKey, syncing:false} after it settles (drives the t-media badge).
 *  - `song-saved` for a song NOT in any Firebase group → nothing: no save,
 *    no badge (but isSongInFirebaseGroup IS consulted with the songKey).
 *  - `song-info-saved` → immediate local nDB write, Firebase save debounced
 *    2000ms PER SONG (independent timers), never a badge.
 *
 * Boot harness mirrors tests/v2Script-selective-firebase-sync.test.ts, plus
 * document-listener tracking (pattern: tests/v2Script-group-loading.test.ts)
 * so stale v2Script instances from earlier tests cannot react to this test's
 * events and pollute the captured `song-sync-status` sequence.
 */
describe('v2Script song metadata sync (badge + debounced song-info)', () => {
  // In-memory nDB backing store (updated by the nDB mock).
  const nDBStore: Record<string, Record<string, unknown>> = {};

  // Spies from the firebase-realtime mock (assigned by mockModules).
  let saveSongDataMock: ReturnType<typeof vi.fn>;
  let isSongInFirebaseGroupMock: ReturnType<typeof vi.fn>;

  // Captured `song-sync-status` dispatches from the song-saved listener.
  let syncStatusEvents: Array<{ songKey: string; syncing: boolean }>;

  // Every document listener registered during a test — removed in afterEach so
  // stale module instances (vi.resetModules + re-import) cannot react later.
  let trackedListeners: Array<{ type: string; listener: EventListenerOrEventListenerObject }>;

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
    const slider = markerSlider as unknown as HTMLElement & {
      getPlaybackStart: () => number;
      startMarkerId: string;
      stopMarkerId: string;
      max: number;
      min: number;
      value: number;
      requestUpdate: () => void;
      selectPreviousMarker: () => void;
      selectNextMarker: () => void;
    };
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
          nDBStore[key] = value as Record<string, unknown>;
        }),
        setOnSong: vi.fn((key: string, path: string | string[], value: unknown) => {
          const songData: Record<string, unknown> = nDBStore[key] ?? {};
          const parts = Array.isArray(path) ? path.map(String) : [String(path)];
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

    // Pure utils used inside handlers — no-op implementations so no real logic runs.
    vi.doMock('../utils/marker-actions.js', () => ({
      getSelectedMarkerRange: vi.fn(() => [0, 2]),
      copyMarkers: vi.fn((markers: unknown[]) => [...markers]),
      moveMarkers: vi.fn((markers: unknown[]) => [...markers]),
      stretchMarkers: vi.fn((markers: unknown[]) => [...markers]),
      deleteMarkers: vi.fn((markers: unknown[]) => markers.slice(0, 1)),
      normalizeMarkerTime: vi.fn((t: number) => t),
      mergeNearbyMarkers: vi.fn((markers: unknown[]) => markers),
    }));

    vi.doMock('../utils/marker-import.js', () => ({
      mergeImportedMarkers: vi.fn((existing: unknown[], imported: unknown[]) => [...existing, ...imported]),
    }));

    vi.doMock('../utils/troff-settings.js', () => ({
      configureMarkerSlider: vi.fn(),
      getStartBefore: vi.fn(() => 0),
      getStopAfter: vi.fn(() => 0),
      getIncrementUntil: vi.fn(() => 0),
      ensureDefaultMarkers: vi.fn(
        (songData: { markers?: unknown[] } | null | undefined) => songData?.markers ?? []
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

  /** Immediate `info` value stored for a song by the nDB mock (if any). */
  function getStoredInfo(songKey: string): unknown {
    const song = nDBStore[songKey];
    return song ? song.info : undefined;
  }

  beforeEach(() => {
    vi.resetModules();
    Object.keys(nDBStore).forEach((key) => delete nDBStore[key]);
    document.body.innerHTML = '';
    saveSongDataMock = vi.fn().mockResolvedValue(undefined);
    isSongInFirebaseGroupMock = vi.fn(() => true);

    // Track every document listener registered during the test so stale
    // v2Script instances cannot react to events in later tests.
    trackedListeners = [];
    const origAdd = document.addEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation(
      (
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions
      ) => {
        if (listener) {
          trackedListeners.push({ type, listener });
          origAdd(type, listener, options);
        }
      }
    );

    // Capture every song-sync-status dispatch (the t-media badge signal).
    syncStatusEvents = [];
    document.addEventListener('song-sync-status', (event: Event) => {
      const detail = (event as CustomEvent<{ songKey?: string; syncing?: boolean }>).detail;
      syncStatusEvents.push({
        songKey: detail?.songKey ?? '',
        syncing: detail?.syncing === true,
      });
    });

    // Make rAF synchronous (happy-dom does not implement it; v2Script uses for UI timing).
    const raf = (cb: Function) => {
      cb();
      return 0;
    };
    vi.stubGlobal('requestAnimationFrame', raf);
    window.requestAnimationFrame = raf;

    // Prevent duplicate custom element define errors on repeated v2Script imports.
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
    for (const { type, listener } of trackedListeners) {
      document.removeEventListener(type, listener);
    }
    trackedListeners = [];
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('song-saved for a Firebase-group song: saveSongData + song-sync-status true→false around the save', async () => {
    createRequiredDom();
    nDBStore['test-song.mp3'] = { markers: [] };
    mockModules();
    await bootV2Script();
    saveSongDataMock.mockClear();

    // Record badge events and the save call on ONE timeline so we can assert
    // that syncing:true is dispatched BEFORE the save and syncing:false AFTER.
    const timeline: string[] = [];
    saveSongDataMock.mockImplementation(() => {
      timeline.push('saveSongData');
      return Promise.resolve();
    });
    document.addEventListener('song-sync-status', (event: Event) => {
      const detail = (event as CustomEvent<{ syncing?: boolean }>).detail;
      timeline.push(detail?.syncing ? 'syncing:true' : 'syncing:false');
    });

    document.dispatchEvent(
      new CustomEvent('song-saved', {
        detail: { songKey: 'test-song.mp3', fileData: { title: 'New Title' } },
        bubbles: true,
        composed: true,
      })
    );
    await flush();

    expect(
      saveSongDataMock,
      'metadata edit must sync to Firebase for a group song'
    ).toHaveBeenCalledTimes(1);
    expect(saveSongDataMock).toHaveBeenCalledWith('test-song.mp3');
    expect(syncStatusEvents).toEqual([
      { songKey: 'test-song.mp3', syncing: true },
      { songKey: 'test-song.mp3', syncing: false },
    ]);
    expect(timeline, 'badge must turn on before the save and off after it').toEqual([
      'syncing:true',
      'saveSongData',
      'syncing:false',
    ]);
  }, 30000);

  it('song-saved for a song NOT in any Firebase group: isSongInFirebaseGroup consulted, no save, no badge', async () => {
    createRequiredDom();
    nDBStore['test-song.mp3'] = { markers: [] };
    mockModules();
    await bootV2Script();
    saveSongDataMock.mockClear();
    isSongInFirebaseGroupMock.mockReturnValue(false);

    document.dispatchEvent(
      new CustomEvent('song-saved', {
        detail: { songKey: 'test-song.mp3', fileData: { title: 'New Title' } },
        bubbles: true,
        composed: true,
      })
    );
    await flush();

    // The handler must consult isSongInFirebaseGroup(songKey) and take the
    // "not in a group" branch — pre-feature it never imports/calls it at all.
    expect(isSongInFirebaseGroupMock).toHaveBeenCalledWith('test-song.mp3');
    expect(saveSongDataMock, 'local-only song must not hit Firebase').not.toHaveBeenCalled();
    expect(syncStatusEvents, 'local-only song must not show the badge').toEqual([]);
  }, 30000);

  it('song-info-saved debounces PER SONG: rapid edits on A collapse to one save, A and B each get their own', async () => {
    createRequiredDom();
    nDBStore['test-song.mp3'] = { markers: [] };
    mockModules();
    await bootV2Script();
    saveSongDataMock.mockClear();

    // The handler reads the current song key per event — switch A → B mid-window.
    const currentSong = await import('../utils/current-song.js');

    vi.useFakeTimers();
    try {
      vi.mocked(currentSong.getCurrentSongKey).mockReturnValue('song-a.mp3');
      document.dispatchEvent(new CustomEvent('song-info-saved', { detail: { info: 'a-1' } }));
      document.dispatchEvent(new CustomEvent('song-info-saved', { detail: { info: 'a-2' } }));
      expect(getStoredInfo('song-a.mp3')).toBe('a-2');
      expect(saveSongDataMock, 'no save before the 2000ms window').not.toHaveBeenCalled();

      vi.mocked(currentSong.getCurrentSongKey).mockReturnValue('song-b.mp3');
      document.dispatchEvent(new CustomEvent('song-info-saved', { detail: { info: 'b-1' } }));
      expect(getStoredInfo('song-b.mp3')).toBe('b-1');
      expect(saveSongDataMock, 'still inside the debounce window').not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(2000);

      // Per-song timers: A's two events → ONE save; B → its own save.
      expect(saveSongDataMock.mock.calls).toEqual([['song-a.mp3'], ['song-b.mp3']]);
      expect(syncStatusEvents, 'song-info sync never dispatches a badge').toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  }, 30000);
});
