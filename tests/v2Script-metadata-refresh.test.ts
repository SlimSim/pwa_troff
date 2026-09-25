import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Feature spec — remote song metadata + info propagation (Part 3, receive side).
 *
 * v2Script registers a live-update callback through setLiveUpdateCallback.
 * The handler keeps its existing behavior —
 *
 *     refreshCurrentSongUI(songKey);                       // always
 *
 * — and additionally reads a NEW third argument `metadataChanged: boolean`:
 *
 *   - metadataChanged === true AND the changed song IS the currently open song
 *       → updateHeaderWithCurrentSong() + updateFooterWithCurrentSong()
 *   - metadataChanged === true (changed song current or not)
 *       → songList.reloadSongs(), guarded by the existing
 *         `songList && typeof (songList as any).reloadSongs === 'function'` idiom
 *   - metadataChanged === false → NO header/footer calls, NO reloadSongs.
 *
 * Harness: boot + module mocks from tests/v2Script-song-sync.test.ts, plus the
 * sign-in trigger from tests/v2Script.test.ts ("boot-time sync refreshes the
 * already-loaded song") — the firebaseClient mock captures the auth callback so
 * the test can drive the signed-in branch where setLiveUpdateCallback runs.
 * Firebase and nDB are mocked; no real services are touched.
 */

// Holder so the hoisted firebaseClient mock can hand the auth callback to tests.
const authState = vi.hoisted(() => ({
  onAuthCb: null as ((user: unknown) => void) | null,
}));

vi.mock('../services/firebaseClient.js', () => ({
  auth: {},
  onAuthStateChanged: (_auth: unknown, cb: (user: unknown) => void) => {
    authState.onAuthCb = cb;
    return () => {};
  },
}));

/** Shape of the callback registered through setLiveUpdateCallback. */
type LiveUpdateHandler = (
  songKey: string,
  remoteData: Record<string, unknown>,
  metadataChanged?: boolean
) => void;

describe('v2Script live-update metadata refresh', () => {
  const CURRENT_SONG = 'test-song.mp3';

  // In-memory nDB backing store (updated by the nDB mock).
  const nDBStore: Record<string, Record<string, unknown>> = {};

  // Spies created by mockModules (assigned before v2Script is imported).
  let updateHeaderMock: ReturnType<typeof vi.fn>;
  let updateFooterMock: ReturnType<typeof vi.fn>;
  let getCurrentSongKeyMock: ReturnType<typeof vi.fn>;
  let setLiveUpdateCallbackMock: ReturnType<typeof vi.fn>;
  let reloadSongsMock: ReturnType<typeof vi.fn>;

  function createRequiredDom() {
    document.body.innerHTML = '';

    const header = document.createElement('div');
    header.id = 'header';
    document.body.appendChild(header);

    const songList = document.createElement('div') as unknown as HTMLElement & {
      reloadSongs: () => Promise<void>;
    };
    songList.id = 'songList';
    reloadSongsMock = vi.fn().mockResolvedValue(undefined);
    songList.reloadSongs = reloadSongsMock;
    document.body.appendChild(songList);

    const footer = document.createElement('div');
    footer.id = 'footer';
    document.body.appendChild(footer);

    const settingsPanel = document.createElement('div');
    settingsPanel.id = 'settingsPanel';
    document.body.appendChild(settingsPanel);

    const markerSlider = document.createElement('div') as unknown as HTMLElement & {
      getPlaybackStart: () => number;
      getPlaybackStop: () => number;
      markers: unknown[];
      min: number;
      max: number;
      value: number;
      requestUpdate: () => void;
      updateComplete: Promise<void>;
    };
    markerSlider.id = 'markerSlider';
    markerSlider.markers = [];
    markerSlider.min = 0;
    markerSlider.max = 180;
    markerSlider.value = 0;
    markerSlider.getPlaybackStart = vi.fn(() => 0);
    markerSlider.getPlaybackStop = vi.fn(() => 180);
    markerSlider.requestUpdate = vi.fn();
    markerSlider.updateComplete = Promise.resolve();
    document.body.appendChild(markerSlider);

    const currentSongControls = document.createElement('div');
    currentSongControls.id = 'currentSongControls';
    document.body.appendChild(currentSongControls);
  }

  function mockModules() {
    updateHeaderMock = vi.fn();
    updateFooterMock = vi.fn();
    getCurrentSongKeyMock = vi.fn(() => CURRENT_SONG);
    vi.doMock('../utils/current-song.js', () => ({
      updateHeaderWithCurrentSong: updateHeaderMock,
      setCurrentSong: vi.fn(),
      getCurrentSongMetadata: vi.fn(() => ({ duration: 180 })),
      getCurrentSongKey: getCurrentSongKeyMock,
      updateFooterWithCurrentSong: updateFooterMock,
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
        load: vi.fn(),
      },
      loadSong: vi.fn(() => Promise.resolve({ url: 'blob:test-song', isVideo: false })),
    }));

    vi.doMock('../utils/firebase-sync.js', () => ({
      syncFirebaseGroups: vi.fn().mockResolvedValue(undefined),
    }));

    setLiveUpdateCallbackMock = vi.fn();
    vi.doMock('../utils/firebase-realtime.js', () => ({
      setupListeners: vi.fn().mockResolvedValue(undefined),
      setupGroupSongListeners: vi.fn().mockResolvedValue(undefined),
      teardownListeners: vi.fn(),
      saveSongData: vi.fn().mockResolvedValue(undefined),
      isSongInFirebaseGroup: vi.fn(() => true),
      setLiveUpdateCallback: setLiveUpdateCallbackMock,
      setGroupUpdateCallback: vi.fn(),
    }));

    vi.doMock('../assets/internal/notify-js/notify.config.js', () => ({}));

    vi.doMock('../utils/log.js', () => ({
      default: { i: vi.fn(), w: vi.fn(), e: vi.fn(), d: vi.fn(), t: vi.fn() },
    }));

    vi.doMock('../utils/notification.js', () => ({
      showToast: vi.fn(),
      showLoading: vi.fn(() => ({ update: vi.fn(), done: vi.fn(), fail: vi.fn() })),
      showDownloadProgress: vi.fn(),
      hideDownloadProgress: vi.fn(),
    }));
  }

  const flush = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * Boot v2Script, fire DOMContentLoaded, then drive the signed-in auth branch
   * so v2Script registers its live-update callback.
   */
  async function bootSignedIn(): Promise<LiveUpdateHandler> {
    await import('../v2Script.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    // Let the boot auth-flow's dynamic import resolve so onAuthStateChanged
    // is registered before we trigger sign-in.
    await flush(30);

    expect(authState.onAuthCb, 'boot must register onAuthStateChanged').toBeTruthy();
    authState.onAuthCb!({ email: 'tester@example.com' });
    // syncFirebaseGroups + setupListeners + setLiveUpdateCallback are awaited
    // inside the auth callback.
    await flush(60);

    expect(
      setLiveUpdateCallbackMock,
      'signed-in boot must register the live-update callback'
    ).toHaveBeenCalledTimes(1);
    const handler = setLiveUpdateCallbackMock.mock.calls[0][0] as LiveUpdateHandler | undefined;
    expect(handler, 'setLiveUpdateCallback must receive a handler').toBeTypeOf('function');

    // Boot/sign-in already refreshed things once — start every assertion clean.
    updateHeaderMock.mockClear();
    updateFooterMock.mockClear();
    reloadSongsMock.mockClear();

    return handler!;
  }

  beforeEach(() => {
    vi.resetModules();
    Object.keys(nDBStore).forEach((key) => delete nDBStore[key]);
    document.body.innerHTML = '';
    authState.onAuthCb = null;
    nDBStore[CURRENT_SONG] = { markers: [] };

    // Make rAF synchronous (happy-dom does not implement it; v2Script uses it for UI timing).
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
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('metadataChanged=true for the currently open song refreshes header, footer AND the track list', async () => {
    createRequiredDom();
    mockModules();
    const onLiveUpdate = await bootSignedIn();

    onLiveUpdate(CURRENT_SONG, { markers: [{ id: 'remote' }] }, true);
    await flush(10);

    expect(
      updateHeaderMock,
      'metadata change on the open song must refresh the header title'
    ).toHaveBeenCalledTimes(1);
    expect(
      updateFooterMock,
      'metadata change on the open song must refresh the footer title'
    ).toHaveBeenCalledTimes(1);
    expect(
      reloadSongsMock,
      'metadata change must reload the track list'
    ).toHaveBeenCalledTimes(1);
  }, 30000);

  it('metadataChanged=true for a DIFFERENT song reloads the track list but leaves header/footer alone', async () => {
    createRequiredDom();
    mockModules();
    const onLiveUpdate = await bootSignedIn();

    onLiveUpdate('some-other-song.mp3', { markers: [{ id: 'remote' }] }, true);
    await flush(10);

    expect(updateHeaderMock, 'header only refreshes for the open song').not.toHaveBeenCalled();
    expect(updateFooterMock, 'footer only refreshes for the open song').not.toHaveBeenCalled();
    expect(
      reloadSongsMock,
      'the track list must reload for any song with new metadata'
    ).toHaveBeenCalledTimes(1);
  }, 30000);

  it('metadataChanged=false refreshes nothing (while metadataChanged=true does)', async () => {
    createRequiredDom();
    mockModules();
    const onLiveUpdate = await bootSignedIn();

    onLiveUpdate(CURRENT_SONG, { markers: [{ id: 'remote' }] }, false);
    await flush(10);

    expect(updateHeaderMock, 'no header refresh when only markers changed').not.toHaveBeenCalled();
    expect(updateFooterMock, 'no footer refresh when only markers changed').not.toHaveBeenCalled();
    expect(reloadSongsMock, 'no track-list reload when metadata is unchanged').not.toHaveBeenCalled();

    // Same handler, same song — but now metadata DID change. This half also
    // pins that the handler reads the 3rd argument (pre-feature it ignores it).
    onLiveUpdate(CURRENT_SONG, { markers: [{ id: 'remote2' }] }, true);
    await flush(10);

    expect(updateHeaderMock).toHaveBeenCalledTimes(1);
    expect(updateFooterMock).toHaveBeenCalledTimes(1);
    expect(reloadSongsMock).toHaveBeenCalledTimes(1);
  }, 30000);
});
