import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Race condition between onEnded and the timeupdate-based loop logic.
 *
 * Bug: When the loop boundary is reached, onTimeUpdate sets
 * isLoopTransitionPause = true, schedules playback restart via
 * schedulePlaybackAfterDelay, and may call pause(). If the browser fires the
 * "ended" event before the scheduled restart fires (or before onPause resets
 * the flag), onEnded unconditionally calls clearPendingPlaybackStart(),
 * cancelling the loop restart.
 *
 * Fix: onEnded must check isLoopTransitionPause before calling
 * clearPendingPlaybackStart(), mirroring the guard already present in onPause.
 *
 * These tests capture the event-handler callbacks registered on the audio mock
 * via addEventListener, then invoke them directly to control event order and
 * verify whether clearPendingPlaybackStart (→ window.clearTimeout) is called.
 */

// ── Hoisted shared state ──────────────────────────────────────────────────────

const hooks = vi.hoisted(() => ({
  onAuthCb: null as ((user: unknown) => void) | null,
  currentSongKey: null as string | null,
  audio: null as AudioElementMock | null,
  // Captured event handlers registered on the audio element
  audioHandlers: {} as Record<string, (...args: unknown[]) => void>,
}));

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Test suite ────────────────────────────────────────────────────────────────

describe('v2Script onEnded race condition with loop transition', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    hooks.onAuthCb = null;
    hooks.currentSongKey = null;
    hooks.audio = null;
    hooks.audioHandlers = {};

    // Make requestAnimationFrame fire synchronously (happy-dom has no rAF).
    const raf = (cb: Function) => {
      cb();
      return 0;
    };
    vi.stubGlobal('requestAnimationFrame', raf);
    window.requestAnimationFrame = raf;

    // Silence duplicate custom element definitions across re-imports.
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

    // ── Module mocks ────────────────────────────────────────────────────────

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
                { id: 'stop', time: 60 },
              ],
              loopTimes: 10,
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

  // ── Helpers ──────────────────────────────────────────────────────────────

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
    markerSlider.getPlaybackStop = vi.fn(() => 60);
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

    // Configure footer for loop transitions with a wait-between delay.
    // This ensures schedulePlaybackAfterDelay creates a pending setTimeout.
    (footer as any).waitBetween = 0.5; // 500 ms
    (footer as any).disableWaitBetween = false;
    (footer as any).isPlaying = true;
  }

  // ── Tests ────────────────────────────────────────────────────────────────

  it('onEnded does NOT call clearPendingPlaybackStart when isLoopTransitionPause is true (bug: it does)', async () => {
    const { footer } = buildDom();
    const audioEl = makeAudioMock();

    await bootWithAudio(audioEl, footer);

    // Capture the setTimeout and clearTimeout spies AFTER boot so the module's
    // references resolve to our spies.
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');

    // ── Step 1: Simulate the loop transition via timeupdate. ──────────────
    // Set currentTime past the stop marker so onTimeUpdate triggers the loop.
    // loopTimesLeft is 10 (from nDB loopTimes: 10), so the code proceeds
    // through the loop continuation path (not the reset-and-return path).
    audioEl.currentTime = 60;
    audioEl.paused = false;

    const onTimeUpdate = hooks.audioHandlers['timeupdate'];
    expect(onTimeUpdate).toBeDefined();

    // Fire the timeupdate handler — this should:
    //  1. Detect currentTime >= playbackStop (60 >= 60)
    //  2. Decrement loopTimesLeft (10 → 9)
    //  3. Set isLoopTransitionPause = true
    //  4. Seek currentTime back to playbackStart (10)
    //  5. Call schedulePlaybackAfterDelay(500) which creates a setTimeout
    //  6. Call pause() because waitBetween > 0
    onTimeUpdate();

    // Verify the loop path executed: currentTime was seeked back.
    expect(audioEl.currentTime).toBe(10);

    // Verify schedulePlaybackAfterDelay created a pending timeout (500ms).
    const pendingCalls = setTimeoutSpy.mock.calls.filter(
      (call) => typeof call[0] === 'function' && call[1] === 500
    );
    expect(pendingCalls.length).toBe(1);

    // At this point isLoopTransitionPause = true.
    // In a real race condition, the browser might fire "ended" before
    // the "pause" event, so onPause has NOT reset isLoopTransitionPause yet.
    // We simulate this by firing ended directly (without firing onPause first).

    const clearTimeoutBefore = clearTimeoutSpy.mock.calls.length;

    const onEnded = hooks.audioHandlers['ended'];
    expect(onEnded).toBeDefined();
    onEnded();

    // ── Assertion ─────────────────────────────────────────────────────────
    // With the bug, onEnded unconditionally calls clearPendingPlaybackStart()
    // which calls clearTimeout (because a pending timeout exists).
    // With the fix, onEnded should NOT call clearPendingPlaybackStart()
    // when isLoopTransitionPause is true.
    const clearTimeoutAfter = clearTimeoutSpy.mock.calls.length;
    const clearTimeoutCalledDuringEnded = clearTimeoutAfter > clearTimeoutBefore;

    // This assertion is RED before the fix (clearTimeout IS called).
    // After the fix it should be GREEN (clearTimeout is NOT called).
    expect(clearTimeoutCalledDuringEnded).toBe(false);
  });

  it('onEnded DOES call clearPendingPlaybackStart when isLoopTransitionPause is false (normal ended)', async () => {
    const { footer } = buildDom();
    const audioEl = makeAudioMock();

    await bootWithAudio(audioEl, footer);

    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');

    // ── Step 1: Create a pending playback via the loop transition, then ───
    // let onPause reset isLoopTransitionPause to false.
    audioEl.currentTime = 60;
    audioEl.paused = false;
    const onTimeUpdate = hooks.audioHandlers['timeupdate'];
    onTimeUpdate(); // isLoopTransitionPause = true, pending created

    // Simulate the pause event that the browser delivers after the loop
    // transition.  onPause sees isLoopTransitionPause = true, resets it to
    // false, and preserves the pending playback.
    const onPause = hooks.audioHandlers['pause'];
    onPause(); // isLoopTransitionPause = false, pending preserved

    const clearTimeoutBefore = clearTimeoutSpy.mock.calls.length;

    // ── Step 2: Fire "ended" — isLoopTransitionPause is false, so the ────
    // normal path should clear the pending playback.
    const onEnded = hooks.audioHandlers['ended'];
    onEnded();

    // ── Assertion ─────────────────────────────────────────────────────────
    // This assertion is GREEN even before the fix (clearTimeout IS called).
    const clearTimeoutAfter = clearTimeoutSpy.mock.calls.length;
    expect(clearTimeoutAfter).toBe(clearTimeoutBefore + 1);
  });
});
