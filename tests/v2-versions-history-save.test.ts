import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { TROFF_TROFF_DATA_ID_AND_FILE_NAME } from '../constants/constants.js';
import type { TroffHistoryList } from '../types/troff.d.js';

// Same firebaseClient mock as other v2Script harnesses (auth IIFE + boot dynamic import).
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
// v2 gap: hash-link import-new / merge never records version history.
//
// v1 parity (scriptTroffClass.ts `saveDownloadLinkHistory` + callers
// `importTroffDataToExistingSong_importNew` / `_merge`): after fetching the
// server TroffData for `#serverId&fileName`, v1 saves the server version into
// nDB key TROFF_TROFF_DATA_ID_AND_FILE_NAME (fileNameUri ->
// troffDataIdObjectList, deduped by troffDataId) so the "N versions" link
// knows the count.
//
// v2 (v2Script.ts `handleImportNewMarkers` / `handleMergeMarkers` via
// utils/hash-download.ts `fetchServerTroffData`): both fetch server data and
// write markers/states/info to nDB, but NEVER call `saveDownloadLinkHistory`.
// Only fresh downloads (`downloadSongFromHash`) and uploads (`upload-song.ts`)
// save history. So v2 `getVersionInfo` only displays a count when history
// already exists and never records the newly seen version.
//
// These tests drive the REAL v2Script dialog (no re-implementation of the
// handlers) with a mocked Firestore backend and assert the DESIRED v1-parity
// behavior: after import-new / merge, history contains the new troffDataId.
// They MUST FAIL (RED) until @coder adds the save call.
// ---------------------------------------------------------------------------

const SONG_KEY = 'mysong.mp3';
const HASH_SERVER_ID = 123;
const LOCAL_SERVER_ID = 999;

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

