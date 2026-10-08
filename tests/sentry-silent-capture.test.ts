// RED tests for the Sentry silent-capture contract on corrupt-MP3 playback.
//
// Required behavior (surgical, no user notification, no PII):
//   1. play() rejection with a REAL error must call SentryCaptureException
//      (or wrapper) and must NOT show toast/alert.
//   2. Benign play() rejections (AbortError / interrupted-by-pause /
//      NotAllowedError autoplay noise) must NOT call SentryCaptureException.
//   3. The audio 'error' event must capture the MediaError code only —
//      silently (no toast/alert) and with no PII.
//   4. Helper triage (isBenignPlayError) and numeric-only context
//      (buildPlaybackErrorContext) come from the REAL
//      ../utils/playback-resilience.js module — covered by
//      tests/playback-resilience.test.ts (RED while the module is missing),
//      so this file asserts only the v2 wiring and stays runnable.
//
// Current v2 reality (why these are RED): v2Script.ts handles play()
// rejections with .catch(console.error) and never imports
// SentryCaptureException, and it registers no audio 'error' listener.
// utils/playback-resilience.ts does not exist yet either.
//
// Firebase and nDB are mocked — no real services are touched.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---- Hoisted shared state (vi.hoisted is evaluated before imports) ---------

interface AudioElementMock {
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  paused: boolean;
  load: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
}

const hooks = vi.hoisted(() => ({
  onAuthCb: null as ((user: unknown) => void) | null,
  currentSongKey: null as string | null,
  audioHandlers: {} as Record<string, (...args: unknown[]) => void>,
  sentryCapture: null as ReturnType<typeof vi.fn> | null,
  showToast: null as ReturnType<typeof vi.fn> | null,
  alertCalls: [] as unknown[],
}));

// ---- Suite ------------------------------------------------------------------

