import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Feature: vertical waveform display — v2Script wiring.
 *
 * `loadSongIntoPlayer` must call `generateWaveformPeaks(result.url)` after
 * loading a song and assign `markerSlider.waveformPeaks = Array.from(peaks)`
 * when peaks are successfully generated. A request-ID guard must prevent a
 * stale (older) song's peaks from overwriting a newer song's peaks.
 *
 * The harness mirrors tests/v2Script-volume-speed-boot.test.ts: stub DOM
 * elements for the ids v2Script queries, guard duplicate custom element
 * registrations, stub rAF, mock Firebase/nDB/current-song/audio/waveform, and
 * drive `DOMContentLoaded` / `media-selected` manually. `generateWaveformPeaks`
 * is mocked with per-URL deferreds so tests control exactly when each song's
 * peaks resolve (needed for the stale-result race).
 */

interface AudioElementMock {
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  paused: boolean;
  src?: string;
  _src?: string;
  load: ReturnType<typeof vi.fn>;
  pause?: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
}

interface LoadSongResult {
  url: string;
  isVideo: boolean;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

// Hoisted state shared between the vi.doMock factories (registered in
// beforeEach) and the test bodies. vi.hoisted guarantees the object exists
// before any mock factory evaluates.
const hooks = vi.hoisted(() => ({
  onAuthCb: null as ((user: unknown) => void) | null,
  currentSongEntry: null as { strPath: string } | null,
  currentSongKey: null as string | null,
  songKey: 'track.mp3',
  songData: null as Record<string, unknown> | null,
  audio: null as AudioElementMock | null,
  loadSongResults: {} as Record<string, LoadSongResult>,
  peakDeferreds: {} as Record<string, Deferred<Float32Array | null>>,
  generateWaveformPeaksMock: null as unknown as ReturnType<typeof vi.fn>,
}));

describe('v2Script wires generateWaveformPeaks into markerSlider (waveform feature)', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    hooks.onAuthCb = null;
    hooks.currentSongEntry = null;
    hooks.currentSongKey = null;
    hooks.songData = null;
    hooks.audio = null;
    hooks.loadSongResults = {};
    hooks.peakDeferreds = {};
    hooks.generateWaveformPeaksMock = vi.fn(
      (url: string) => hooks.peakDeferreds[url]?.promise ?? Promise.resolve(null)
    );

    // Make requestAnimationFrame fire synchronously (happy-dom has no rAF).
    const raf = (cb: Function) => {
      cb();
      return 0;
    };
    vi.stubGlobal('requestAnimationFrame', raf);
    window.requestAnimationFrame = raf;

    // Silence duplicate custom element definitions that happen when multiple
    // tests import v2Script.js (which registers components).
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

    // ---- module mocks (registered before importing v2Script.js) ----

    vi.doMock('../services/firebaseClient.js', () => ({
      auth: {},
      onAuthStateChanged: (auth: unknown, cb: (user: unknown) => void) => {
        hooks.onAuthCb = cb;
        return () => {};
      },
    }));

    vi.doMock('../assets/internal/notify-js/notify.config.js', () => ({}));

    vi.doMock('../utils/firebase-sync.js', () => ({
      syncFirebaseGroups: vi.fn(async () => {}),
    }));

    vi.doMock('../utils/firebase-realtime.js', () => ({
      setupListeners: vi.fn(() => Promise.resolve()),
      setupGroupSongListeners: vi.fn(() => Promise.resolve()),
      teardownListeners: vi.fn(),
      saveSongData: vi.fn(() => Promise.resolve()),
      setLiveUpdateCallback: vi.fn(() => Promise.resolve()),
      setGroupUpdateCallback: vi.fn(),
    }));

    vi.doMock('../services/audio.js', () => ({
      audio: hooks.audio,
      loadSong: vi.fn(async (songKey: string) => hooks.loadSongResults[songKey] ?? null),
    }));

    vi.doMock('../utils/current-song.js', () => ({
      updateHeaderWithCurrentSong: vi.fn(),
      setCurrentSong: vi.fn((songKey: string) => {
        hooks.currentSongEntry = { strPath: songKey };
        hooks.currentSongKey = songKey;
      }),
      getCurrentSongMetadata: vi.fn(() => ({ duration: 120 })),
      getCurrentSongKey: vi.fn(() => hooks.currentSongKey),
      updateFooterWithCurrentSong: vi.fn(),
    }));

    vi.doMock('../assets/internal/db.js', () => ({
      nDB: {
        get: vi.fn((key: string) => {
          if (key === 'stroCurrentSongPathAndGalleryId') {
            return hooks.currentSongEntry;
          }
          if (key === hooks.songKey) {
            return hooks.songData;
          }
          return null;
        }),
        set: vi.fn(),
        setOnSong: vi.fn(),
      },
    }));

    // The feature under test: v2Script must call this after loading a song
    // and push the peaks onto markerSlider.waveformPeaks.
    vi.doMock('../utils/waveform.js', () => ({
      generateWaveformPeaks: hooks.generateWaveformPeaksMock,
    }));

    // Keep album-art extraction (a fire-and-forget side quest of
    // loadSongIntoPlayer) out of these tests.
    vi.doMock('../utils/album-art.js', () => ({
      extractAlbumArt: vi.fn(async () => {}),
    }));

    window.location.hash = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  /** Build the DOM skeleton v2Script queries on DOMContentLoaded. */
  function buildDom(): {
    songList: HTMLElement;
    markerSlider: HTMLElement & Record<string, unknown>;
  } {
    const header = document.createElement('div');
    header.id = 'header';
    document.body.appendChild(header);

    const footer = document.createElement('div');
    footer.id = 'footer';
    document.body.appendChild(footer);

    const settingsPanel = document.createElement('div');
    settingsPanel.id = 'settingsPanel';
    document.body.appendChild(settingsPanel);

    const currentSongControls = document.createElement('div');
    currentSongControls.id = 'currentSongControls';
    document.body.appendChild(currentSongControls);

    const songList = document.createElement('div');
    songList.id = 'songList';
    document.body.appendChild(songList);

    const markerSlider = document.createElement(
      'div'
    ) as unknown as HTMLElement & Record<string, unknown>;
    markerSlider.id = 'markerSlider';
    markerSlider.getPlaybackStart = vi.fn(() => 0);
    markerSlider.getPlaybackStop = vi.fn(() => 10);
    markerSlider.addEventListener = vi.fn();
    document.body.appendChild(markerSlider);

    return { songList, markerSlider };
  }

  function makeAudioMock(): AudioElementMock {
    const mock: AudioElementMock = {
      currentTime: 0,
      duration: 120,
      playbackRate: 1,
      volume: 1,
      paused: true,
      load: vi.fn(),
      pause: vi.fn(),
      addEventListener: vi.fn(),
    };
    Object.defineProperty(mock, 'src', {
      configurable: true,
      enumerable: true,
      get() {
        return mock._src;
      },
      set(val: string) {
        mock._src = val;
      },
    });
    return mock;
  }

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  function getMarkerSlider(): HTMLElement & { waveformPeaks?: number[] } {
    return document.getElementById('markerSlider') as HTMLElement & {
      waveformPeaks?: number[];
    };
  }

  it('sets markerSlider.waveformPeaks from generateWaveformPeaks after loading the boot song', async () => {
    buildDom();
    hooks.currentSongEntry = { strPath: 'track.mp3' };
    hooks.currentSongKey = 'track.mp3';
    hooks.songData = {};
    hooks.audio = makeAudioMock();
    hooks.loadSongResults['track.mp3'] = { url: 'blob:track', isVideo: false };
    const peaksRequest = deferred<Float32Array | null>();
    hooks.peakDeferreds['blob:track'] = peaksRequest;

    await import('../v2Script.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    // Let loadSongIntoPlayer's loadSong promise chain settle.
    await flush();
    await flush();

    // The peaks request must target the loaded song's object URL.
    expect(hooks.generateWaveformPeaksMock).toHaveBeenCalledWith('blob:track');

    // Resolve the pending peaks request and let the wiring assign the result.
    peaksRequest.resolve(new Float32Array([0.2, 0.6, 1]));
    await flush();
    await flush();

    expect(getMarkerSlider().waveformPeaks).toEqual([0.2, 0.6, 1]);
  }, 30000);

  it('a stale waveform result does not overwrite a newer song peaks (request-ID guard)', async () => {
    const { songList } = buildDom();
    // No current song at boot — both songs are selected via media-selected.
    hooks.currentSongEntry = null;
    hooks.currentSongKey = null;
    hooks.songData = {};
    hooks.audio = makeAudioMock();
    hooks.loadSongResults['songA.mp3'] = { url: 'blob:A', isVideo: false };
    hooks.loadSongResults['songB.mp3'] = { url: 'blob:B', isVideo: false };
    const peaksA = deferred<Float32Array | null>();
    const peaksB = deferred<Float32Array | null>();
    hooks.peakDeferreds['blob:A'] = peaksA;
    hooks.peakDeferreds['blob:B'] = peaksB;

    await import('../v2Script.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();

    songList.dispatchEvent(
      new CustomEvent('media-selected', {
        detail: { songKey: 'songA.mp3' },
        bubbles: true,
        composed: true,
      })
    );
    await flush();
    await flush();

    songList.dispatchEvent(
      new CustomEvent('media-selected', {
        detail: { songKey: 'songB.mp3' },
        bubbles: true,
        composed: true,
      })
    );
    await flush();
    await flush();

    // The NEWER song (B) finishes generating peaks first.
    peaksB.resolve(new Float32Array([0.5, 1]));
    await flush();
    await flush();
    expect(getMarkerSlider().waveformPeaks).toEqual([0.5, 1]);

    // The STALE song A finishes late — it must NOT overwrite B's peaks.
    peaksA.resolve(new Float32Array([1, 0]));
    await flush();
    await flush();
    expect(getMarkerSlider().waveformPeaks).toEqual([0.5, 1]);
  }, 30000);
});
