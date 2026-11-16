import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression tests for the v2Script.ts wiring of playback-skip detection.
 *
 * Feature contract:
 *  - `timeupdate` compares currentTime against the wall clock (Date.now) and
 *    the current playbackRate; a forward jump > 0.3 s is reported silently via
 *    SentryCaptureException with a numeric-only PlaybackSkipContext.
 *  - The first timeupdate after boot / play / pause / seeking establishes a
 *    baseline and does not report.
 *  - Paused playback and seek suppression never report.
 *  - Reports are rate-limited (one per 60 s window).
 *  - The context carries audioGraphEnabled / waveformEnabled from the debug
 *    flags, mediaKind, markerSliderMax, and no PII.
 *
 * Harness copied from tests/sentry-silent-capture.test.ts: Firebase/nDB/
 * current-song/notification/sentry are mocked, duplicate custom elements are
 * guarded, rAF is synchronous, and the audio element handlers are captured so
 * timeupdate can be driven manually. services/audio.js is mocked with ONLY
 * { audio, loadSong } and utils/waveform.js with ONLY { generateWaveformPeaks }
 * to prove v2Script guards missing diagnostic exports safely.
 *
 * This suite pins the implemented skip-reporting behavior.
 */

interface AudioElementMock {
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  paused: boolean;
  readyState: number;
  networkState: number;
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

describe('v2Script reports iOS playback skips to Sentry', () => {
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
    window.history.replaceState({}, '', '/');

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

    vi.doMock('../utils/messengerBrowser.js', () => ({
      maybeShowMessengerBrowserNotice: vi.fn(),
    }));

    // Deliberately ONLY the two long-standing exports: v2Script must guard
    // the new diagnostic exports (getAudioDebugState) instead of crashing.
    vi.doMock('../utils/waveform.js', () => ({
      generateWaveformPeaks: vi.fn(async () => null),
    }));
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  function buildDom(): void {
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

    const markerSlider = document.createElement('div') as unknown as HTMLElement &
      Record<string, unknown>;
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
  }

  function makeAudioMock(): AudioElementMock {
    return {
      currentTime: 0,
      duration: 132,
      playbackRate: 1,
      volume: 1,
      paused: false,
      readyState: 4,
      networkState: 1,
      load: vi.fn(),
      pause: vi.fn(),
      play: vi.fn(() => Promise.resolve()),
      addEventListener: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        hooks.audioHandlers[event] = handler;
      }),
    };
  }

  const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

  async function bootWithAudio(audioEl: AudioElementMock): Promise<void> {
    hooks.currentSongKey = null;
    // ONLY { audio, loadSong } — no diagnostic exports.
    vi.doMock('../services/audio.js', () => ({
      audio: audioEl,
      loadSong: vi.fn(async () => null),
    }));

    await import('../v2Script.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();
    await flush();
  }

  /** Installs a controllable Date.now clock starting at 1_000_000 ms. */
  function installClock(): { advance: (ms: number) => void } {
    let nowMs = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => nowMs);
    return {
      advance: (ms: number): void => {
        nowMs += ms;
      },
    };
  }

  function resetCapture(): void {
    hooks.sentryCapture?.mockClear();
  }

  function getCapture(): ReturnType<typeof vi.fn> {
    const capture = hooks.sentryCapture;
    expect(capture).not.toBeNull();
    if (!capture) {
      throw new Error('sentry capture mock missing');
    }
    return capture;
  }

  function getHandler(name: string): (...args: unknown[]) => void {
    const handler = hooks.audioHandlers[name];
    expect(handler).toBeDefined();
    if (!handler) {
      throw new Error(`missing audio ${name} handler`);
    }
    return handler;
  }

  function timeupdate(): void {
    getHandler('timeupdate')();
  }

  // ── Tests ──────────────────────────────────────────────────────────────────

  it('establishes a baseline on the first timeupdate and does not report it', async () => {
    buildDom();
    const audioEl = makeAudioMock();
    await bootWithAudio(audioEl);
    const clock = installClock();
    resetCapture();
    expect(hooks.audioHandlers['timeupdate']).toBeDefined();

    audioEl.currentTime = 0;
    timeupdate();
    expect(getCapture()).not.toHaveBeenCalled();

    // Control: a real forward skip after the baseline IS reported.
    clock.advance(1000);
    audioEl.currentTime = 5;
    timeupdate();
    expect(getCapture()).toHaveBeenCalledTimes(1);
  });

