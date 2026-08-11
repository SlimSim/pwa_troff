import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TroffMarker } from '../types/troff.d.js';

/**
 * Feature spec — GitHub issue #31 "save the duration of the song".
 *
 * v2Script's `onLoadedMetadata` handler (attached to BOTH the audio singleton
 * and #videoElement) must, in addition to the existing behavior:
 *
 *   1. read the media duration from `getActiveMedia().duration`,
 *   2. IF a current song key exists (getCurrentSongKey) AND the media duration
 *      is a valid positive finite number (NaN / 0 / negative / undefined are
 *      NOT valid) AND the song's saved `fileData.duration` is NOT a valid
 *      positive finite number (missing / 0 / NaN / negative count as "not
 *      saved"):
 *        - persist it via `nDB.setOnSong(songKey, ['fileData', 'duration'], d)`,
 *        - refresh the track list via `songList.reloadSongs()` (only when the
 *          #songList element exists and exposes a reloadSongs function).
 *   3. NOT save when the saved duration is already valid, when the media
 *      duration is invalid, or when there is no current song key.
 *   4. always set `header.totalTime = formatDuration(getActiveMedia().duration)`.
 *
 * This is a WRITE-ONLY regression pin: the fix does not exist yet, so the
 * save-related tests MUST be RED. The harness mirrors tests/video-playback.test.ts
 * exactly — v2Script and services/audio.js are the REAL implementations; only
 * the listed modules (db, current-song, firebase-realtime, firebase-sync, log)
 * and globals are mocked.
 *
 * NOTE on the audio stub: happy-dom 20.x exposes HTMLMediaElement.duration as a
 * getter-ONLY accessor, so a plain `audio.duration = 125` assignment throws
 * ("Cannot set property duration ... which has only a getter"). Tests therefore
 * shadow it with an own data property via Object.defineProperty — environment
 * control, not app logic.
 */

// ---- nDB (New Database) mock ----
const nDBGetMock = vi.fn();
const nDBSetMock = vi.fn();
const nDBSetOnSongMock = vi.fn();

vi.mock('../assets/internal/db.js', () => ({
  nDB: {
    get: nDBGetMock,
    set: nDBSetMock,
    setOnSong: nDBSetOnSongMock,
  },
}));

// ---- current-song mock ----
const getCurrentSongKeyMock = vi.fn();
const setCurrentSongMock = vi.fn();

vi.mock('../utils/current-song.js', () => ({
  updateHeaderWithCurrentSong: vi.fn(),
  setCurrentSong: setCurrentSongMock,
  getCurrentSongMetadata: vi.fn(() => ({ duration: 120 })),
  getCurrentSongKey: getCurrentSongKeyMock,
  updateFooterWithCurrentSong: vi.fn(),
}));

// ---- Firebase mocks (never call real services) ----
vi.mock('../utils/firebase-realtime.js', () => ({
  setupListeners: vi.fn().mockResolvedValue(undefined),
  teardownListeners: vi.fn(),
  saveSongData: vi.fn().mockResolvedValue(undefined),
  setLiveUpdateCallback: vi.fn(),
}));

vi.mock('../utils/firebase-sync.js', () => ({
  syncFirebaseGroups: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/log.js', () => ({
  default: { i: vi.fn(), w: vi.fn(), e: vi.fn() },
}));

const TEST_SONG_KEY = 'test-song-key';

/**
 * Build a song object the way nDB stores it. `fileData` is optional because
 * some songs predate the field entirely — pass nothing to simulate that.
 */
function makeSongData(fileData?: Record<string, unknown>): Record<string, unknown> {
  const song: Record<string, unknown> = {
    markers: [
      { id: 'markerNr0', name: 'Start', time: 0, info: '', color: 'None' },
      { id: 'markerNr1', name: 'End', time: 125, info: '', color: 'None' },
    ] as TroffMarker[],
    localInformation: {},
  };
  if (fileData !== undefined) {
    song.fileData = fileData;
  }
  return song;
}

/**
 * happy-dom 20.x: HTMLMediaElement.duration is getter-only, so a plain
 * assignment throws. Define an own data property to control the reported
 * media duration (the same instance the REAL v2Script reads via
 * getActiveMedia().duration).
 */
function setAudioDuration(audio: HTMLAudioElement, seconds: number): void {
  Object.defineProperty(audio, 'duration', { value: seconds, configurable: true });
}

