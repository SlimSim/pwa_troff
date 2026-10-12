import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Regression test: native `ended` when end-marker == song duration must
 * behave IDENTICALLY to reaching the end-marker via `timeupdate`.
 *
 * Bug report: "when the end marker is at the song duration, then when the
 * song finishes, it just jumps to the start, without checking the nr of
 * times left, or waiting the 'pause between' amount. I'm guessing the 'song
 * ended' is fired from the audio player and it jumps to the start without
 * the 'end marker reached' logic."
 *
 * Expected (unified) behavior: `ended` at duration with repeats left must
 * decrement/check times-left, honor the "pause between loops" delay
 * (schedule a pending restart), and only then seek to the start marker —
 * exactly what onTimeUpdate does when now >= getPlaybackStop(). When
 * repeats are exhausted it must pause at the start marker and reset the
 * counter. It must NOT unconditionally stop/seek without the loop logic.
 *
 * Code paths (v2Script.ts):
 *   - onTimeUpdate (~line 3086): `if (now >= markerSlider.getPlaybackStop())`
 *     decrements loopTimesLeft, seeks to getPlaybackStart(), calls
 *     schedulePlaybackAfterDelay(getWaitBetweenDelay()) — the loop logic.
 *   - onEnded (~line 3180): only clears pending playback, sets
 *     footer.isPlaying = false, and handles corrupt-tail gap recovery.
 *     No loopTimesLeft check, no wait-between delay, no seek to start.
 *
 * This test imports the REAL v2Script module and drives the ACTUAL audio
 * `ended`/`timeupdate` handlers captured via addEventListener — nothing is
 * reimplemented. RED while onEnded lacks the loop logic.
 */

const hooks = vi.hoisted(() => ({
  onAuthCb: null as ((user: unknown) => void) | null,
  currentSongKey: null as string | null,
  audio: null as AudioElementMock | null,
  audioHandlers: {} as Record<string, (...args: unknown[]) => void>,
}));

interface AudioElementMock {
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  paused: boolean;
  src?: string;
  load: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
}

describe('v2Script ended at duration must reuse the end-marker loop logic', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    hooks.onAuthCb = null;
    hooks.currentSongKey = null;
    hooks.audio = null;
    hooks.audioHandlers = {};

    const raf = (cb: Function) => {
      cb();
      return 0;
    };
    vi.stubGlobal('requestAnimationFrame', raf);
    window.requestAnimationFrame = raf;

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

    vi.doMock('../utils/current-song.js', () => ({
      updateHeaderWithCurrentSong: vi.fn(),
      setCurrentSong: vi.fn(),
      getCurrentSongMetadata: vi.fn(() => ({ duration: 120 })),
      getCurrentSongKey: vi.fn(() => hooks.currentSongKey),
      updateFooterWithCurrentSong: vi.fn(),
    }));

    vi.doMock('../assets/internal/db.js', () => ({
      nDB: {
        get: vi.fn((key: string) => {
          if (key === 'stroCurrentSongPathAndGalleryId') {
            return hooks.currentSongKey ? { strPath: hooks.currentSongKey } : null;
          }
          if (key === hooks.currentSongKey) {
            return {
              markers: [
                { id: 'start', time: 10 },
                { id: 'stop', time: 120 },
              ],
              // Repeats left (> 1) so the loop-continuation path applies.
              loopTimes: 3,
              fileData: { duration: 120 },
            };
          }
          return null;
        }),
        set: vi.fn(),
        setOnSong: vi.fn(),
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  function buildDom() {
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

    // End-marker AT the song duration: the reported bug shape.
    const markerSlider = document.createElement('div') as any;
    markerSlider.id = 'markerSlider';
    markerSlider.getPlaybackStart = vi.fn(() => 10);
    markerSlider.getPlaybackStop = vi.fn(() => 120);
    markerSlider.addEventListener = vi.fn();
    markerSlider.value = 0;
    markerSlider.min = 0;
    markerSlider.max = 120;
    markerSlider.unit = 's';
    document.body.appendChild(markerSlider);

    return { header, footer, settingsPanel, songList, markerSlider };
  }

  function makeAudioMock(): AudioElementMock {
    return {
      currentTime: 0,
      duration: 120,
      playbackRate: 1,
      volume: 1,
      paused: true,
      load: vi.fn(),
      pause: vi.fn(),
      play: vi.fn(() => Promise.resolve()),
      addEventListener: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        hooks.audioHandlers[event] = handler;
      }),
    };
  }

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  async function bootWithAudio(audioEl: AudioElementMock, footer: HTMLElement) {
    hooks.audio = audioEl;
    hooks.currentSongKey = 'track.mp3';

    vi.doMock('../services/audio.js', () => ({
      audio: hooks.audio,
      loadSong: vi.fn(() => Promise.resolve({ url: 'track.mp3', isVideo: false })),
    }));

    await import('../v2Script.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();
    await flush();

    // Repeats left + a "pause between loops" delay, so the unified behavior
    // is: seek to start marker AND schedule the delayed restart.
    (footer as any).waitBetween = 0.5; // 500 ms
    (footer as any).disableWaitBetween = false;
    (footer as any).isPlaying = true;
  }

  it('CONTROL: timeupdate at the end-marker loops back with the pause-between delay', async () => {
    const { footer, settingsPanel } = buildDom();
    (settingsPanel as any).incrementUntillDisabled = true;
    const audioEl = makeAudioMock();

    await bootWithAudio(audioEl, footer);

    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    // Reference behavior: timeupdate with now == playbackStop == duration.
    audioEl.currentTime = 120;
    audioEl.paused = false;
    const onTimeUpdate = hooks.audioHandlers['timeupdate'];
    expect(onTimeUpdate).toBeDefined();
    onTimeUpdate();

    // Loop continuation: seeked back to start, restart scheduled after delay.
    expect(audioEl.currentTime).toBe(10);
    const pendingCalls = setTimeoutSpy.mock.calls.filter(
      (call) => typeof call[0] === 'function' && call[1] === 500
    );
    expect(pendingCalls.length).toBe(1);
  });

  it('RED: ended at duration (end-marker == duration) loops back with the pause-between delay', async () => {
    const { footer, settingsPanel } = buildDom();
    (settingsPanel as any).incrementUntillDisabled = true;
    const audioEl = makeAudioMock();

    await bootWithAudio(audioEl, footer);

    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    // The reported bug shape: native `ended` fires with currentTime at the
    // duration, which equals the end-marker. loopTimesLeft is 3 (> 1), so
    // the unified behavior must be the loop-continuation path.
    audioEl.currentTime = 120;
    audioEl.paused = false;
    const onEnded = hooks.audioHandlers['ended'];
    expect(onEnded).toBeDefined();
    onEnded();

    // IDENTICAL to the timeupdate end-marker path: seek to start marker …
    expect(audioEl.currentTime).toBe(10);
    // … and honor the "pause between loops" delay via a pending restart.
    const pendingCalls = setTimeoutSpy.mock.calls.filter(
      (call) => typeof call[0] === 'function' && call[1] === 500
    );
    expect(pendingCalls.length).toBe(1);
  });
});
