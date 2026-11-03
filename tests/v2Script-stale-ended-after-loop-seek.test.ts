import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Regression test: a stale native `ended` arriving AFTER the stop marker has
 * already seeked playback back to the start must not be treated as a corrupt
 * tail.
 *
 * Real browser order when the end marker is at the song duration:
 *   1. `timeupdate` fires with currentTime == duration
 *      → handlePlaybackStopReached(): decrements the loop counter, seeks back
 *        to the start marker, schedules the wait-between restart and pauses.
 *   2. `pause` fires (from the pause() call) → onPause resets
 *      isLoopTransitionPause to false.
 *   3. the `ended` event (queued when the media actually reached its end)
 *      fires with currentTime already at the start marker.
 *
 * Before the fix, step 3 cleared the pending restart and then the corrupt-tail
 * recovery saw `duration - currentTime > 2` (start marker vs. song end) and
 * called play() again — bypassing the wait-between countdown and the loop
 * limit (with one loop left it kept playing anyway).
 *
 * These tests import the REAL v2Script and drive the actual handlers captured
 * from addEventListener.
 */

const hooks = vi.hoisted(() => ({
  currentSongKey: null as string | null,
  loopTimes: 3,
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

describe('v2Script stale ended after the stop marker seeked back', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    hooks.currentSongKey = null;
    hooks.loopTimes = 3;
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
      onAuthStateChanged: (_auth: unknown, _cb: (user: unknown) => void) => () => {},
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
                // End marker AT the song duration: the reported bug shape.
                { id: 'stop', time: 120 },
              ],
              loopTimes: hooks.loopTimes,
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

    return { footer, settingsPanel, markerSlider };
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

    (footer as any).waitBetween = 0.5; // 500 ms
    (footer as any).disableWaitBetween = false;
    (footer as any).isPlaying = true;
  }

  async function reachEndThenDeliverStaleEnded(audioEl: AudioElementMock) {
    const onTimeUpdate = hooks.audioHandlers['timeupdate'];
    const onPause = hooks.audioHandlers['pause'];
    const onEnded = hooks.audioHandlers['ended'];
    expect(onTimeUpdate).toBeDefined();
    expect(onPause).toBeDefined();
    expect(onEnded).toBeDefined();

    // 1. timeupdate at the end marker (== duration) → stop logic runs.
    audioEl.currentTime = 120;
    audioEl.paused = false;
    onTimeUpdate();
    expect(audioEl.currentTime).toBe(10);

    // 2. the browser delivers `pause` after our pause() call.
    onPause();

    // 3. the queued `ended` arrives with currentTime already at the start.
    onEnded();
  }

  it('keeps the wait-between restart alive and does not resume playback', async () => {
    const { footer, settingsPanel } = buildDom();
    (settingsPanel as any).incrementUntillDisabled = true;
    const audioEl = makeAudioMock();

    await bootWithAudio(audioEl, footer);

    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const clearTimeoutBefore = clearTimeoutSpy.mock.calls.length;

    await reachEndThenDeliverStaleEnded(audioEl);

    // The pending restart must NOT be cancelled by the stale `ended`.
    expect(clearTimeoutSpy.mock.calls.length).toBe(clearTimeoutBefore);
    // And the corrupt-tail recovery must NOT resume from the start marker.
    expect(audioEl.play).not.toHaveBeenCalled();
    expect(audioEl.currentTime).toBe(10);
    // The countdown is still running.
    expect((footer as any).isStartingPlayback).toBe(true);
  });

  it('keeps the wait-between restart alive when `ended` arrives before `pause`', async () => {
    const { footer, settingsPanel } = buildDom();
    (settingsPanel as any).incrementUntillDisabled = true;
    const audioEl = makeAudioMock();

    await bootWithAudio(audioEl, footer);

    const onTimeUpdate = hooks.audioHandlers['timeupdate'];
    const onPause = hooks.audioHandlers['pause'];
    const onEnded = hooks.audioHandlers['ended'];

    // 1. timeupdate at the end marker → stop logic runs, pending restart set.
    audioEl.currentTime = 120;
    audioEl.paused = false;
    onTimeUpdate();
    expect(audioEl.currentTime).toBe(10);

    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const clearTimeoutBefore = clearTimeoutSpy.mock.calls.length;

    // 2. the queued `ended` arrives BEFORE the `pause` event.
    onEnded();
    // 3. the `pause` event then arrives and must not cancel the restart.
    onPause();

    expect(clearTimeoutSpy.mock.calls.length).toBe(clearTimeoutBefore);
    expect(audioEl.play).not.toHaveBeenCalled();
    expect(audioEl.currentTime).toBe(10);
    expect((footer as any).isStartingPlayback).toBe(true);
  });

  it('stops after the last loop instead of resuming (1 play selected)', async () => {
    hooks.loopTimes = 1;
    const { footer, settingsPanel } = buildDom();
    (settingsPanel as any).incrementUntillDisabled = true;
    const audioEl = makeAudioMock();

    await bootWithAudio(audioEl, footer);

    await reachEndThenDeliverStaleEnded(audioEl);

    // Repeats exhausted: paused at the start marker, not playing again.
    expect(audioEl.pause).toHaveBeenCalled();
    expect(audioEl.play).not.toHaveBeenCalled();
    expect(audioEl.currentTime).toBe(10);
    expect((footer as any).isPlaying).toBe(false);
  });
});
