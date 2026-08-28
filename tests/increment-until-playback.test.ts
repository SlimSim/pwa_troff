import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Integration tests for the increment-until feature during playback.
 *
 * These tests verify that when a loop restarts in v2Script.ts, the
 * `calculateIncrementUntilSpeed` function is called and `audio.playbackRate`
 * is updated toward the target speed.
 *
 * Expected result: These tests should FAIL (RED) because the `onTimeUpdate`
 * handler in v2Script.ts does NOT currently wire up the increment-until logic.
 */

// ── Mock nDB ──────────────────────────────────────────────────────────
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

// ── Mock audio ────────────────────────────────────────────────────────
const timeUpdateListeners: Array<() => void> = [];

const audioMock = {
  currentTime: 0,
  duration: 120,
  playbackRate: 1,
  volume: 1,
  paused: true,
  addEventListener: vi.fn((event: string, handler: () => void) => {
    if (event === 'timeupdate') {
      timeUpdateListeners.push(handler);
    }
  }),
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
};

vi.mock('../services/audio.js', () => ({
  audio: audioMock,
  loadSong: vi.fn(),
}));

// ── Mock current-song ─────────────────────────────────────────────────
vi.mock('../utils/current-song.js', () => ({
  updateHeaderWithCurrentSong: vi.fn(),
  setCurrentSong: vi.fn(),
  getCurrentSongMetadata: vi.fn(() => ({ duration: 120 })),
  getCurrentSongKey: vi.fn(() => 'test-song-key'),
  updateFooterWithCurrentSong: vi.fn(),
}));