  it('reports a 4 s forward jump with numeric-only skip context', async () => {
    buildDom();
    const audioEl = makeAudioMock();
    await bootWithAudio(audioEl);
    const clock = installClock();
    resetCapture();

    audioEl.currentTime = 0;
    timeupdate();
    clock.advance(1000);
    audioEl.currentTime = 5;
    timeupdate();

    const capture = getCapture();
    expect(capture).toHaveBeenCalledTimes(1);
    const call = capture.mock.calls[0] as unknown[] | undefined;
    expect(call?.[0]).toBeInstanceOf(Error);
    expect(call?.[1]).toEqual(
      expect.objectContaining({
        wallClockDeltaMs: 1000,
        forwardSkipSeconds: 4,
        previousTime: 0,
        currentTime: 5,
        playbackRate: 1,
        audioGraphEnabled: true,
        waveformEnabled: true,
        mediaKind: 'audio',
        markerSliderMax: 132,
      })
    );
  });

  it('includes no PII in the captured skip report', async () => {
    buildDom();
    const audioEl = makeAudioMock();
    await bootWithAudio(audioEl);
    const clock = installClock();
    resetCapture();

    audioEl.currentTime = 0;
    timeupdate();
    clock.advance(1000);
    audioEl.currentTime = 5;
    timeupdate();

    const capture = getCapture();
    expect(capture).toHaveBeenCalledTimes(1);
    const serialised = JSON.stringify(capture.mock.calls[0] ?? null);
    expect(serialised).not.toMatch(/songKey|blob:|https?:|@/i);
  });

  it('does not report a normal 1 s advance and reports the next real skip', async () => {
    buildDom();
    const audioEl = makeAudioMock();
    await bootWithAudio(audioEl);
    const clock = installClock();
    resetCapture();

    audioEl.currentTime = 10;
    timeupdate();

    clock.advance(1000);
    audioEl.currentTime = 11;
    timeupdate();
    expect(getCapture()).not.toHaveBeenCalled();

    // Control: the detector is alive and reports a genuine skip.
    clock.advance(1000);
    audioEl.currentTime = 16;
    timeupdate();
    expect(getCapture()).toHaveBeenCalledTimes(1);
  });

