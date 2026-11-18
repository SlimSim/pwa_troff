import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Regression test: iOS delivers a native `ended` BEFORE `currentTime` ever
 * reaches a stop marker that sits at the end of the song.
 *
 * Bug report: with the end marker at the max song length, the loop works on
 * Windows/Android but on iOS playback "just stops when it reaches the end of
 * the song" — no wait-between countdown, no next loop. It works on iOS as soon
 * as the end marker is somewhere inside the song.
 *
 * Cause: the old `ended` guard was `currentTime >= getPlaybackStop()`. iOS
 * WebKit skips corrupt tails and reports a duration that can differ from the
 * stored marker position (see utils/playback-resilience.ts), so `ended` fires
 * with `currentTime` below a stop marker that IS the end of the song. The loop
 * logic was skipped and the normal-ended / corrupt-tail path ran instead.
 *
 * The fix: a native `ended` counts as reaching the stop when the stop marker
 * is at (or within 2s of) the media duration — there is nothing left to play.
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

describe('v2Script ended before currentTime reaches a stop marker at song end', () => {
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
      getCurrentSongMetadata: vi.fn(() => ({ duration: 132 })),
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
                { id: 'stop', time: 131.69 },
              ],
              loopTimes: hooks.loopTimes,
              fileData: { duration: 132 },
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

  function buildDom(stop: number) {
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
    markerSlider.getPlaybackStop = vi.fn(() => stop);
    markerSlider.addEventListener = vi.fn();
    markerSlider.value = 0;
    markerSlider.min = 0;
    markerSlider.max = 132;
    markerSlider.unit = 's';
    document.body.appendChild(markerSlider);

    return { header, footer, settingsPanel, markerSlider };
  }

  function makeAudioMock(): AudioElementMock {
    return {
      currentTime: 0,
      duration: 132,
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

  const waitBetweenTimers = (spy: { mock: { calls: unknown[][] } }) =>
    spy.mock.calls.filter((call) => typeof call[0] === 'function' && call[1] === 500);

  it('iOS: ended 11s early (corrupt tail skipped) still loops when the stop marker is at song end', async () => {
    const { footer, settingsPanel } = buildDom(131.69);
    (settingsPanel as any).incrementUntillDisabled = true;
    const audioEl = makeAudioMock();

    await bootWithAudio(audioEl, footer);

    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    // iOS stops at ~121s of a 132s file: currentTime never reaches 131.69.
    audioEl.currentTime = 121;
    audioEl.paused = false;
    const onEnded = hooks.audioHandlers['ended'];
    expect(onEnded).toBeDefined();
    onEnded();

    // Same loop behaviour as timeupdate reaching the stop marker: seek back,
    // decrement the loop counter, and start the wait-between countdown.
    expect(audioEl.currentTime).toBe(10);
    expect((footer as any).loopTimesLeftLabel).toBe('2');
    expect(waitBetweenTimers(setTimeoutSpy).length).toBe(1);
    expect((footer as any).isStartingPlayback).toBe(true);
  });

  it('iOS: last loop stops at the start marker instead of looping again', async () => {
    hooks.loopTimes = 1;
    const { footer, settingsPanel } = buildDom(131.69);
    (settingsPanel as any).incrementUntillDisabled = true;
    const audioEl = makeAudioMock();

    await bootWithAudio(audioEl, footer);

    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    audioEl.currentTime = 125;
    audioEl.paused = false;
    hooks.audioHandlers['ended']();

    expect(audioEl.pause).toHaveBeenCalled();
    expect(audioEl.currentTime).toBe(10);
    expect(waitBetweenTimers(setTimeoutSpy).length).toBe(0);
    expect((footer as any).isStartingPlayback).toBeFalsy();
  });

  it('a stop marker inside the song keeps the corrupt-tail recovery (no loop)', async () => {
    const { footer, settingsPanel } = buildDom(125);
    (settingsPanel as any).incrementUntillDisabled = true;
    const audioEl = makeAudioMock();

    await bootWithAudio(audioEl, footer);

    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    // ended fires early (corrupt tail) while the loop stop is mid-song.
    audioEl.currentTime = 120;
    audioEl.paused = false;
    hooks.audioHandlers['ended']();

    // Unchanged behaviour: nudge past the gap and resume, no loop bookkeeping.
    expect(audioEl.currentTime).toBe(122);
    expect(audioEl.play).toHaveBeenCalledTimes(1);
    expect(waitBetweenTimers(setTimeoutSpy).length).toBe(0);
    expect((footer as any).loopTimesLeftLabel).toBe('3');
    expect((footer as any).isStartingPlayback).toBeFalsy();
  });

  it('a stale ended after the timeupdate loop seek is not handled twice', async () => {
    const { footer, settingsPanel } = buildDom(131.69);
    (settingsPanel as any).incrementUntillDisabled = true;
    const audioEl = makeAudioMock();

    await bootWithAudio(audioEl, footer);

    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    // Chromium order: timeupdate at the duration handles the loop…
    audioEl.currentTime = 132;
    audioEl.paused = false;
    hooks.audioHandlers['timeupdate']();
    expect(audioEl.currentTime).toBe(10);
    expect((footer as any).loopTimesLeftLabel).toBe('2');

    // …then the native ended for that same playback arrives after the seek.
    hooks.audioHandlers['ended']();

    // Exactly one loop transition: no second decrement, no second restart.
    expect((footer as any).loopTimesLeftLabel).toBe('2');
    expect(waitBetweenTimers(setTimeoutSpy).length).toBe(1);
    expect(audioEl.play).not.toHaveBeenCalled();
  });
});