// ── Mock marker slider ────────────────────────────────────────────────
const markerSliderMock = {
  markers: [
    { id: 'markerNr0', name: 'Start', time: 10, info: '', color: 'None' },
    { id: 'markerNr1', name: 'End', time: 60, info: '', color: 'None' },
  ],
  startMarkerId: 'markerNr0',
  stopMarkerId: 'markerNr1S',
  startBefore: 0,
  stopAfter: 0,
  min: 0,
  max: 120,
  unit: 's',
  value: 0,
  zoomLevel: 1,
  minZoom: 1,
  getPlaybackStart: vi.fn(() => 10),
  getPlaybackStop: vi.fn(() => 60),
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

// ── Mock formatters ───────────────────────────────────────────────────
vi.mock('../utils/formatters.js', () => ({
  formatDuration: (sec: number) =>
    `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`,
  countLast30Days: vi.fn(() => 0),
}));

// ── Mock troff-settings ───────────────────────────────────────────────
vi.mock('../utils/troff-settings.js', () => ({
  configureMarkerSlider: vi.fn(),
  getStartBefore: vi.fn(() => 0),
  getStopAfter: vi.fn(() => 0),
  getIncrementUntil: vi.fn(() => 100),
  ensureDefaultMarkers: vi.fn((songData, duration) => [
    { id: 'markerNr0', name: 'Start', time: 0, info: '', color: 'None' },
    { id: 'markerNr1', name: 'End', time: duration, info: '', color: 'None' },
  ]),
}));

// ── Mock firebase-sync ────────────────────────────────────────────────
vi.mock('../utils/firebase-sync.js', () => ({
  syncFirebaseGroups: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock firebase-realtime ────────────────────────────────────────────
vi.mock('../utils/firebase-realtime.js', () => ({
  setupListeners: vi.fn().mockResolvedValue(undefined),
  teardownListeners: vi.fn(),
  saveSongData: vi.fn().mockResolvedValue(undefined),
  setLiveUpdateCallback: vi.fn(),
}));

// ── Mock log ──────────────────────────────────────────────────────────
vi.mock('../utils/log.js', () => ({
  default: {
    i: vi.fn(),
    w: vi.fn(),
    e: vi.fn(),
  },
}));

// ── Mock marker-actions (needed by v2Script imports) ──────────────────
vi.mock('../utils/marker-actions.js', () => ({
  getSelectedMarkerRange: vi.fn(() => []),
  copyMarkers: vi.fn(),
  moveMarkers: vi.fn(),
  stretchMarkers: vi.fn(),
  deleteMarkers: vi.fn(),
  normalizeMarkerTime: vi.fn(),
  mergeNearbyMarkers: vi.fn(),
}));

vi.mock('../utils/marker-import.js', () => ({
  mergeImportedMarkers: vi.fn(),
}));

vi.mock('../utils/notification.js', () => ({
  showToast: vi.fn(),
}));

vi.mock('../utils/pwa.js', () => ({
  initPwa: vi.fn(),
}));

vi.mock('../utils/sentry.js', () => ({
  setSentryEnvironment: vi.fn(),
  setSentryVersion: vi.fn(),
  setSentryApp: vi.fn(),
  addAndStartSentry: vi.fn(),
}));

vi.mock('../utils/manifestHelper.js', () => ({
  getManifest: () => Promise.resolve({ version: 'test' }),
}));

vi.mock('../utils/phoneUtils.js', () => ({
  updateWakeLockForPlayback: vi.fn(),
}));

vi.mock('../utils/utils.js', () => ({
  toSongKey: vi.fn((s: string) => s),
}));

// ── Test suite ────────────────────────────────────────────────────────

describe('Increment-until during playback (integration)', () => {
  let footer: any;
  let settingsPanel: any;
  let markerSlider: any;
  let header: any;
  let songList: any;

  beforeEach(() => {
    vi.resetModules();
    timeUpdateListeners.length = 0;
    document.body.innerHTML = '';

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
    audioMock.playbackRate = 1;
    audioMock.paused = true;
    audioMock.play.mockClear();
    audioMock.play.mockResolvedValue(undefined);
    audioMock.pause.mockClear();

    // ── Create DOM elements ──────────────────────────────────────────
    header = document.createElement('div');
    header.id = 'header';
    header.statusLoopsLeft = '';
    header.statusCountdown = '';
    header.currentTime = '';
    header.totalTime = '';
    document.body.appendChild(header);

    songList = document.createElement('div');
    songList.id = 'songList';
    songList.visible = false;
    document.body.appendChild(songList);

    footer = document.createElement('div');
    footer.id = 'footer';
    footer.pauseBefore = 0;
    footer.waitBetween = 0;
    footer.disablePauseBefore = true;
    footer.disableWaitBetween = true;
    footer.disablePauseBefore = true;
    footer.disableWaitBetween = true;
    footer.isStartingPlayback = false;
    footer.playbackCountdown = 0;
    footer.loopTimesLeftLabel = '';
    footer.markerDialogInitialTime = 0;
    footer.markerDialogSuggestedName = '';
    footer.openMarkerDialogForEdit = vi.fn();
    footer.updateComplete = Promise.resolve();
    document.body.appendChild(footer);

    settingsPanel = document.createElement('div');
    settingsPanel.id = 'settingsPanel';
    settingsPanel.visible = false;
    settingsPanel.startBeforeValue = 0;
    settingsPanel.startBeforeDisabled = true;
    settingsPanel.stopAfterValue = 0;
    settingsPanel.stopAfterDisabled = true;
    settingsPanel.incrementUntillValue = 120; // target speed = 120%
    settingsPanel.incrementUntillDisabled = false; // feature ON
    settingsPanel.updateComplete = Promise.resolve();
    document.body.appendChild(settingsPanel);

    markerSlider = document.createElement('div');
    markerSlider.id = 'markerSlider';
    Object.assign(markerSlider, markerSliderMock);
    document.body.appendChild(markerSlider);

    // ── Default nDB mock ─────────────────────────────────────────────
    nDBGetMock.mockImplementation((key: string) => {
      if (key === 'test-song-key') {
        return {
          markers: [
            { id: 'markerNr0', name: 'Start', time: 10, info: '', color: 'None' },
            { id: 'markerNr1', name: 'End', time: 60, info: '', color: 'None' },
          ],
          currentStartMarker: 'markerNr0',
          currentStopMarker: 'markerNr1S',
          loopTimes: 5,
          TROFF_VALUE_startBefore: 0,
          TROFF_CLASS_TO_TOGGLE_buttStartBefore: false,
          TROFF_CLASS_TO_TOGGLE_buttStopAfter: false,
          TROFF_CLASS_TO_TOGGLE_buttIncrementUntil: true,
          TROFF_VALUE_incrementUntilValue: 120,
        };
      }
      // Global settings defaults
      if (key === 'TROFF_SETTING_SONG_DEFAULT_PAUSE_BEFORE_ON') return false;
      if (key === 'TROFF_SETTING_SONG_DEFAULT_WAIT_BETWEEN_ON') return false;
      if (key === 'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_PAUSE_BEFORE_VALUE') return '0';
      if (key === 'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_WAIT_BETWEEN_VALUE') return '0';
      if (key === 'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_NR_LOOPS_VALUE') return '5';
      if (key === 'TROFF_SETTING_SONG_DEFAULT_NR_LOOPS_INFINIT_IS_ON') return false;
      if (key === 'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_SPEED_VALUE') return '100';
      if (key === 'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_VOLUME_VALUE') return '75';
      return null;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  async function setupTest() {
    await import('../v2Script.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await footer.updateComplete;
    await markerSlider.updateComplete;
    await settingsPanel.updateComplete;
  }

  /**
   * Invoke the timeupdate handler that was registered on the audio mock
   * during v2Script initialization.
   */
  function fireTimeUpdate() {
    for (const handler of timeUpdateListeners) {
      handler();
    }
  }

  // ──────────────────────────────────────────────────────────────────
  //  Test 1: increment-until changes speed when loop restarts
  // ──────────────────────────────────────────────────────────────────
  it('should change audio.playbackRate toward the target speed when a loop restarts and increment-until is enabled', async () => {
    // Arrange:
    //   - Playback region: 10s → 60s (stop at 60s)
    //   - 5 loops configured; after first decrement loopTimesLeft = 4
    //   - Target speed = 120%, current = 100%
    //   - calculateIncrementUntilSpeed(100, 120, 4) = 105
    //   - So audio.playbackRate should become 1.05
    markerSlider.getPlaybackStop = vi.fn(() => 60);
    markerSlider.getPlaybackStart = vi.fn(() => 10);

    // Make audio report as playing
    audioMock.paused = false;

    await setupTest();

    // Verify starting state
    expect(audioMock.playbackRate).toBe(1);

    // Simulate playback reaching the stop point
    audioMock.currentTime = 60;
    fireTimeUpdate();

    // Assert: playbackRate should have been incremented toward 120
    // Since loopTimesLeft was 5, after decrement it's 4,
    // so calculateIncrementUntilSpeed(100, 120, 4) = 105 → playbackRate = 1.05
    expect(audioMock.playbackRate).not.toBe(1);
  });

  // ──────────────────────────────────────────────────────────────────
  //  Test 2: increment-until does NOT change speed when disabled
  // ──────────────────────────────────────────────────────────────────
  it('should NOT change audio.playbackRate when a loop restarts and increment-until is disabled', async () => {
    // Arrange: feature is OFF
    settingsPanel.incrementUntillDisabled = true;
    settingsPanel.incrementUntillValue = 120;

    markerSlider.getPlaybackStop = vi.fn(() => 60);
    markerSlider.getPlaybackStart = vi.fn(() => 10);

    audioMock.paused = false;

    await setupTest();

    expect(audioMock.playbackRate).toBe(1);

    // Simulate playback reaching the stop point
    audioMock.currentTime = 60;
    fireTimeUpdate();

    // Assert: playbackRate should remain unchanged
    expect(audioMock.playbackRate).toBe(1);
  });
});