describe('Sentry silent capture for corrupt-MP3 playback', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    hooks.onAuthCb = null;
    hooks.currentSongKey = null;
    hooks.audioHandlers = {};
    hooks.alertCalls = [];

    hooks.sentryCapture = vi.fn();
    hooks.showToast = vi.fn();

    const raf = (cb: (...args: unknown[]) => void): number => {
      cb();
      return 0;
    };
    vi.stubGlobal('requestAnimationFrame', raf);
    window.requestAnimationFrame = raf as unknown as typeof window.requestAnimationFrame;

    // Silence duplicate custom element definitions across re-imports.
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

    // Never notify the user about playback errors in tests — record instead.
    vi.stubGlobal('alert', (...args: unknown[]) => {
      hooks.alertCalls.push(args[0]);
    });

    // Silence the current .catch(console.error) play() path so test output
    // stays readable; the Sentry assertions below are what matter.
    vi.spyOn(console, 'error').mockImplementation(() => {});

    window.location.hash = '';

    // ── Module mocks (Firebase + nDB never hit real services) ──────────────

    vi.doMock('../services/firebaseClient.js', () => ({
      auth: {},
      onAuthStateChanged: (_auth: unknown, cb: (user: unknown) => void) => {
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

    vi.doMock('../utils/current-song.js', () => ({
      updateHeaderWithCurrentSong: vi.fn(),
      setCurrentSong: vi.fn(),
      getCurrentSongMetadata: vi.fn(() => ({ duration: 120 })),
      getCurrentSongKey: vi.fn(() => hooks.currentSongKey),
      updateFooterWithCurrentSong: vi.fn(),
    }));

    vi.doMock('../assets/internal/db.js', () => ({
      nDB: {
        get: vi.fn(() => null),
        set: vi.fn(),
        setOnSong: vi.fn(),
      },
    }));

    vi.doMock('../utils/sentry.js', () => ({
      setSentryEnvironment: vi.fn(),
      setSentryVersion: vi.fn(),
      setSentryApp: vi.fn(),
      addAndStartSentry: vi.fn(),
      SentryCaptureException: (...args: unknown[]) => {
        hooks.sentryCapture?.(...args);
      },
    }));

    vi.doMock('../utils/notification.js', () => ({
      showToast: (...args: unknown[]) => {
        hooks.showToast?.(...args);
      },
      showLoading: vi.fn(() => ({ update: vi.fn(), done: vi.fn(), fail: vi.fn() })),
      showDownloadProgress: vi.fn(() => ({ update: vi.fn(), done: vi.fn() })),
      hideDownloadProgress: vi.fn(),
    }));

    vi.doMock('../utils/manifestHelper.js', () => ({
      getManifest: vi.fn(async () => ({ version: '0-test' })),
    }));

    vi.doMock('../utils/phoneUtils.js', () => ({
      updateWakeLockForPlayback: vi.fn(async () => {}),
    }));

    // The messenger in-app-browser notice fires a boot-time toast in
    // happy-dom; silence it so showToast assertions only cover playback.
    vi.doMock('../utils/messengerBrowser.js', () => ({
      maybeShowMessengerBrowserNotice: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  function buildDom(): { footer: HTMLElement } {
    const header = document.createElement('div');
    header.id = 'header';
    document.body.appendChild(header);

    const footer = document.createElement('div') as unknown as HTMLElement & Record<string, unknown>;
    footer.id = 'footer';
    footer['isPlaying'] = false;
    footer['isStartingPlayback'] = false;
    footer['playbackCountdown'] = 0;
    footer['pauseBefore'] = 0;
    footer['disablePauseBefore'] = true;
    footer['waitBetween'] = 0;
    footer['disableWaitBetween'] = true;
    footer['speed'] = 100;
    footer['volume'] = 75;
    document.body.appendChild(footer);

    const settingsPanel = document.createElement('div');
    settingsPanel.id = 'settingsPanel';
    document.body.appendChild(settingsPanel);

    const songList = document.createElement('div');
    songList.id = 'songList';
    document.body.appendChild(songList);

    const markerSlider = document.createElement('div') as unknown as HTMLElement & Record<string, unknown>;
    markerSlider.id = 'markerSlider';
    markerSlider['markers'] = [];
    markerSlider['min'] = 0;
    markerSlider['max'] = 120;
    markerSlider['unit'] = 's';
    markerSlider['value'] = 0;
    markerSlider['startMarkerId'] = null;
    markerSlider['stopMarkerId'] = null;
    markerSlider['getPlaybackStart'] = vi.fn(() => 10);
    markerSlider['getPlaybackStop'] = vi.fn(() => 60);
    document.body.appendChild(markerSlider);

    return { footer };
  }

  function makeAudioMock(playImpl: () => Promise<void>): AudioElementMock {
    return {
      currentTime: 0,
      duration: 132,
      playbackRate: 1,
      volume: 1,
      paused: true,
      load: vi.fn(),
      pause: vi.fn(),
      play: vi.fn(playImpl),
      addEventListener: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        hooks.audioHandlers[event] = handler;
      }),
    };
  }

  const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

  async function bootWithAudio(audioEl: AudioElementMock): Promise<void> {
    hooks.currentSongKey = null;
    vi.doMock('../services/audio.js', () => ({
      audio: audioEl,
      loadSong: vi.fn(async () => null),
    }));

    await import('../v2Script.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();
    await flush();
  }

  // Drop any boot-time spy calls so the assertions below only cover the
  // playback interaction under test.
  function resetSilentSpies(): void {
    hooks.sentryCapture?.mockClear();
    hooks.showToast?.mockClear();
    hooks.alertCalls = [];
  }

  // ── Tests ──────────────────────────────────────────────────────────────────

  it('play() rejection with a REAL decode error calls SentryCaptureException and shows no toast/alert', async () => {
    const { footer } = buildDom();
    const audioEl = makeAudioMock(() =>
      Promise.reject(new Error('Failed to load because no supported source was found.'))
    );
    await bootWithAudio(audioEl);

    // quick-play with no pending countdown and paused media calls
    // getActiveMedia().play() immediately — the corrupt-file failure path.
    resetSilentSpies();
    footer.dispatchEvent(new CustomEvent('nav-click', { detail: { action: 'quick-play' } }));
    await flush();
    await flush();
    await flush();

    expect(audioEl.play).toHaveBeenCalled();
    // RED now: v2Script .catch(console.error)s play() rejections and never
    // calls SentryCaptureException.
    expect(hooks.sentryCapture).toHaveBeenCalledTimes(1);
    // Silent contract: the user must never be notified about this.
    expect(hooks.showToast).not.toHaveBeenCalled();
    expect(hooks.alertCalls).toHaveLength(0);
  });

  it('benign AbortError play() rejection does NOT call SentryCaptureException and stays silent', async () => {
    const { footer } = buildDom();
    const audioEl = makeAudioMock(() =>
      Promise.reject(
        new DOMException('The play() request was interrupted by a call to pause().', 'AbortError')
      )
    );
    await bootWithAudio(audioEl);

    resetSilentSpies();
    footer.dispatchEvent(new CustomEvent('nav-click', { detail: { action: 'quick-play' } }));
    await flush();
    await flush();
    await flush();

    expect(audioEl.play).toHaveBeenCalled();
    // Guard for the fix: benign interruptions are browser noise, not bugs.
    expect(hooks.sentryCapture).not.toHaveBeenCalled();
    expect(hooks.showToast).not.toHaveBeenCalled();
    expect(hooks.alertCalls).toHaveLength(0);
  });

  it("audio 'error' event captures the MediaError code only — silently, with no PII", async () => {
    buildDom();
    const audioEl = makeAudioMock(() => Promise.resolve());
    await bootWithAudio(audioEl);
    resetSilentSpies();

    // RED now: v2Script registers no 'error' listener on the media element,
    // so corrupt-file MediaErrors are invisible to Sentry.
    const onError = hooks.audioHandlers['error'];
    expect(onError).toBeDefined();

    // Post-fix contract (reached once the listener exists): MediaError code
    // only, numeric context, no toast/alert, nothing identifying the song.
    onError({ target: { error: { code: 3 } } });
    await flush();
    await flush();

    expect(hooks.sentryCapture).toHaveBeenCalledTimes(1);
    const serialised = JSON.stringify(hooks.sentryCapture?.mock.calls[0] ?? null);
    expect(serialised).not.toMatch(/songKey|marker|serverId|blob:|@/i);
    expect(hooks.showToast).not.toHaveBeenCalled();
    expect(hooks.alertCalls).toHaveLength(0);
  });
});
