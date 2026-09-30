import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';

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

// Captured mocks so assertions can inspect what v2Script's hash-import flow
// calls (pattern: tests/v2Script-group-loading.test.ts — showLoading must be
// observable, so the whole notification module is mocked here).
const mocks = vi.hoisted(() => {
  const loadingController = {
    update: vi.fn(),
    done: vi.fn(),
    fail: vi.fn(),
  };
  return {
    loadingController,
    showLoading: vi.fn(() => loadingController),
    showToast: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Part 2 of "hash-link import prefetch + conditional loading + deferred errors"
// (v2Script.ts openImportDialog / import / merge / keep):
//
//  - Opening the import dialog starts a prefetch of the server markers
//    IMMEDIATELY (fetchServerTroffDataResult, mocked here with a controllable
//    deferred) instead of fetching only after the user picks an action.
//  - Choosing import/merge shows `showLoading('Fetching markers from server…')`
//    ONLY while the prefetch is still in flight; a prefetch that already
//    settled applies instantly with no loading UI.
//  - Deferred errors (ok:false) are reported AT CLICK TIME (alert or toast per
//    useAlert), never at fetch time.
//  - Choosing "keep" discards the prefetch: no loading, no error, nDB untouched.
//
// Boot/sequencing: hash is set BEFORE boot and the queued hashchange is drained
// while no listener exists, so the ONLY handleHashDownload run comes from
// v2Script's boot path (`if (window.location.hash) handleHashDownload(...)`).
// Every window/document listener registered by boot is tracked and removed in
// afterEach so stale v2Script instances cannot react to later tests' events.
// ---------------------------------------------------------------------------

interface ServerPayload {
  markers: Array<{ id: string; time: number }>;
  states: string[];
  info: string;
  serverId: number;
  fileUrl: string;
  duration: number;
}

type PrefetchResult =
  | { ok: true; data: ServerPayload }
  | { ok: false; message: string; useAlert: boolean };

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface ImportDialogElement extends HTMLElement {
  open: boolean;
  fileName: string;
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

const SONG_KEY = 'mysong.mp3';
const HASH_SERVER_ID = 123;
const LOCAL_SERVER_ID = 999;
const LOCAL_MARKER = { id: 'local1', time: 5 };

describe('v2Script hash import dialog: prefetch + conditional loading + deferred errors', () => {
  // In-memory nDB backing store (updated by the nDB mock).
  const nDBStore: Record<string, Record<string, unknown>> = {};

  // Per-test deferreds/mocks for the hash-download module (assigned by mockModules).
  let prefetch: Deferred<PrefetchResult>;
  let legacyFetchMock: ReturnType<typeof vi.fn>;
  let fetchResultMock: ReturnType<typeof vi.fn>;
  let alertSpy: MockInstance;

  // Every listener registered during a test — removed in afterEach so stale
  // module instances (vi.resetModules + re-import) cannot react later.
  let trackedListeners: Array<{
    target: EventTarget;
    type: string;
    listener: EventListenerOrEventListenerObject;
  }>;

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
  }

  function mockModules() {
    // Controllable prefetch (the NEW fetchServerTroffDataResult call) — one
    // fresh deferred per test so resolve/reject hooks drive the exact moment.
    prefetch = createDeferred<PrefetchResult>();
    // Legacy fetchServerTroffData (what pre-implementation code calls): also a
    // deferred that is never settled, so old code shows NO loading at all.
    const legacy = createDeferred<ServerPayload | null>();
    fetchResultMock = vi.fn(() => prefetch.promise);
    legacyFetchMock = vi.fn(() => legacy.promise);

    vi.doMock('../utils/hash-download.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../utils/hash-download.js')>();
      return {
        ...actual,
        parseHash: actual.parseHash, // real parseHash stays real
        fetchServerTroffDataResult: fetchResultMock,
        fetchServerTroffData: legacyFetchMock,
        downloadSongFromHash: vi.fn(async () => null),
      };
    });

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

    vi.doMock('../utils/firebase-realtime.js', () => ({
      setupListeners: vi.fn().mockResolvedValue(undefined),
      setupGroupSongListeners: vi.fn().mockResolvedValue(undefined),
      teardownListeners: vi.fn(),
      saveSongData: vi.fn().mockResolvedValue(undefined),
      isSongInFirebaseGroup: vi.fn(() => true),
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
      showToast: mocks.showToast,
      showLoading: mocks.showLoading,
      showDownloadProgress: vi.fn(),
      hideDownloadProgress: vi.fn(),
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
      mergeImportedMarkers: vi.fn((existing: unknown[], imported: unknown[]) => [
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
        (songData: { markers?: unknown[] } | null | undefined) => songData?.markers ?? []
      ),
      parseId3: vi.fn(),
    }));

    vi.doMock('../utils/formatters.js', () => ({
      formatDuration: vi.fn((t: number) => String(t)),
      countLast30Days: vi.fn(() => 0),
    }));
  }

  async function bootV2Script() {
    await import('../v2Script.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    // Allow auth IIFE + any setTimeout in boot to settle (mirrors existing v2 tests).
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  const flush = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

  async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while (!predicate()) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`waitFor: condition not met within ${timeoutMs}ms`);
      }
      await flush(10);
    }
  }

  function getImportDialog(): ImportDialogElement | null {
    return document.querySelector('t-import-dialog') as unknown as ImportDialogElement | null;
  }

  function selectAction(action: 'import' | 'merge' | 'keep') {
    const dialog = getImportDialog();
    if (!dialog) {
      throw new Error('t-import-dialog not found — import flow never opened');
    }
    dialog.dispatchEvent(new CustomEvent('import-action-selected', { detail: { action } }));
  }

  /**
   * Seed an existing local song (serverId 999), boot v2Script with
   * `#123&mysong.mp3` in the URL, and wait until the import dialog is open.
   */
  async function bootAndOpenImportDialog() {
    createRequiredDom();
    nDBStore[SONG_KEY] = {
      markers: [{ ...LOCAL_MARKER }],
      aStates: [],
      info: '',
      serverId: LOCAL_SERVER_ID,
    };
    mockModules();

    // Set the hash BEFORE boot and drain happy-dom's queued hashchange while no
    // listener exists — the only handleHashDownload run is the boot-time one.
    window.location.hash = `#${HASH_SERVER_ID}&${SONG_KEY}`;
    await flush(20);

    await bootV2Script();
    await waitFor(() => getImportDialog() !== null);
  }

  beforeEach(() => {
    vi.resetModules();
    Object.keys(nDBStore).forEach((key) => delete nDBStore[key]);
    document.body.innerHTML = '';

    mocks.showLoading.mockClear();
    mocks.showToast.mockClear();
    mocks.loadingController.update.mockClear();
    mocks.loadingController.done.mockClear();
    mocks.loadingController.fail.mockClear();

    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    // Track every document/window listener registered during the test so stale
    // v2Script instances cannot react to events in later tests.
    trackedListeners = [];
    const origDocAdd = document.addEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation(
      (
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions
      ) => {
        if (listener) {
          trackedListeners.push({ target: document, type, listener });
          origDocAdd(type, listener, options);
        }
      }
    );
    const origWinAdd = window.addEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation(
      (
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions
      ) => {
        if (listener) {
          trackedListeners.push({ target: window, type, listener });
          origWinAdd(type, listener, options);
        }
      }
    );

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

    // Default: online, no hash.
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    window.location.hash = '';
  });

  afterEach(() => {
    for (const { target, type, listener } of trackedListeners) {
      target.removeEventListener(type, listener);
    }
    trackedListeners = [];
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  // ------------------------------------------------------------------
  // 1. Prefetch starts when the dialog opens (RED: old code never calls it)
  // ------------------------------------------------------------------
  it('opening the dialog starts the prefetch immediately (once, with 123 + filename)', async () => {
    await bootAndOpenImportDialog();

    expect(fetchResultMock, 'prefetch must start when the dialog opens').toHaveBeenCalledTimes(1);
    expect(fetchResultMock).toHaveBeenCalledWith(HASH_SERVER_ID, SONG_KEY);

    const dialog = getImportDialog();
    expect(dialog).toBeTruthy();
    expect(dialog!.open).toBe(true);
    expect(dialog!.fileName).toBe(SONG_KEY);
  }, 30000);

  // ------------------------------------------------------------------
  // 2. Import while prefetch pending → loading, then data applied (RED)
  // ------------------------------------------------------------------
  it('import while prefetch pending: shows loading, then done() + server markers applied', async () => {
    await bootAndOpenImportDialog();

    selectAction('import');
    await flush();

    expect(mocks.showLoading, 'pending prefetch must show loading').toHaveBeenCalledTimes(1);
    expect(mocks.showLoading).toHaveBeenCalledWith('Fetching markers from server…');

    prefetch.resolve({
      ok: true,
      data: {
        markers: [{ id: 'srv1', time: 42 }],
        states: [],
        info: 'server info',
        serverId: HASH_SERVER_ID,
        fileUrl: 'https://example.com/mysong.mp3',
        duration: 60,
      },
    });
    await flush();

    expect(mocks.loadingController.done).toHaveBeenCalledTimes(1);
    expect(mocks.loadingController.fail).not.toHaveBeenCalled();

    const song = nDBStore[SONG_KEY];
    expect(song.serverId).toBe(HASH_SERVER_ID);
    expect(song.markers).toEqual([{ id: 'srv1', time: 42 }]);
    expect(song.info).toBe('server info');
  }, 30000);

  // ------------------------------------------------------------------
  // 3. Import when prefetch already settled → NO loading, data still applied (RED)
  // ------------------------------------------------------------------
  it('import when prefetch already settled: no loading, data still applied', async () => {
    await bootAndOpenImportDialog();

    // Settle BEFORE the user clicks.
    prefetch.resolve({
      ok: true,
      data: {
        markers: [{ id: 'srv1', time: 42 }],
        states: [],
        info: '',
        serverId: HASH_SERVER_ID,
        fileUrl: 'https://example.com/mysong.mp3',
        duration: 60,
      },
    });
    await flush();

    selectAction('import');
    await flush();

    expect(mocks.showLoading, 'settled prefetch must not show loading').not.toHaveBeenCalled();
    expect(mocks.loadingController.done).not.toHaveBeenCalled();

    const song = nDBStore[SONG_KEY];
    expect(song.serverId, 'settled prefetch data must still be applied').toBe(HASH_SERVER_ID);
    expect(song.markers).toEqual([{ id: 'srv1', time: 42 }]);
  }, 30000);

  // ------------------------------------------------------------------
  // 4. Merge while prefetch pending → loading, then BOTH marker sets (RED)
  // ------------------------------------------------------------------
  it('merge while prefetch pending: shows loading, merged markers keep local + server', async () => {
    await bootAndOpenImportDialog();

    selectAction('merge');
    await flush();

    expect(mocks.showLoading, 'pending prefetch must show loading').toHaveBeenCalledTimes(1);
    expect(mocks.showLoading).toHaveBeenCalledWith('Fetching markers from server…');

    prefetch.resolve({
      ok: true,
      data: {
        markers: [{ id: 'srv1', time: 42 }],
        states: [],
        info: '',
        serverId: HASH_SERVER_ID,
        fileUrl: 'https://example.com/mysong.mp3',
        duration: 60,
      },
    });
    await flush();

    expect(mocks.loadingController.done).toHaveBeenCalledTimes(1);

    const song = nDBStore[SONG_KEY];
    const markerIds = (song.markers as Array<{ id: string }>).map((marker) => marker.id);
    expect(markerIds, 'local marker must survive a merge').toContain(LOCAL_MARKER.id);
    expect(markerIds, 'server marker must be added by a merge').toContain('srv1');
    // Completion proof: a finished merge clears the URL hash (setUrlToSong).
    expect(window.location.hash, 'merge must finish through to setUrlToSong').toBe('');
  }, 30000);

  // ------------------------------------------------------------------
  // 5. Keep while a failed prefetch is pending → discard, nothing surfaces (RED)
  // ------------------------------------------------------------------
  it('keep while prefetch pending: no loading/alert/toast, prefetch discarded, nDB untouched', async () => {
    await bootAndOpenImportDialog();

    selectAction('keep');
    await flush();

    expect(mocks.showLoading, 'keep must never show loading').not.toHaveBeenCalled();

    // The discarded prefetch fails afterwards — it must never surface.
    prefetch.resolve({ ok: false, useAlert: true, message: 'BOOM' });
    await flush();

    expect(
      fetchResultMock,
      'prefetch existed (started at dialog open) so "keep" had something to discard'
    ).toHaveBeenCalledTimes(1);
    expect(alertSpy, 'discarded prefetch must never alert').not.toHaveBeenCalled();
    expect(mocks.showToast, 'discarded prefetch must never toast').not.toHaveBeenCalled();
    expect(mocks.loadingController.done).not.toHaveBeenCalled();
    expect(mocks.loadingController.fail).not.toHaveBeenCalled();

    const song = nDBStore[SONG_KEY];
    expect(song.serverId).toBe(LOCAL_SERVER_ID);
    expect(song.markers).toEqual([{ ...LOCAL_MARKER }]);
    // Completion proof: a finished keep clears the URL hash (setUrlToSong).
    expect(window.location.hash, 'keep must finish through to setUrlToSong').toBe('');
  }, 30000);

  // ------------------------------------------------------------------
  // 6. Deferred toast-kind error → toast AFTER the click (RED)
  // ------------------------------------------------------------------
  it('import with deferred toast-error: toast fires after the click, no loading, nDB untouched', async () => {
    await bootAndOpenImportDialog();

    // Prefetch already FAILED before the user picks an action.
    prefetch.resolve({ ok: false, useAlert: false, message: 'LINK OUTDATED' });
    await flush();

    selectAction('import');
    await flush();

    expect(mocks.showLoading, 'failed prefetch must not show loading').not.toHaveBeenCalled();
    expect(mocks.showToast).toHaveBeenCalledWith('LINK OUTDATED', 'error', 5000);
    expect(alertSpy).not.toHaveBeenCalled();

    const song = nDBStore[SONG_KEY];
    expect(song.serverId).toBe(LOCAL_SERVER_ID);
    expect(song.markers).toEqual([{ ...LOCAL_MARKER }]);
  }, 30000);

  // ------------------------------------------------------------------
  // 7. Deferred alert-kind error → alert AFTER the click (RED)
  // ------------------------------------------------------------------
  it('import with deferred alert-error: alert("BOOM") fires after the click', async () => {
    await bootAndOpenImportDialog();

    prefetch.resolve({ ok: false, useAlert: true, message: 'BOOM' });
    await flush();

    selectAction('import');
    await flush();

    expect(mocks.showLoading, 'failed prefetch must not show loading').not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('BOOM');

    const song = nDBStore[SONG_KEY];
    expect(song.serverId).toBe(LOCAL_SERVER_ID);
    expect(song.markers).toEqual([{ ...LOCAL_MARKER }]);
  }, 30000);
});
