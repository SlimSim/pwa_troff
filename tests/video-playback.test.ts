import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TroffMarker } from '../types/troff.d.js';

/**
 * Feature spec #32 — v2Script video playback integration.
 *
 * v2Script must:
 *  - query `#videoPlayer` and `#videoElement` from the DOM,
 *  - keep an `activeMedia` (audio or videoElement) and route loaded songs to it
 *    via `loadSongIntoPlayer()` (which calls the REAL `loadSong` from
 *    services/audio.js — see tests/audio-service.test.ts for that contract),
 *  - seek the ACTIVE media from the timeline slider,
 *  - place the video player in the sidebar on wide screens / top on narrow ones.
 *
 * The harness mirrors the existing v2Script tests: stub DOM elements for the ids
 * v2Script queries, guard duplicate custom element registration, stub rAF, and
 * drive `DOMContentLoaded` manually. The `audio` singleton and `loadSong` are the
 * REAL implementations; only `caches`, `URL.createObjectURL` and `alert` are
 * stubbed.
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
const VIDEO_MIME = 'video/mp4';
const AUDIO_MIME = 'audio/mpeg';

function makeResponseBlob(mime: string): Blob {
  return new Blob(['fake media data'], { type: mime });
}

describe('v2Script video playback integration', () => {
  let domContentLoadedHandler: (() => void) | null;
  let videoPlayer: HTMLElement & { markers?: TroffMarker[]; startMarkerId?: string };
  let videoElement: HTMLVideoElement;
  let markerSlider: HTMLElement & Record<string, any>;
  let songList: HTMLElement & { visible: boolean; reloadSongs: () => void };
  let footer: HTMLElement & Record<string, any>;
  let header: HTMLElement & Record<string, any>;
  let settingsPanel: HTMLElement & Record<string, any>;
  let cacheMatchMock: ReturnType<typeof vi.fn>;
  let mqMatches: boolean;
  let mqChangeHandler: (() => void) | null;

  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    domContentLoadedHandler = null;
    mqMatches = true;
    mqChangeHandler = null;

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
      addEventListener: (_type: string, cb: () => void) => {
        mqChangeHandler = cb;
      },
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', vi.fn(() => mq));
    window.matchMedia = vi.fn(() => mq) as unknown as typeof window.matchMedia;

    // nDB mock defaults.
    nDBGetMock.mockReset();
    nDBSetMock.mockReset();
    nDBSetOnSongMock.mockReset();
    nDBGetMock.mockImplementation((key: string) => {
      if (key === TEST_SONG_KEY) {
        return {
          markers: [
            { id: 'markerNr0', name: 'Start', time: 0, info: '', color: 'None' },
            { id: 'markerNr1', name: 'End', time: 120, info: '', color: 'None' },
          ],
          localInformation: {},
        };
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

    // The video player frame + a REAL <video> element, hidden initially
    // (mirrors v2.html: <t-video-player id="videoPlayer" slot="video-top" hidden>).
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

  function selectSong(songKey: string): void {
    songList.dispatchEvent(
      new CustomEvent('media-selected', {
        detail: { songKey },
        bubbles: true,
        composed: true,
      })
    );
  }

  it('loads a video into the video element on boot when the current song is cached as a video', async () => {
    cacheMatchMock.mockResolvedValue(new Response(makeResponseBlob(VIDEO_MIME)));

    await bootApp();

    expect(videoPlayer.hidden).toBe(false);
    expect(videoElement.src).toContain('blob:');
  });

  it('loads a video into the video element when media-selected fires with a video songKey', async () => {
    cacheMatchMock.mockResolvedValue(new Response(makeResponseBlob(VIDEO_MIME)));
    getCurrentSongKeyMock.mockReturnValue(null); // no song at boot

    await bootApp();

    // Precondition: nothing loaded yet.
    expect(videoPlayer.hidden).toBe(true);
    expect(videoElement.src).toBe('');

    selectSong(TEST_SONG_KEY);
    await new Promise((r) => setTimeout(r, 0));

    expect(videoPlayer.hidden).toBe(false);
    expect(videoElement.src).toContain('blob:');
  });

  it('loads an audio song into the audio singleton and hides + pauses the video player', async () => {
    cacheMatchMock.mockResolvedValue(new Response(makeResponseBlob(AUDIO_MIME)));
    const { audio } = await import('../services/audio.js');
    const pauseSpy = vi.spyOn(videoElement, 'pause').mockImplementation(() => {});
    getCurrentSongKeyMock.mockReturnValue(null); // no song at boot

    await bootApp();

    selectSong(TEST_SONG_KEY);
    await new Promise((r) => setTimeout(r, 0));

    expect(videoPlayer.hidden).toBe(true);
    expect(audio.src).toContain('blob:');
    expect(pauseSpy).toHaveBeenCalled();
  });

  it('seeks the ACTIVE media (video) when the timeline slider value-changed fires', async () => {
    cacheMatchMock.mockResolvedValue(new Response(makeResponseBlob(VIDEO_MIME)));

    await bootApp();

    // Video is the active media after boot.
    expect(videoPlayer.hidden).toBe(false);

    markerSlider.dispatchEvent(
      new CustomEvent('value-changed', {
        detail: { value: 5 },
        bubbles: true,
        composed: true,
      })
    );

    expect(videoElement.currentTime).toBe(5);
  });

  it('places the video player in the sidebar on wide screens and at the top on narrow screens', async () => {
    mqMatches = true;
    await bootApp();

    expect(videoPlayer.getAttribute('slot')).toBe('video-sidebar');

    mqMatches = false;
    mqChangeHandler?.();

    expect(videoPlayer.getAttribute('slot')).toBe('video-top');
  });

  it('places the video player at the top when matchMedia reports a narrow screen at load', async () => {
    mqMatches = false;
    await bootApp();

    expect(videoPlayer.getAttribute('slot')).toBe('video-top');
  });

  it('opens the footer marker dialog when the video player requests add-marker', async () => {
    // A video is the current (cached) song, so the video player is active.
    cacheMatchMock.mockResolvedValue(new Response(makeResponseBlob(VIDEO_MIME)));
    footer.openMarkerDialog = vi.fn();

    await bootApp();

    // Precondition: the video player is active after boot.
    expect(videoPlayer.hidden).toBe(false);

    // t-video-player dispatches this from its .marker-btn host.
    videoPlayer.dispatchEvent(
      new CustomEvent('video-marker-add-requested', {
        bubbles: true,
        composed: true,
      })
    );

    expect(footer.openMarkerDialog).toHaveBeenCalled();
  });

  it('ignores video-marker-add-requested when the footer has no openMarkerDialog method', async () => {
    cacheMatchMock.mockResolvedValue(new Response(makeResponseBlob(VIDEO_MIME)));

    await bootApp();

    // The footer stub has no openMarkerDialog method, so the listener must be
    // guarded (typeof check) — dispatching must not throw.
    expect(() => {
      videoPlayer.dispatchEvent(
        new CustomEvent('video-marker-add-requested', {
          bubbles: true,
          composed: true,
        })
      );
    }).not.toThrow();
  });

  it('syncs the video player markers and startMarkerId from the marker slider after selecting a song', async () => {
    cacheMatchMock.mockResolvedValue(new Response(makeResponseBlob(VIDEO_MIME)));

    await bootApp();

    // Precondition: nothing synced before a song is selected.
    expect(videoPlayer.markers).toBeUndefined();

    selectSong(TEST_SONG_KEY);
    await new Promise((r) => setTimeout(r, 0));

    // v2Script's updateMarkerSlider feeds the video player (a "dumb" frame)
    // the SAME markers it configured on the marker slider, plus the slider's
    // current startMarkerId. The marker-name labels in the fullscreen overlay
    // are then derived from these two properties.
    expect(videoPlayer.markers).toEqual([
      { id: 'markerNr0', name: 'Start', time: 0, info: '', color: 'None' },
      { id: 'markerNr1', name: 'End', time: 120, info: '', color: 'None' },
    ]);
    expect(videoPlayer.startMarkerId).toBe(markerSlider.startMarkerId);
  });

  // ---- Round 9: video player scroll gestures — v2Script wiring --------------
  //
  // t-video-player dispatches two new events from the video frame:
  //   - `video-scrub-requested` { time } — a horizontal wheel scrub gesture
  //   - `speed-changed` { speed } — a vertical wheel speed gesture (the SAME
  //     event contract the footer speed control already uses)
  // v2Script must:
  //   - sync the videoPlayer `speed` property (percent, default 100) from the
  //     song data (`TROFF_VALUE_speedBar`) inside updateMarkerSlider — 100 in
  //     the "no song" branch, the stored value in the song branch,
  //   - listen on #videoPlayer for `speed-changed`, apply it to BOTH media
  //     elements (audio + video), persist it to nDB and reflect it back onto
  //     videoPlayer.speed — the footer listener will be refactored into this
  //     shared handler (regression-guarded below),
  //   - listen on #videoPlayer for `video-scrub-requested` and seek the active
  //     video plus the marker slider.

  it('sets videoPlayer.speed to 100 when no song is selected at boot', async () => {
    // Force the "no song" branch of updateMarkerSlider: no current song key AND
    // no current-song metadata. The default harness mocks the metadata to a
    // fixed object, so override it here and restore it afterwards (Vitest does
    // not reset mock implementations between tests).
    const { getCurrentSongMetadata } = await import('../utils/current-song.js');
    getCurrentSongKeyMock.mockReturnValue(null);
    vi.mocked(getCurrentSongMetadata).mockReturnValue(null);
    // The no-song branch only feeds the video player when it is visible (the
    // same `!hidden` guard that gates markers/startMarkerId), so mirror the
    // "a video is loaded" state.
    videoPlayer.hidden = false;
    try {
      await bootApp();

      // Precondition: the guard is genuinely active.
      expect(videoPlayer.hidden).toBe(false);
      expect((videoPlayer as HTMLElement & { speed?: number }).speed).toBe(100);
    } finally {
      // Restore the default metadata mock (the mock factory types this as a
      // bare `() => ({ duration: 120 })`, so widen it back to a vi.fn).
      (getCurrentSongMetadata as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        duration: 120,
      }));
    }
  });

  it('syncs videoPlayer.speed from the song speed bar value after selecting a song', async () => {
    cacheMatchMock.mockResolvedValue(new Response(makeResponseBlob(VIDEO_MIME)));
    // Override the default nDB mock: same shape as the defaults (markers +
    // localInformation) plus a stored speed value.
    nDBGetMock.mockImplementation((key: string) => {
      if (key === TEST_SONG_KEY) {
        return {
          markers: [
            { id: 'markerNr0', name: 'Start', time: 0, info: '', color: 'None' },
            { id: 'markerNr1', name: 'End', time: 120, info: '', color: 'None' },
          ],
          localInformation: {},
          TROFF_VALUE_speedBar: 125,
        };
      }
      return null;
    });

    await bootApp();
    selectSong(TEST_SONG_KEY);
    await new Promise((r) => setTimeout(r, 0));

    // Precondition: the video is loaded, so the video player is visible and
    // updateMarkerSlider feeds it.
    expect(videoPlayer.hidden).toBe(false);
    expect((videoPlayer as HTMLElement & { speed?: number }).speed).toBe(125);
  });

  it('applies videoPlayer speed-changed events to both media elements, nDB and the speed property', async () => {
    const { audio } = await import('../services/audio.js');
    await bootApp();

    videoPlayer.dispatchEvent(
      new CustomEvent('speed-changed', {
        detail: { speed: 120 },
        bubbles: true,
        composed: true,
      })
    );

    expect(videoElement.playbackRate).toBe(1.2);
    expect(audio.playbackRate).toBe(1.2);
    expect(nDBSetOnSongMock).toHaveBeenCalledWith(
      TEST_SONG_KEY,
      'TROFF_VALUE_speedBar',
      120
    );
    expect((videoPlayer as HTMLElement & { speed?: number }).speed).toBe(120);
  });

  it('seeks the video and the marker slider from videoPlayer video-scrub-requested events', async () => {
    cacheMatchMock.mockResolvedValue(new Response(makeResponseBlob(VIDEO_MIME)));

    await bootApp();

    // Precondition: the video is the active media after boot.
    expect(videoPlayer.hidden).toBe(false);

    videoPlayer.dispatchEvent(
      new CustomEvent('video-scrub-requested', {
        detail: { time: 42 },
        bubbles: true,
        composed: true,
      })
    );

    expect(videoElement.currentTime).toBe(42);
    expect(markerSlider.value).toBe(42);
  });

  it('keeps applying footer speed-changed events to both media elements (footer refactor guard)', async () => {
    const { audio } = await import('../services/audio.js');
    await bootApp();

    footer.dispatchEvent(
      new CustomEvent('speed-changed', {
        detail: { speed: 90 },
        bubbles: true,
        composed: true,
      })
    );

    // The footer listener will be refactored into the shared speed handler that
    // also serves the video player — this regression test pins the contract.
    expect(videoElement.playbackRate).toBe(0.9);
    expect(audio.playbackRate).toBe(0.9);
  });
});
