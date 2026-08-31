import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Feature spec #38 — saved per-song volume/speed must reach the actual media
 * elements on page load.
 *
 * Bug: on boot (DOMContentLoaded), on song selection (media-selected) and in
 * selectSongFromHash, the stored `TROFF_VALUE_volumeBar` / `TROFF_VALUE_speedBar`
 * values are pushed into the UI components (footer, settingsPanel,
 * currentSongControls) via updateFooterWithCurrentSong() /
 * syncCurrentSongControlsValues(), but they are NEVER applied to the media
 * elements. The `audio` singleton (a bare `new Audio()`, defaults volume=1,
 * playbackRate=1) keeps playing at 100 % volume/speed until the user manually
 * moves a slider, which triggers the volume-changed / speed-changed /
 * settings handlers that finally set audio.volume / audio.playbackRate.
 *
 * The harness mirrors tests/v2Script.test.ts: stub DOM elements for the ids
 * v2Script queries, guard duplicate custom element registrations, stub rAF,
 * mock Firebase/nDB/current-song/audio, and drive `DOMContentLoaded` manually.
 * The `audio` singleton is a SHARED mutable mock object (created per test and
 * capped in the hoisted `hooks.audio`) so the test can read the very same
 * object the module code mutated.
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

// Hoisted state shared between the vi.doMock factories (registered in
// beforeEach) and the test bodies. vi.hoisted guarantees the object exists
// before any mock factory evaluates (including stale factories from earlier
// tests that still reference this same object).
const hooks = vi.hoisted(() => ({
  onAuthCb: null as ((user: unknown) => void) | null,
  currentSongEntry: null as { strPath: string } | null,
  currentSongKey: null as string | null,
  songKey: 'track.mp3',
  songData: null as Record<string, unknown> | null,
  audio: null as AudioElementMock | null,
  loadSongResult: null as { url: string; isVideo: boolean } | null,
}));

