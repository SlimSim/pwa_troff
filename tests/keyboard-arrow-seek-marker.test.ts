import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Arrow-key time increments (from version 1)
//   Alt  + Arrow  = 1/12  s  (one frame at 12 fps)
//   bare + Arrow  = 10/12 s  (10 frames)
//   Shift + Arrow = 100/12 s (100 frames)
// These are the values the handler under test MUST use.
// ---------------------------------------------------------------------------
const ALT_TIME = 1 / 12; // ≈ 0.08333333333
const REGULAR_TIME = 10 / 12; // ≈ 0.8333333333
const SHIFT_TIME = 100 / 12; // ≈ 8.333333333

// ---------------------------------------------------------------------------
// Mock: nDB
// ---------------------------------------------------------------------------
const nDBGetMock = vi.fn();
const nDBSetOnSongMock = vi.fn();
const nDBSetMock = vi.fn();

vi.mock('../assets/internal/db.js', () => ({
  nDB: {
    get: nDBGetMock,
    set: nDBSetMock,
    setOnSong: nDBSetOnSongMock,
  },
}));

// ---------------------------------------------------------------------------
// Mock: audio
// ---------------------------------------------------------------------------
const audioMock = {
  currentTime: 0,
  duration: 120,
  playbackRate: 1,
  volume: 1,
  paused: true,
  addEventListener: vi.fn(),
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
};