  it('is rate-aware: 0.5 s expected advance is not a skip, but a 1.5 s excess is', async () => {
    buildDom();
    const audioEl = makeAudioMock();
    await bootWithAudio(audioEl);
    const clock = installClock();
    resetCapture();

    audioEl.currentTime = 10;
    timeupdate();

    audioEl.playbackRate = 0.5;
    clock.advance(1000);
    audioEl.currentTime = 10.5;
    timeupdate();
    expect(getCapture()).not.toHaveBeenCalled();

    // Baseline reset via the play handler at currentTime 10.
    audioEl.currentTime = 10;
    getHandler('play')();
    clock.advance(1000);
    audioEl.currentTime = 12;
    timeupdate();

    const capture = getCapture();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ forwardSkipSeconds: 1.5, playbackRate: 0.5 })
    );
  });

  it('rate-limits reports: a second big jump 10 s later is suppressed, 60 s later is reported', async () => {
    buildDom();
    const audioEl = makeAudioMock();
    await bootWithAudio(audioEl);
    const clock = installClock();
    resetCapture();

    audioEl.currentTime = 0;
    timeupdate();
    clock.advance(1000);
    audioEl.currentTime = 5;
    timeupdate();
    expect(getCapture()).toHaveBeenCalledTimes(1);

    // 10 s later: still inside the rate-limit window.
    clock.advance(10_000);
    audioEl.currentTime = 25;
    timeupdate();
    expect(getCapture()).toHaveBeenCalledTimes(1);

    // 60 s later (70 s after the first report): allowed again. Re-baseline
    // after the long gap, then send a fresh 1 s sample with a real jump.
    clock.advance(60_000);
    audioEl.currentTime = 25;
    timeupdate();
    clock.advance(1000);
    audioEl.currentTime = 30;
    timeupdate();
    expect(getCapture()).toHaveBeenCalledTimes(2);
  });

  it('suppresses the report immediately after a seeking event', async () => {
    buildDom();
    const audioEl = makeAudioMock();
    await bootWithAudio(audioEl);
    const clock = installClock();
    resetCapture();

    audioEl.currentTime = 0;
    timeupdate();

    expect(hooks.audioHandlers['seeking']).toBeDefined();
    getHandler('seeking')();

    clock.advance(1000);
    audioEl.currentTime = 5;
    timeupdate();
    expect(getCapture()).not.toHaveBeenCalled();

    // Control: the next normal update after the seek baseline can report.
    clock.advance(1000);
    audioEl.currentTime = 10;
    timeupdate();
    expect(getCapture()).toHaveBeenCalledTimes(1);
  });

  it('suppresses reports while paused', async () => {
    buildDom();
    const audioEl = makeAudioMock();
    await bootWithAudio(audioEl);
    const clock = installClock();
    resetCapture();

    audioEl.currentTime = 0;
    timeupdate();

    audioEl.paused = true;
    clock.advance(1000);
    audioEl.currentTime = 5;
    timeupdate();
    expect(getCapture()).not.toHaveBeenCalled();

    // Control: resuming playback and skipping is reported.
    audioEl.paused = false;
    audioEl.currentTime = 5;
    getHandler('play')();
    clock.advance(1000);
    audioEl.currentTime = 10;
    timeupdate();
    expect(getCapture()).toHaveBeenCalledTimes(1);
  });

  it('play/pause reset the baseline so the next timeupdate is not a report', async () => {
    buildDom();
    const audioEl = makeAudioMock();
    await bootWithAudio(audioEl);
    const clock = installClock();
    resetCapture();

    audioEl.currentTime = 0;
    timeupdate();

    audioEl.currentTime = 5;
    getHandler('pause')();
    getHandler('play')();

    clock.advance(1000);
    audioEl.currentTime = 5;
    timeupdate();
    expect(getCapture()).not.toHaveBeenCalled();

    // Control: the baseline was re-established and a later skip reports.
    clock.advance(1000);
    audioEl.currentTime = 10;
    timeupdate();
    expect(getCapture()).toHaveBeenCalledTimes(1);
  });

  it('re-baselines when playbackRate changes so a speed-slider change is not reported as a skip', async () => {
    buildDom();
    const audioEl = makeAudioMock();
    await bootWithAudio(audioEl);
    const clock = installClock();
    resetCapture();

    audioEl.currentTime = 10;
    timeupdate();

    // User drags the speed slider from 100% to 50%. The next sample covers the
    // transition: 2 s of media time in 1 s of wall time, but only 0.5 s is
    // expected at the new rate. Must not be mistaken for a decoder skip.
    audioEl.playbackRate = 0.5;
    clock.advance(1000);
    audioEl.currentTime = 12;
    timeupdate();
    expect(getCapture()).not.toHaveBeenCalled();

    // Control: after the rate-change baseline, a genuine 0.5 s excess reports.
    clock.advance(1000);
    audioEl.currentTime = 13;
    timeupdate();
    expect(getCapture()).toHaveBeenCalledTimes(1);
  });

  it('keeps detecting skips after a stop-marker loop seek when no wait-between pause fires', async () => {
    buildDom();
    const audioEl = makeAudioMock();
    await bootWithAudio(audioEl);
    const clock = installClock();
    resetCapture();

    // Baseline just below the stop marker, then reach it without a skip.
    audioEl.currentTime = 59.5;
    timeupdate();
    clock.advance(1000);
    audioEl.currentTime = 60;
    timeupdate(); // handlePlaybackStopReached seeks back to the start marker (10)

    // A real media seek fires `seeking`; mirror that.
    getHandler('seeking')();

    // First sample after the seek is a baseline.
    clock.advance(2000);
    audioEl.currentTime = 10;
    timeupdate();
    expect(getCapture()).not.toHaveBeenCalled();

    // A genuine 4 s skip 1 s later must still be reported. The old code kept
    // the loop-transition flags set (the mock's pause()/play() fire no events),
    // which silently suppressed every later sample for the rest of the loop.
    clock.advance(1000);
    audioEl.currentTime = 15;
    timeupdate();
    expect(getCapture()).toHaveBeenCalledTimes(1);
  });
});