describe('v2 import-new/merge records version history (v1 parity)', () => {
  const nDBStore: Record<string, unknown> = {};
  let alertSpy: MockInstance;
  let trackedListeners: Array<{
    target: EventTarget;
    type: string;
    listener: EventListenerOrEventListenerObject;
  }>;

  function serverDocFor(serverId: number, fileName: string): Record<string, unknown> {
    return {
      fileName,
      fileUrl: 'https://example.com/' + fileName,
      fileSize: 1234,
      fileType: 'audio/mpeg',
      id: serverId,
      markerJsonString: JSON.stringify({
        markers: [{ id: 'srv1', time: 42 }],
        aStates: [],
        info: 'server info',
        fileData: { title: 'Server Title', duration: 60 },
      }),
      troffDataPublic: true,
      troffDataUploadedMillis: Date.now(),
    };
  }

  function createRequiredDom(): void {
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

  function mockModules(): void {
    // Firestore backend for the REAL utils/hash-download.js fetchServerTroffData.
    const serverDoc = serverDocFor(HASH_SERVER_ID, SONG_KEY);
    vi.doMock('../utils/firebase-getter.js', () => ({
      getFirestore: vi.fn().mockResolvedValue({
        db: {},
        doc: vi.fn((_db: unknown, _col: string, id: string) => ({ id })),
        getDoc: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => serverDoc,
        }),
      }),
      getStorageHandle: vi.fn().mockResolvedValue({
        getFreshDownloadUrl: vi.fn(async (url: string) => url),
      }),
    }));

    // NOTE: utils/hash-download.js is intentionally NOT mocked here so the
    // real fetchServerTroffData + real saveDownloadLinkHistory run against the
    // mocked nDB / Firestore above. The RED assertion is that the v2 handlers
    // never call saveDownloadLinkHistory.

    vi.doMock('../utils/current-song.js', () => ({
      updateHeaderWithCurrentSong: vi.fn(),
      setCurrentSong: vi.fn(),
      getCurrentSongMetadata: vi.fn(() => ({ duration: 180 })),
      getCurrentSongKey: vi.fn(() => SONG_KEY),
      updateFooterWithCurrentSong: vi.fn(),
    }));

    vi.doMock('../assets/internal/db.js', () => ({
      nDB: {
        get: vi.fn((key: string) => (key in nDBStore ? nDBStore[key] : null)),
        set: vi.fn((key: string, value: unknown) => {
          nDBStore[key] = value;
        }),
        setOnSong: vi.fn((key: string, path: string | string[], value: unknown) => {
          const songData = (nDBStore[key] as Record<string, unknown> | undefined) ?? {};
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
      default: { i: vi.fn(), w: vi.fn(), e: vi.fn() },
    }));

    vi.doMock('../utils/notification.js', () => ({
      showToast: vi.fn(),
      showLoading: vi.fn(() => ({ update: vi.fn(), done: vi.fn(), fail: vi.fn() })),
      showDownloadProgress: vi.fn(() => ({ update: vi.fn(), done: vi.fn() })),
      hideDownloadProgress: vi.fn(),
    }));

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

  async function bootV2Script(): Promise<void> {
    await import('../v2Script.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  const flush = (ms = 50): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while (!predicate()) {
      if (Date.now() - start > timeoutMs) {
        throw new Error('waitFor: condition not met within ' + timeoutMs + 'ms');
      }
      await flush(10);
    }
  }

  function getImportDialog(): ImportDialogElement | null {
    return document.querySelector('t-import-dialog') as unknown as ImportDialogElement | null;
  }

  function selectAction(action: 'import' | 'merge' | 'keep'): void {
    const dialog = getImportDialog();
    if (!dialog) {
      throw new Error('t-import-dialog not found — import flow never opened');
    }
    dialog.dispatchEvent(new CustomEvent('import-action-selected', { detail: { action } }));
  }

  function historyIds(): number[] {
    const history = nDBStore[TROFF_TROFF_DATA_ID_AND_FILE_NAME] as
      | TroffHistoryList[]
      | undefined
      | null;
    if (!history) return [];
    const entry = history.find((h) => h.fileNameUri === encodeURI(SONG_KEY));
    if (!entry) return [];
    return entry.troffDataIdObjectList.map((o) => o.troffDataId);
  }

  async function bootAndOpenImportDialog(): Promise<void> {
    createRequiredDom();
    nDBStore[SONG_KEY] = {
      markers: [{ id: 'local1', time: 5 }],
      aStates: [],
      info: '',
      serverId: LOCAL_SERVER_ID,
    };
    // Pre-existing history for the LOCAL version only — mirrors a song that
    // was uploaded/shared once before (so getVersionInfo has something to read).
    nDBStore[TROFF_TROFF_DATA_ID_AND_FILE_NAME] = [
      {
        fileNameUri: encodeURI(SONG_KEY),
        troffDataIdObjectList: [
          {
            troffDataId: LOCAL_SERVER_ID,
            firstTimeLoaded: 1,
            displayName: 'Local',
            nrMarkers: 1,
            nrStates: 0,
            infoBeginning: '',
            genre: '',
            tags: '',
          },
        ],
      },
    ];
    mockModules();

    window.location.hash = '#' + HASH_SERVER_ID + '&' + SONG_KEY;
    await flush(20);

    await bootV2Script();
    await waitFor(() => getImportDialog() !== null);
  }

  beforeEach(() => {
    vi.resetModules();
    Object.keys(nDBStore).forEach((key) => delete nDBStore[key]);
    document.body.innerHTML = '';

    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

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

    const raf = (cb: () => void): number => {
      cb();
      return 0;
    };
    vi.stubGlobal('requestAnimationFrame', raf);
    window.requestAnimationFrame = raf as unknown as typeof window.requestAnimationFrame;

    const registry = customElements;
    const originalDefine = registry.define.bind(registry);
    const patched = Object.create(registry);
    patched.define = (
      name: string,
      constructor: CustomElementConstructor,
      options?: ElementDefinitionOptions
    ): void => {
      if (!registry.get(name)) {
        originalDefine(name, constructor, options);
      }
    };
    vi.stubGlobal('customElements', patched);

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

  it('import-new via v2 dialog records the server version in history (v1 parity)', async () => {
    await bootAndOpenImportDialog();

    // Sanity: dialog opened for the hash server id, history starts with local only.
    expect(getImportDialog()).toBeTruthy();
    expect(historyIds()).toEqual([LOCAL_SERVER_ID]);

    selectAction('import');
    await flush(100);

    // Markers were applied (proves the handler ran to completion)...
    const song = nDBStore[SONG_KEY] as { serverId?: number };
    expect(song.serverId).toBe(HASH_SERVER_ID);

    // ...so v1 parity requires the newly seen server version to be recorded.
    // v2 gap: handleImportNewMarkers never calls saveDownloadLinkHistory.
    expect(historyIds()).toContain(HASH_SERVER_ID);
  }, 30000);

  it('merge via v2 dialog records the server version in history (v1 parity)', async () => {
    await bootAndOpenImportDialog();

    expect(getImportDialog()).toBeTruthy();
    expect(historyIds()).toEqual([LOCAL_SERVER_ID]);

    selectAction('merge');
    await flush(100);

    // Merge clears serverId (markers modified) — proves the handler ran.
    const song = nDBStore[SONG_KEY] as { serverId?: number };
    expect(song.serverId).toBeUndefined();

    // ...so v1 parity requires the newly seen server version to be recorded.
    // v2 gap: handleMergeMarkers never calls saveDownloadLinkHistory.
    expect(historyIds()).toContain(HASH_SERVER_ID);
  }, 30000);

  it('saveDownloadLinkHistory dedupes the same troffDataId (v1 semantics for @coder)', async () => {
    // Imports the ACTUAL function — never a re-implementation — and pins the
    // dedupe contract the v2 fix must mirror.
    const mod = await import('../utils/hash-download.js');
    expect(typeof mod.saveDownloadLinkHistory).toBe('function');

    // Fresh history store for this unit check.
    nDBStore[TROFF_TROFF_DATA_ID_AND_FILE_NAME] = [];
    const troffData = {
      markerJsonString: JSON.stringify({
        markers: [{ id: 'm1', time: 1 }],
        aStates: [],
        info: 'hello',
        fileData: { title: 'T' },
      }),
    };

    mod.saveDownloadLinkHistory(HASH_SERVER_ID, SONG_KEY, troffData);
    mod.saveDownloadLinkHistory(HASH_SERVER_ID, SONG_KEY, troffData);

    const history = nDBStore[TROFF_TROFF_DATA_ID_AND_FILE_NAME] as TroffHistoryList[];
    expect(history).toHaveLength(1);
    expect(history[0].fileNameUri).toBe(encodeURI(SONG_KEY));
    expect(history[0].troffDataIdObjectList).toHaveLength(1);
    expect(history[0].troffDataIdObjectList[0].troffDataId).toBe(HASH_SERVER_ID);
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