describe('v2Script applies saved volume/speed to media elements (issue #38)', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    hooks.onAuthCb = null;
    hooks.currentSongEntry = null;
    hooks.currentSongKey = null;
    hooks.songData = null;
    hooks.audio = null;
    hooks.loadSongResult = null;

    // Make requestAnimationFrame fire synchronously (happy-dom has no rAF),
    // otherwise the auto-open code would never execute in tests.
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

    // The auth flow side-effect-imports this legacy notify module that calls
    // jQuery ($.notify.defaults) at module load, which is undefined here.
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

    // Shared mutable audio singleton: the tests assert on the SAME object the
    // module under test mutated (capped in hooks.audio).
    vi.doMock('../services/audio.js', () => ({
      audio: hooks.audio,
      loadSong: vi.fn(() => Promise.resolve(hooks.loadSongResult)),
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

    window.location.hash = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  /** Build the DOM skeleton v2Script queries on DOMContentLoaded. */
  function buildDom(withVideo: boolean): {
    header: HTMLElement;
    footer: HTMLElement;
    settingsPanel: HTMLElement;
    currentSongControls: HTMLElement;
    songList: HTMLElement;
    markerSlider: HTMLElement & Record<string, unknown>;
    videoPlayer: HTMLElement | null;
    videoElement: HTMLVideoElement | null;
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

    let videoPlayer: HTMLElement | null = null;
    let videoElement: HTMLVideoElement | null = null;
    if (withVideo) {
      videoElement = document.createElement('video');
      videoElement.id = 'videoElement';
      videoPlayer = document.createElement('div');
      videoPlayer.id = 'videoPlayer';
      videoPlayer.hidden = true;
      videoPlayer.appendChild(videoElement);
      document.body.appendChild(videoPlayer);
    }

    return {
      header,
      footer,
      settingsPanel,
      currentSongControls,
      songList,
      markerSlider,
      videoPlayer,
      videoElement,
    };
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
        // Emulate the browser reset behavior on new src (the root cause of the
        // reported speed bug during song switch): playbackRate snaps back to 1.
        // Volume is unaffected by src changes, which is why volume worked.
        mock.playbackRate = 1;
      },
    });
    return mock;
  }

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('applies saved volume/speed to the audio element when booting with a saved current song', async () => {
    buildDom(false);
    // nDB stores a saved current song + per-song volume (10 = 10 %) / speed (120 = 120 %).
    hooks.currentSongEntry = { strPath: 'track.mp3' };
    hooks.currentSongKey = 'track.mp3';
    hooks.songData = { TROFF_VALUE_volumeBar: 10, TROFF_VALUE_speedBar: 120 };
    const audioEl = makeAudioMock();
    hooks.audio = audioEl;
    hooks.loadSongResult = { url: 'track.mp3', isVideo: false };

    await import('../v2Script.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    // Let loadSongIntoPlayer's loadSong promise chain settle.
    await flush();
    await flush();

    // The stored values must reach the actual media element, not just the UI
    // components (footer/settingsPanel/currentSongControls).
    expect(audioEl.volume).toBe(0.1);
    expect(audioEl.playbackRate).toBe(1.2);
  }, 30000);

  it('applies saved volume/speed to the video element and video player when booting with a saved video song', async () => {
    const { videoPlayer, videoElement } = buildDom(true);
    hooks.currentSongEntry = { strPath: 'track.mp3' };
    hooks.currentSongKey = 'track.mp3';
    hooks.songData = { TROFF_VALUE_volumeBar: 10, TROFF_VALUE_speedBar: 120 };
    const audioEl = makeAudioMock();
    hooks.audio = audioEl;
    hooks.loadSongResult = { url: 'track.mp4', isVideo: true };

    await import('../v2Script.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();
    await flush();

    // loadSongIntoPlayer copies audio -> video, so the saved values must land
    // on every media element and on the video player's speed dial.
    expect(audioEl.volume).toBe(0.1);
    expect(audioEl.playbackRate).toBe(1.2);
    expect((videoElement as HTMLVideoElement).volume).toBe(0.1);
    expect((videoElement as HTMLVideoElement).playbackRate).toBe(1.2);
    expect(
      (videoPlayer as HTMLElement & { speed?: number } | null)?.speed
    ).toBe(120);
  }, 30000);

  it('applies saved volume/speed to the audio element when a song is selected via media-selected after boot', async () => {
    const { songList } = buildDom(false);
    // No current song at boot.
    hooks.currentSongEntry = null;
    hooks.currentSongKey = null;
    hooks.songData = { TROFF_VALUE_volumeBar: 60, TROFF_VALUE_speedBar: 90 };
    const audioEl = makeAudioMock();
    hooks.audio = audioEl;
    hooks.loadSongResult = { url: 'track.mp3', isVideo: false };

    await import('../v2Script.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();

    songList.dispatchEvent(
      new CustomEvent('media-selected', {
        detail: { songKey: 'track.mp3' },
        bubbles: true,
        composed: true,
      })
    );
    await flush();
    await flush();

    expect(audioEl.volume).toBe(0.6);
    expect(audioEl.playbackRate).toBe(0.9);
  }, 30000);

  it('applies default volume 0.75 and speed 1 when the current song has no saved values', async () => {
    buildDom(false);
    hooks.currentSongEntry = { strPath: 'track.mp3' };
    hooks.currentSongKey = 'track.mp3';
    hooks.songData = {}; // no TROFF_VALUE_volumeBar / TROFF_VALUE_speedBar
    const audioEl = makeAudioMock();
    hooks.audio = audioEl;
    hooks.loadSongResult = { url: 'track.mp3', isVideo: false };

    await import('../v2Script.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();
    await flush();

    // Defaults from nDB fallbacks: volume bar 75 -> 0.75, speed bar 100 -> 1.
    expect(audioEl.volume).toBe(0.75);
    expect(audioEl.playbackRate).toBe(1);
  }, 30000);

  it('applies the *new* song\'s speed after switching songs (regression for src/load reset)', async () => {
    const { songList } = buildDom(false);
    // Start with song A having 120 % speed
    hooks.currentSongEntry = null;
    hooks.currentSongKey = null;
    hooks.songKey = 'songA.mp3';
    hooks.songData = { TROFF_VALUE_volumeBar: 100, TROFF_VALUE_speedBar: 120 };
    const audioEl = makeAudioMock();
    hooks.audio = audioEl;
    hooks.loadSongResult = { url: 'songA.mp3', isVideo: false };

    await import('../v2Script.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();

    // Select song A
    songList.dispatchEvent(
      new CustomEvent('media-selected', {
        detail: { songKey: 'songA.mp3' },
        bubbles: true,
        composed: true,
      })
    );
    await flush();
    await flush();

    // After load (which now resets rate in our mock), the stored must still be applied
    expect(audioEl.playbackRate).toBe(1.2);

    // Switch to song B with 80 % speed (this is the reported scenario)
    hooks.songKey = 'songB.mp3';
    hooks.songData = { TROFF_VALUE_volumeBar: 100, TROFF_VALUE_speedBar: 80 };
    hooks.loadSongResult = { url: 'songB.mp3', isVideo: false };

    songList.dispatchEvent(
      new CustomEvent('media-selected', {
        detail: { songKey: 'songB.mp3' },
        bubbles: true,
        composed: true,
      })
    );
    await flush();
    await flush();

    // Must be B's speed (0.8), not 1.0 (reset) or A's leftover (1.2)
    expect(audioEl.playbackRate).toBe(0.8);
    expect(audioEl.volume).toBe(1.0);
  }, 30000);
});