describe('issue #31 — save the song duration on loadedmetadata', () => {
  let domContentLoadedHandler: (() => void) | null;
  let header: HTMLElement & Record<string, any>;
  let songList: HTMLElement & { visible: boolean; reloadSongs: () => void };
  let footer: HTMLElement & Record<string, any>;
  let settingsPanel: HTMLElement & Record<string, any>;
  let markerSlider: HTMLElement & Record<string, any>;
  let videoPlayer: HTMLElement;
  let videoElement: HTMLVideoElement;
  let cacheMatchMock: ReturnType<typeof vi.fn>;
  let mqMatches: boolean;

  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    domContentLoadedHandler = null;
    mqMatches = true;

    // Make requestAnimationFrame fire synchronously (happy-dom doesn't implement it).
    const raf = (cb: Function) => {
      cb();
      return 0;
    };
    vi.stubGlobal('requestAnimationFrame', raf);
    window.requestAnimationFrame = raf;

    // Guard against duplicate custom element registrations across re-imports.
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

    // Capture the DOMContentLoaded listener registered by v2Script so each test
    // runs ONLY its own handler (stale handlers from earlier tests would
    // otherwise re-run with stale module state).
    const origAddEventListener = document.addEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation(
      (type: string, handler: any, options?: any) => {
        if (type === 'DOMContentLoaded') {
          domContentLoadedHandler = handler as () => void;
          return;
        }
        return origAddEventListener(type, handler, options);
      }
    );

    // Cache / URL / alert stubs — the REAL loadSong reads these globals.
    cacheMatchMock = vi.fn();
    cacheMatchMock.mockResolvedValue(undefined); // default: song not cached
    vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue({ match: cacheMatchMock }) });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.stubGlobal('alert', vi.fn());

    // Responsive placement: controllable matchMedia.
    const mq = {
      get matches() {
        return mqMatches;
      },
      addEventListener: (_type: string, _cb: () => void) => {},
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', vi.fn(() => mq));
    window.matchMedia = vi.fn(() => mq) as unknown as typeof window.matchMedia;

    // nDB mock defaults.
    nDBGetMock.mockReset();
    nDBSetMock.mockReset();
    nDBSetOnSongMock.mockReset();
    // Default song shape for a NEW song: fileData exists but duration is 0
    // (see utils/troff-settings.ts createNewSongEntry) — i.e. "not saved".
    nDBGetMock.mockImplementation((key: string) => {
      if (key === TEST_SONG_KEY) {
        return makeSongData({ duration: 0 });
      }
      return null;
    });

    getCurrentSongKeyMock.mockReset();
    getCurrentSongKeyMock.mockReturnValue(TEST_SONG_KEY);
    setCurrentSongMock.mockReset();

    // ---- DOM elements v2Script queries ----
    header = document.createElement('div');
    header.id = 'header';
    header.expanded = false;
    document.body.appendChild(header);

    songList = document.createElement('div') as unknown as HTMLElement & {
      visible: boolean;
      reloadSongs: () => void;
    };
    songList.id = 'songList';
    songList.visible = false;
    songList.reloadSongs = vi.fn().mockResolvedValue(undefined);
    document.body.appendChild(songList);

    footer = document.createElement('div');
    footer.id = 'footer';
    footer.isPlaying = false;
    footer.isStartingPlayback = false;
    footer.playbackCountdown = 0;
    footer.pauseBefore = 3;
    footer.waitBetween = 1;
    footer.disablePauseBefore = false;
    footer.disableWaitBetween = false;
    footer.loopTimesLeftLabel = '1';
    document.body.appendChild(footer);

    settingsPanel = document.createElement('div');
    settingsPanel.id = 'settingsPanel';
    settingsPanel.visible = false;
    document.body.appendChild(settingsPanel);

    markerSlider = document.createElement('div');
    markerSlider.id = 'markerSlider';
    markerSlider.markers = [];
    markerSlider.min = 0;
    markerSlider.max = 120;
    markerSlider.unit = 's';
    markerSlider.value = 0;
    markerSlider.minZoom = 1;
    markerSlider.zoomLevel = 1;
    markerSlider.getPlaybackStart = vi.fn(() => 0);
    markerSlider.getPlaybackStop = vi.fn(() => 120);
    markerSlider.requestUpdate = vi.fn();
    markerSlider.updateComplete = Promise.resolve();
    document.body.appendChild(markerSlider);

    videoPlayer = document.createElement('div');
    videoPlayer.id = 'videoPlayer';
    videoPlayer.hidden = true;
    videoElement = document.createElement('video');
    videoElement.id = 'videoElement';
    videoPlayer.appendChild(videoElement);
    document.body.appendChild(videoPlayer);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  /** Import v2Script and run its DOMContentLoaded initialization. */
  async function bootApp(): Promise<void> {
    await import('../v2Script.js');
    domContentLoadedHandler?.();
    await new Promise((r) => setTimeout(r, 0));
  }

  /**
   * Boot the REAL app, (optionally) set the media duration on the REAL audio
   * singleton, and fire the REAL loadedmetadata listener v2Script attached to
   * it. happy-dom's audio.duration is NaN by default, so tests that need a
   * specific value pass it here.
   */
  async function bootAndFireLoadedMetadata(duration?: number): Promise<HTMLAudioElement> {
    const { audio } = await import('../services/audio.js');
    if (duration !== undefined) {
      setAudioDuration(audio, duration);
    }
    await bootApp();
    audio.dispatchEvent(new Event('loadedmetadata'));
    await new Promise((r) => setTimeout(r, 0));
    return audio;
  }

  it('saves the media duration on the song when fileData.duration is missing (0) and refreshes the track list', async () => {
    nDBGetMock.mockImplementation((key: string) =>
      key === TEST_SONG_KEY ? makeSongData({ duration: 0 }) : null
    );

    await bootAndFireLoadedMetadata(125);

    expect(nDBSetOnSongMock).toHaveBeenCalledWith(
      TEST_SONG_KEY,
      ['fileData', 'duration'],
      125
    );
    expect(songList.reloadSongs).toHaveBeenCalled();
    expect(header.totalTime).toBe('2:05');
  });

  it('saves the duration when the song has no fileData at all', async () => {
    nDBGetMock.mockImplementation((key: string) =>
      key === TEST_SONG_KEY ? makeSongData() : null
    );

    await bootAndFireLoadedMetadata(125);

    expect(nDBSetOnSongMock).toHaveBeenCalledWith(
      TEST_SONG_KEY,
      ['fileData', 'duration'],
      125
    );
    expect(songList.reloadSongs).toHaveBeenCalled();
  });

  it('does NOT overwrite an existing valid saved duration', async () => {
    nDBGetMock.mockImplementation((key: string) =>
      key === TEST_SONG_KEY ? makeSongData({ duration: 200 }) : null
    );

    await bootAndFireLoadedMetadata(125);

    expect(nDBSetOnSongMock).not.toHaveBeenCalledWith(
      TEST_SONG_KEY,
      ['fileData', 'duration'],
      125
    );
    expect(songList.reloadSongs).not.toHaveBeenCalled();
    expect(header.totalTime).toBe('2:05');
  });

  it('does NOT save when the media duration is invalid (NaN)', async () => {
    nDBGetMock.mockImplementation((key: string) =>
      key === TEST_SONG_KEY ? makeSongData({ duration: 0 }) : null
    );

    // No duration given: happy-dom's audio.duration is NaN by default.
    await bootAndFireLoadedMetadata();

    expect(nDBSetOnSongMock).not.toHaveBeenCalledWith(
      TEST_SONG_KEY,
      ['fileData', 'duration'],
      expect.any(Number)
    );
    expect(songList.reloadSongs).not.toHaveBeenCalled();
    expect(header.totalTime).toBe('0:00');
  });

  it('does NOT save when the media duration is 0', async () => {
    nDBGetMock.mockImplementation((key: string) =>
      key === TEST_SONG_KEY ? makeSongData({ duration: 0 }) : null
    );

    await bootAndFireLoadedMetadata(0);

    expect(nDBSetOnSongMock).not.toHaveBeenCalledWith(
      TEST_SONG_KEY,
      ['fileData', 'duration'],
      expect.any(Number)
    );
    expect(songList.reloadSongs).not.toHaveBeenCalled();
  });

  it('does NOT save when there is no current song key', async () => {
    getCurrentSongKeyMock.mockReturnValue(null);
    nDBGetMock.mockImplementation(() => null);

    await bootAndFireLoadedMetadata(125);

    expect(nDBSetOnSongMock).not.toHaveBeenCalledWith(
      TEST_SONG_KEY,
      ['fileData', 'duration'],
      125
    );
    expect(songList.reloadSongs).not.toHaveBeenCalled();
  });

  it('saves when duration is a fractional value and header shows it formatted', async () => {
    nDBGetMock.mockImplementation((key: string) =>
      key === TEST_SONG_KEY ? makeSongData({ duration: 0 }) : null
    );

    await bootAndFireLoadedMetadata(125.9);

    expect(nDBSetOnSongMock).toHaveBeenCalledWith(
      TEST_SONG_KEY,
      ['fileData', 'duration'],
      125.9
    );
    // formatDuration floors: 125.9s -> 2:05
    expect(header.totalTime).toBe('2:05');
  });
});