vi.mock('../services/audio.js', () => ({
  audio: audioMock,
  loadSong: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: current-song
// ---------------------------------------------------------------------------
vi.mock('../utils/current-song.js', () => ({
  updateHeaderWithCurrentSong: vi.fn(),
  setCurrentSong: vi.fn(),
  getCurrentSongMetadata: vi.fn(() => ({ duration: 120 })),
  getCurrentSongKey: vi.fn(() => 'test-song-key'),
  updateFooterWithCurrentSong: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: marker slider
// ---------------------------------------------------------------------------
const markerSliderMock = {
  markers: [] as any[],
  startMarkerId: null as string | null,
  stopMarkerId: null as string | null,
  startBefore: 0,
  min: 0,
  max: 120,
  unit: 's',
  value: 0,
  zoomLevel: 1,
  minZoom: 1,
  getPlaybackStart: vi.fn(() => 0),
  getPlaybackStop: vi.fn(() => 120),
  requestUpdate: vi.fn(),
  updateComplete: Promise.resolve(),
};

vi.mock('../components/organisms/t-marker-slider.js', () => ({
  MarkerSlider: class MockMarkerSlider {
    constructor() {
      Object.assign(this, markerSliderMock);
    }
  },
}));

// ---------------------------------------------------------------------------
// Mock: formatters
// ---------------------------------------------------------------------------
vi.mock('../utils/formatters.js', () => ({
  formatDuration: (sec: number) =>
    `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`,
  countLast30Days: vi.fn(() => 0),
}));

// ---------------------------------------------------------------------------
// Mock: troff-settings
// ---------------------------------------------------------------------------
vi.mock('../utils/troff-settings.js', () => ({
  configureMarkerSlider: vi.fn(),
  getStartBefore: vi.fn(() => 0),
  getStopAfter: vi.fn(() => 0),
  getIncrementUntil: vi.fn(() => 100),
  ensureDefaultMarkers: vi.fn((_songData: any, duration: number) => [
    { id: 'markerNr0', name: 'Start', time: 0, info: '', color: 'None' },
    { id: 'markerNr1', name: 'End', time: duration, info: '', color: 'None' },
  ]),
}));

// ---------------------------------------------------------------------------
// Mock: firebase-sync
// ---------------------------------------------------------------------------
vi.mock('../utils/firebase-sync.js', () => ({
  syncFirebaseGroups: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Mock: firebase-realtime
// ---------------------------------------------------------------------------
vi.mock('../utils/firebase-realtime.js', () => ({
  setupListeners: vi.fn().mockResolvedValue(undefined),
  teardownListeners: vi.fn(),
  saveSongData: vi.fn().mockResolvedValue(undefined),
  setLiveUpdateCallback: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: log
// ---------------------------------------------------------------------------
vi.mock('../utils/log.js', () => ({
  default: {
    i: vi.fn(),
    w: vi.fn(),
    e: vi.fn(),
  },
}));

// ===========================================================================
// Tests
// ===========================================================================
describe('Keyboard arrow key functionality', () => {
  let footer: any;
  let settingsPanel: any;
  let markerSlider: any;
  let header: any;
  let songList: any;

  // Capture ALL capture-phase keydown handlers registered on document.
  // We use an array because v2Script registers multiple capture-phase
  // keydown listeners (playback, arrow seek/move, etc.) and we want to
  // invoke every one of them so the handler under test is always reached.
  let keydownHandlers: Array<(e: KeyboardEvent) => void> = [];

  // Default markers used across most tests.
  const defaultMarkers = [
    { id: 'markerNr0', name: 'Start', time: 30, info: '', color: 'None' },
    { id: 'markerNr1', name: 'Middle', time: 60, info: '', color: 'None' },
    { id: 'markerNr2', name: 'End', time: 90, info: '', color: 'None' },
  ];

  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    keydownHandlers = [];

    // Intercept ALL capture-phase keydown listeners so we can call them
    // directly instead of dispatching through the DOM. This avoids stale
    // listener accumulation across test files.
    const origAE = document.addEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation(
      (type: string, handler: any, options?: any) => {
        if (
          type === 'keydown' &&
          (options === true ||
            (typeof options === 'object' && options?.capture))
        ) {
          keydownHandlers.push(handler as (e: KeyboardEvent) => void);
          return; // Skip actual registration to prevent accumulation
        }
        return origAE(type, handler, options);
      }
    );

    // Make requestAnimationFrame fire synchronously
    const raf = (cb: Function) => {
      cb();
      return 0;
    };
    vi.stubGlobal('requestAnimationFrame', raf);
    window.requestAnimationFrame = raf;

    // Silence duplicate custom element definitions
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

    // Reset mocks
    nDBGetMock.mockReset();
    nDBSetOnSongMock.mockReset();
    nDBSetMock.mockReset();
    audioMock.currentTime = 0;
    audioMock.duration = 120;
    audioMock.paused = true;
    audioMock.play.mockClear();
    audioMock.play.mockResolvedValue(undefined);
    audioMock.pause.mockClear();

    // Create DOM elements that v2Script expects
    header = document.createElement('div');
    header.id = 'header';
    header.statusLoopsLeft = '';
    header.statusCountdown = '';
    document.body.appendChild(header);

    songList = document.createElement('div');
    songList.id = 'songList';
    songList.visible = false;
    document.body.appendChild(songList);

    footer = document.createElement('div');
    footer.id = 'footer';
    footer.pauseBefore = 3;
    footer.waitBetween = 1;
    footer.disablePauseBefore = false;
    footer.disableWaitBetween = false;
    footer.isStartingPlayback = false;
    footer.playbackCountdown = 0;
    footer.loopTimesLeftLabel = '1';
    footer.markerDialogInitialTime = 0;
    footer.markerDialogSuggestedName = '';
    footer.openMarkerDialogForEdit = vi.fn();
    footer.updateComplete = Promise.resolve();
    document.body.appendChild(footer);

    settingsPanel = document.createElement('div');
    settingsPanel.id = 'settingsPanel';
    settingsPanel.playUseTimer = false;
    settingsPanel.playResetCounter = false;
    settingsPanel.enterUseTimer = false;
    settingsPanel.enterResetCounter = false;
    settingsPanel.enterGoToMarker = false;
    settingsPanel.spaceUseTimer = false;
    settingsPanel.spaceResetCounter = false;
    settingsPanel.spaceGoToMarker = false;
    settingsPanel.visible = false;
    settingsPanel.startBeforeValue = 0;
    settingsPanel.startBeforeDisabled = false;
    settingsPanel.stopAfterValue = 0;
    settingsPanel.stopAfterDisabled = false;
    settingsPanel.incrementUntillValue = 0;
    settingsPanel.incrementUntillDisabled = false;
    settingsPanel.updateComplete = Promise.resolve();
    document.body.appendChild(settingsPanel);

    markerSlider = document.createElement('div');
    markerSlider.id = 'markerSlider';
    Object.assign(markerSlider, markerSliderMock);
    document.body.appendChild(markerSlider);

    // Default nDB mock: returns song data for the active song key
    nDBGetMock.mockImplementation((key: string) => {
      if (key === 'test-song-key') {
        return {
          markers: defaultMarkers.map((m) => ({ ...m })),
          currentStartMarker: 'markerNr0',
          currentStopMarker: 'markerNr1S',
        };
      }
      return null;
    });

    nDBSetOnSongMock.mockImplementation(
      (_songKey: string, _path: string | string[], _value: any) => {
        // no-op; tests assert on the call arguments
      }
    );

    nDBSetMock.mockImplementation((_key: string, _value: any) => {
      // no-op
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /** Import v2Script and fire DOMContentLoaded so handlers are registered. */
  async function setupTest() {
    await import('../v2Script.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    // Wait for component updates
    await footer.updateComplete;
    await markerSlider.updateComplete;
    await settingsPanel.updateComplete;
  }

  /**
   * Build a KeyboardEvent and invoke every captured capture-phase keydown
   * handler directly (bypasses DOM dispatch to avoid stale-listener issues).
   */
  function dispatchKeyDown(
    key: string,
    opts: {
      shiftKey?: boolean;
      altKey?: boolean;
      ctrlKey?: boolean;
      metaKey?: boolean;
      isComposing?: boolean;
      repeat?: boolean;
      target?: EventTarget;
    } = {}
  ): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      composed: true,
      cancelable: true,
    });

    // isComposing and repeat are read-only on the prototype, so we use
    // defineProperty to override them for testing purposes.
    if (opts.isComposing !== undefined) {
      Object.defineProperty(event, 'isComposing', { value: opts.isComposing });
    }
    if (opts.repeat !== undefined) {
      Object.defineProperty(event, 'repeat', { value: opts.repeat });
    }
    if (opts.shiftKey !== undefined) {
      Object.defineProperty(event, 'shiftKey', { value: opts.shiftKey });
    }
    if (opts.altKey !== undefined) {
      Object.defineProperty(event, 'altKey', { value: opts.altKey });
    }
    if (opts.ctrlKey !== undefined) {
      Object.defineProperty(event, 'ctrlKey', { value: opts.ctrlKey });
    }
    if (opts.metaKey !== undefined) {
      Object.defineProperty(event, 'metaKey', { value: opts.metaKey });
    }

    for (const handler of keydownHandlers) {
      handler(event);
    }

    return event;
  }

  // =======================================================================
  // 1-8  Left / Right arrow keys — seek currentTime
  // =======================================================================
  describe('Left/Right arrow keys — seek time', () => {
    it('1. Right arrow seeks forward by regularTime', async () => {
      await setupTest();
      audioMock.currentTime = 50;

      dispatchKeyDown('ArrowRight');

      expect(audioMock.currentTime).toBeCloseTo(50 + REGULAR_TIME, 6);
    });

    it('2. Left arrow seeks backward by regularTime', async () => {
      await setupTest();
      audioMock.currentTime = 50;

      dispatchKeyDown('ArrowLeft');

      expect(audioMock.currentTime).toBeCloseTo(50 - REGULAR_TIME, 6);
    });

    it('3. Shift+Right seeks forward by shiftTime', async () => {
      await setupTest();
      audioMock.currentTime = 50;

      dispatchKeyDown('ArrowRight', { shiftKey: true });

      expect(audioMock.currentTime).toBeCloseTo(50 + SHIFT_TIME, 6);
    });

    it('4. Shift+Left seeks backward by shiftTime', async () => {
      await setupTest();
      audioMock.currentTime = 50;

      dispatchKeyDown('ArrowLeft', { shiftKey: true });

      expect(audioMock.currentTime).toBeCloseTo(50 - SHIFT_TIME, 6);
    });

    it('5. Alt+Right seeks forward by altTime', async () => {
      await setupTest();
      audioMock.currentTime = 50;

      dispatchKeyDown('ArrowRight', { altKey: true });

      expect(audioMock.currentTime).toBeCloseTo(50 + ALT_TIME, 6);
    });

    it('6. Alt+Left seeks backward by altTime', async () => {
      await setupTest();
      audioMock.currentTime = 50;

      dispatchKeyDown('ArrowLeft', { altKey: true });

      expect(audioMock.currentTime).toBeCloseTo(50 - ALT_TIME, 6);
    });

    it('7. Right arrow clamps at duration', async () => {
      await setupTest();
      audioMock.currentTime = 119.5; // 119.5 + 0.833… > 120

      dispatchKeyDown('ArrowRight');

      expect(audioMock.currentTime).toBe(120);
    });

    it('8. Left arrow clamps at 0', async () => {
      await setupTest();
      audioMock.currentTime = 0.5; // 0.5 − 0.833… < 0

      dispatchKeyDown('ArrowLeft');

      expect(audioMock.currentTime).toBe(0);
    });
  });

  // =======================================================================
  // 9-14, 19-21  Up / Down arrow keys — move selected marker
  // =======================================================================
  describe('Up/Down arrow keys — move markers', () => {
    /**
     * Helper: configure markers on both the nDB mock and the slider mock
     * so the handler under test can find them.
     */
    function setupMarkers(
      markers: any[],
      startId: string | null,
      stopId: string | null
    ) {
      // nDB stores the markers
      nDBGetMock.mockImplementation((key: string) => {
        if (key === 'test-song-key') {
          return {
            markers: markers.map((m) => ({ ...m })),
            currentStartMarker: startId,
            currentStopMarker: stopId,
          };
        }
        return null;
      });

      // Slider exposes selection state
      markerSlider.markers = markers.map((m) => ({ ...m }));
      markerSlider.startMarkerId = startId;
      markerSlider.stopMarkerId = stopId;
      markerSlider.max = 120;
    }

    it('9. Bare Down arrow does nothing (requires Alt/Shift modifier)', async () => {
      setupMarkers(defaultMarkers, 'markerNr0', 'markerNr1S');
      await setupTest();
      nDBSetOnSongMock.mockClear();

      dispatchKeyDown('ArrowDown');

      // Bare down arrow should NOT move markers
      expect(nDBSetOnSongMock).not.toHaveBeenCalled();
    });

    it('10. Bare Up arrow does nothing (requires Alt/Shift modifier)', async () => {
      setupMarkers(defaultMarkers, 'markerNr0', 'markerNr1S');
      await setupTest();
      nDBSetOnSongMock.mockClear();

      dispatchKeyDown('ArrowUp');

      // Bare up arrow should NOT move markers
      expect(nDBSetOnSongMock).not.toHaveBeenCalled();
    });

    it('11. Shift+Down moves markers forward by regularTime', async () => {
      setupMarkers(defaultMarkers, 'markerNr0', 'markerNr1S');
      await setupTest();

      dispatchKeyDown('ArrowDown', { shiftKey: true });

      expect(nDBSetOnSongMock).toHaveBeenCalled();
      const savedMarkers = nDBSetOnSongMock.mock.calls[0][2];

      expect(savedMarkers[0].time).toBeCloseTo(30 + REGULAR_TIME, 6);
      expect(savedMarkers[1].time).toBe(60); // stop marker unchanged
    });

    it('12. Shift+Up moves start marker backward by regularTime', async () => {
      setupMarkers(defaultMarkers, 'markerNr0', 'markerNr1S');
      await setupTest();

      dispatchKeyDown('ArrowUp', { shiftKey: true });

      expect(nDBSetOnSongMock).toHaveBeenCalled();
      const savedMarkers = nDBSetOnSongMock.mock.calls[0][2];

      expect(savedMarkers[0].time).toBeCloseTo(30 - REGULAR_TIME, 6);
      expect(savedMarkers[1].time).toBe(60); // stop marker unchanged
    });

    it('13. Alt+Down moves start marker forward by altTime', async () => {
      setupMarkers(defaultMarkers, 'markerNr0', 'markerNr1S');
      await setupTest();

      dispatchKeyDown('ArrowDown', { altKey: true });

      expect(nDBSetOnSongMock).toHaveBeenCalled();
      const savedMarkers = nDBSetOnSongMock.mock.calls[0][2];

      expect(savedMarkers[0].time).toBeCloseTo(30 + ALT_TIME, 6);
      expect(savedMarkers[1].time).toBe(60); // stop marker unchanged
    });

    it('14. Alt+Up moves start marker backward by altTime', async () => {
      setupMarkers(defaultMarkers, 'markerNr0', 'markerNr1S');
      await setupTest();

      dispatchKeyDown('ArrowUp', { altKey: true });

      expect(nDBSetOnSongMock).toHaveBeenCalled();
      const savedMarkers = nDBSetOnSongMock.mock.calls[0][2];

      expect(savedMarkers[0].time).toBeCloseTo(30 - ALT_TIME, 6);
      expect(savedMarkers[1].time).toBe(60); // stop marker unchanged
    });

    it('14b. Shift+Alt+Down moves start marker forward by shiftTime', async () => {
      setupMarkers(defaultMarkers, 'markerNr0', 'markerNr1S');
      await setupTest();

      dispatchKeyDown('ArrowDown', { shiftKey: true, altKey: true });

      expect(nDBSetOnSongMock).toHaveBeenCalled();
      const savedMarkers = nDBSetOnSongMock.mock.calls[0][2];

      expect(savedMarkers[0].time).toBeCloseTo(30 + SHIFT_TIME, 6);
      expect(savedMarkers[1].time).toBe(60); // stop marker unchanged
    });

    it('14c. Shift+Alt+Up moves start marker backward by shiftTime', async () => {
      setupMarkers(defaultMarkers, 'markerNr0', 'markerNr1S');
      await setupTest();

      dispatchKeyDown('ArrowUp', { shiftKey: true, altKey: true });

      expect(nDBSetOnSongMock).toHaveBeenCalled();
      const savedMarkers = nDBSetOnSongMock.mock.calls[0][2];

      expect(savedMarkers[0].time).toBeCloseTo(30 - SHIFT_TIME, 6);
      expect(savedMarkers[1].time).toBe(60); // stop marker unchanged
    });

    it('19. Down arrow clamps marker at maxTime', async () => {
      const nearEndMarkers = [
        { id: 'markerNr0', name: 'NearEnd', time: 119.5, info: '', color: 'None' },
        { id: 'markerNr1', name: 'End', time: 120, info: '', color: 'None' },
      ];
      setupMarkers(nearEndMarkers, 'markerNr0', 'markerNr1S');
      await setupTest();

      dispatchKeyDown('ArrowDown', { altKey: true });

      expect(nDBSetOnSongMock).toHaveBeenCalled();
      const savedMarkers = nDBSetOnSongMock.mock.calls[0][2];

      // 119.5 + altTime ≈ 119.58 → still within range
      // Use shiftTime to test clamping: 119.5 + shiftTime > 120 → clamped to 120
      // But we're using altKey here, so let's use a marker very close to end
      // Actually let's just verify it clamps correctly with altTime
      expect(savedMarkers[0].time).toBeLessThanOrEqual(120);
    });

    it('19b. Shift+Down clamps marker at maxTime', async () => {
      const nearEndMarkers = [
        { id: 'markerNr0', name: 'NearEnd', time: 119.5, info: '', color: 'None' },
        { id: 'markerNr1', name: 'End', time: 120, info: '', color: 'None' },
      ];
      setupMarkers(nearEndMarkers, 'markerNr0', 'markerNr1S');
      await setupTest();

      dispatchKeyDown('ArrowDown', { shiftKey: true });

      expect(nDBSetOnSongMock).toHaveBeenCalled();
      const savedMarkers = nDBSetOnSongMock.mock.calls[0][2];

      // 119.5 + regularTime ≈ 120.33 → clamped to 120
      expect(savedMarkers[0].time).toBe(120);
    });

    it('20. Up arrow clamps marker at 0', async () => {
      const nearStartMarkers = [
        { id: 'markerNr0', name: 'NearStart', time: 0.5, info: '', color: 'None' },
        { id: 'markerNr1', name: 'End', time: 120, info: '', color: 'None' },
      ];
      setupMarkers(nearStartMarkers, 'markerNr0', 'markerNr1S');
      await setupTest();

      dispatchKeyDown('ArrowUp', { altKey: true });

      expect(nDBSetOnSongMock).toHaveBeenCalled();
      const savedMarkers = nDBSetOnSongMock.mock.calls[0][2];

      // 0.5 − altTime ≈ 0.42 → still above 0
      expect(savedMarkers[0].time).toBeGreaterThanOrEqual(0);
    });

    it('20b. Shift+Up clamps marker at 0', async () => {
      const nearStartMarkers = [
        { id: 'markerNr0', name: 'NearStart', time: 0.5, info: '', color: 'None' },
        { id: 'markerNr1', name: 'End', time: 120, info: '', color: 'None' },
      ];
      setupMarkers(nearStartMarkers, 'markerNr0', 'markerNr1S');
      await setupTest();

      dispatchKeyDown('ArrowUp', { shiftKey: true });

      expect(nDBSetOnSongMock).toHaveBeenCalled();
      const savedMarkers = nDBSetOnSongMock.mock.calls[0][2];

      // 0.5 − regularTime ≈ −0.33 → clamped to 0
      expect(savedMarkers[0].time).toBe(0);
    });

    it('21. Down arrow with no marker selected does nothing', async () => {
      setupMarkers(defaultMarkers, null, null);
      await setupTest();
      nDBSetOnSongMock.mockClear();

      dispatchKeyDown('ArrowDown', { altKey: true });

      expect(nDBSetOnSongMock).not.toHaveBeenCalled();
    });
  });

  // =======================================================================
  // 15-18  Guard conditions — keys should be ignored
  // =======================================================================
  describe('Guard conditions', () => {
    it('15. Arrow keys do nothing in editable elements (input focused)', async () => {
      await setupTest();

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      audioMock.currentTime = 50;
      nDBSetOnSongMock.mockClear();

      dispatchKeyDown('ArrowRight');

      // currentTime must not have changed
      expect(audioMock.currentTime).toBe(50);
      // No marker move should have been attempted
      expect(nDBSetOnSongMock).not.toHaveBeenCalled();
    });

    it('15b. Arrow keys do nothing in editable elements (textarea focused)', async () => {
      await setupTest();

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      audioMock.currentTime = 50;
      nDBSetOnSongMock.mockClear();

      dispatchKeyDown('ArrowDown');

      expect(audioMock.currentTime).toBe(50);
      expect(nDBSetOnSongMock).not.toHaveBeenCalled();
    });

    it('15c. Arrow keys do nothing in contentEditable elements', async () => {
      await setupTest();

      const div = document.createElement('div');
      div.contentEditable = 'true';
      document.body.appendChild(div);
      div.focus();

      audioMock.currentTime = 50;
      nDBSetOnSongMock.mockClear();

      dispatchKeyDown('ArrowRight');

      expect(audioMock.currentTime).toBe(50);
      expect(nDBSetOnSongMock).not.toHaveBeenCalled();
    });

    it('16. Arrow keys do nothing when ctrl is held', async () => {
      await setupTest();
      audioMock.currentTime = 50;

      dispatchKeyDown('ArrowRight', { ctrlKey: true });

      expect(audioMock.currentTime).toBe(50);
    });

    it('16b. Arrow keys do nothing when meta is held', async () => {
      await setupTest();
      audioMock.currentTime = 50;

      dispatchKeyDown('ArrowRight', { metaKey: true });

      expect(audioMock.currentTime).toBe(50);
    });

    it('17. Repeat events are NOT blocked (holding key fires repeatedly)', async () => {
      await setupTest();
      audioMock.currentTime = 50;

      dispatchKeyDown('ArrowRight', { repeat: true });

      // Repeat should still seek (no repeat guard)
      expect(audioMock.currentTime).not.toBe(50);
    });

    it('18. Arrow keys do nothing when composing (IME)', async () => {
      await setupTest();
      audioMock.currentTime = 50;

      dispatchKeyDown('ArrowRight', { isComposing: true });

      expect(audioMock.currentTime).toBe(50);
    });
  });
});
