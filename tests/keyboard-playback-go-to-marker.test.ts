import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as constants from '../constants/constants.js';

// Mock nDB
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

// Mock audio
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

// Mock current-song
vi.mock('../utils/current-song.js', () => ({
  updateHeaderWithCurrentSong: vi.fn(),
  setCurrentSong: vi.fn(),
  getCurrentSongMetadata: vi.fn(() => ({ duration: 120 })),
  getCurrentSongKey: vi.fn(() => 'test-song-key'),
  updateFooterWithCurrentSong: vi.fn(),
}));

// Mock marker slider
const markerSliderMock = {
  markers: [],
  startMarkerId: null,
  stopMarkerId: null,
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

// Mock formatters
vi.mock('../utils/formatters.js', () => ({
  formatDuration: (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`,
  countLast30Days: vi.fn(() => 0),
}));

// Mock troff-settings
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

// Mock firebase-sync
vi.mock('../utils/firebase-sync.js', () => ({
  syncFirebaseGroups: vi.fn().mockResolvedValue(undefined),
}));

// Mock firebase-realtime
vi.mock('../utils/firebase-realtime.js', () => ({
  setupListeners: vi.fn().mockResolvedValue(undefined),
  teardownListeners: vi.fn(),
  saveSongData: vi.fn().mockResolvedValue(undefined),
  setLiveUpdateCallback: vi.fn(),
}));

// Mock log
vi.mock('../utils/log.js', () => ({
  default: {
    i: vi.fn(),
    w: vi.fn(),
    e: vi.fn(),
  },
}));

describe('Keyboard playback keys (Enter/Space) - go to marker behavior', () => {
  let footer: any;
  let settingsPanel: any;
  let markerSlider: any;
  let header: any;
  let songList: any;

  // Per-test overrides for nDB settings
  const nDBOverrides: Record<string, boolean> = {};

  // Handler reference for direct invocation (bypasses accumulated document listeners)
  let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';

    // Intercept document.addEventListener for keydown capture listeners.
    // v2Script registers a capture-phase keydown listener on document each
    // time it initializes. Other test files (v2Script.test.ts, etc.) do the
    // same, leaving stale listeners that accumulate across the suite.
    // When we dispatch a keydown event, ALL stale listeners fire, each calling
    // startPlayback with old module state — causing multiplied side-effects
    // and eventually test timeouts.
    // Our fix: capture the handler but do NOT register it on document.
    // Instead, dispatchKeyDown calls the handler directly.
    keydownHandler = null;
    const origAE = document.addEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation(
      (type: string, handler: any, options?: any) => {
        if (
          type === 'keydown' &&
          (options === true || (typeof options === 'object' && options?.capture))
        ) {
          keydownHandler = handler as (e: KeyboardEvent) => void;
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
    // Clear per-test nDB overrides
    Object.keys(nDBOverrides).forEach((k) => delete nDBOverrides[k]);
    audioMock.currentTime = 0;
    audioMock.paused = true;
    audioMock.play.mockClear();
    audioMock.play.mockResolvedValue(undefined);
    audioMock.pause.mockClear();

    // Create DOM elements
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

    // Default nDB mock implementation
    nDBGetMock.mockImplementation((key: string) => {
      if (key === 'test-song-key') {
        return {
          markers: [
            { id: 'markerNr0', name: 'Start', time: 30, info: '', color: 'None' },
            { id: 'markerNr1', name: 'End', time: 90, info: '', color: 'None' },
          ],
          currentStartMarker: 'markerNr0',
          currentStopMarker: 'markerNr1S',
          TROFF_VALUE_startBefore: 5,
          TROFF_CLASS_TO_TOGGLE_buttStartBefore: true,
        };
      }
      // Global settings — check per-test overrides first
      if (key in nDBOverrides) return nDBOverrides[key];
      if (key === constants.TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR) return false;
      if (key === constants.TROFF_SETTING_ENTER_RESET_COUNTER) return false;
      if (key === constants.TROFF_SETTING_ENTER_GO_TO_MARKER_BEHAVIOUR) return false;
      if (key === constants.TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR) return false;
      if (key === constants.TROFF_SETTING_SPACE_RESET_COUNTER) return false;
      if (key === constants.TROFF_SETTING_SPACE_GO_TO_MARKER_BEHAVIOUR) return false;
      if (key === constants.TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR) return false;
      if (key === constants.TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER) return false;
      if (key === constants.TROFF_SETTING_EXTENDED_MARKER_COLOR) return null;
      if (key === constants.TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR) return null;
      if (key === 'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_START_BEFORE_VALUE') return '4';
      if (key === 'TROFF_SETTING_SONG_DEFAULT_START_BEFORE_ON') return false;
      if (key === 'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_STOP_AFTER_VALUE') return '2';
      if (key === 'TROFF_SETTING_SONG_DEFAULT_STOP_AFTER_ON') return false;
      if (key === 'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_PAUSE_BEFORE_VALUE') return '3';
      if (key === 'TROFF_SETTING_SONG_DEFAULT_PAUSE_BEFORE_ON') return true;
      if (key === 'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_WAIT_BETWEEN_VALUE') return '1';
      if (key === 'TROFF_SETTING_SONG_DEFAULT_WAIT_BETWEEN_ON') return true;
      if (key === 'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_INCREMENT_UNTIL_VALUE') return '100';
      if (key === 'TROFF_SETTING_SONG_DEFAULT_INCREMENT_UNTIL_ON') return false;
      if (key === 'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_NR_LOOPS_VALUE') return '1';
      if (key === constants.TROFF_SETTING_SONG_DEFAULT_NR_LOOPS_INFINIT_IS_ON) return false;
      if (key === 'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_VOLUME_VALUE') return '75';
      if (key === 'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_SPEED_VALUE') return '100';
      return null;
    });

    nDBSetOnSongMock.mockImplementation((songKey: string, path: string | string[], value: any) => {
      // Mock implementation
    });

    nDBSetMock.mockImplementation((key: string, value: any) => {
      // Mock implementation
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

    // Wait for components to render
    await footer.updateComplete;
    await markerSlider.updateComplete;
    await settingsPanel.updateComplete;
  }

  function dispatchKeyDown(key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      composed: true,
      cancelable: true,
    });

    // Call the handler directly instead of dispatching through the DOM,
    // to avoid triggering stale document-level listeners left by other test files.
    if (keydownHandler) {
      keydownHandler(event);
    }

    return event;
  }

  describe('Enter key - go to marker', () => {
    it('should seek to marker start time when pausing with goToMarker enabled', async () => {
      markerSlider.markers = [
        { id: 'markerNr0', name: 'Start', time: 30, info: '', color: 'None' },
        { id: 'markerNr1', name: 'End', time: 90, info: '', color: 'None' },
      ];
      markerSlider.startMarkerId = 'markerNr0';
      markerSlider.stopMarkerId = 'markerNr1S';
      markerSlider.startBefore = 5;
      markerSlider.getPlaybackStart = vi.fn(() => 25); // 30 - 5 = 25

      await setupTest();

      // Simulate playing state
      audioMock.paused = false;
      audioMock.currentTime = 50;
      nDBOverrides[constants.TROFF_SETTING_ENTER_GO_TO_MARKER_BEHAVIOUR] = true;
      settingsPanel.enterGoToMarker = true;
      await settingsPanel.updateComplete;

      dispatchKeyDown('Enter');
      await new Promise((r) => setTimeout(r, 0));

      // Should seek to 25 (marker time - startBefore) and pause
      expect(audioMock.currentTime).toBe(25);
      expect(audioMock.pause).toHaveBeenCalled();
    });

    it('should NOT seek when pausing with goToMarker disabled', async () => {
      markerSlider.markers = [
        { id: 'markerNr0', name: 'Start', time: 30, info: '', color: 'None' },
        { id: 'markerNr1', name: 'End', time: 90, info: '', color: 'None' },
      ];
      markerSlider.startMarkerId = 'markerNr0';
      markerSlider.stopMarkerId = 'markerNr1S';
      markerSlider.startBefore = 5;
      markerSlider.getPlaybackStart = vi.fn(() => 25);

      await setupTest();

      // Simulate playing state
      audioMock.paused = false;
      audioMock.currentTime = 50;
      settingsPanel.enterGoToMarker = false;
      await settingsPanel.updateComplete;

      dispatchKeyDown('Enter');
      await new Promise((r) => setTimeout(r, 0));

      // Should not seek, just pause
      expect(audioMock.currentTime).toBe(50);
      expect(audioMock.pause).toHaveBeenCalled();
    });

    it('should NOT seek when starting playback even with goToMarker enabled', async () => {
      markerSlider.markers = [
        { id: 'markerNr0', name: 'Start', time: 30, info: '', color: 'None' },
        { id: 'markerNr1', name: 'End', time: 90, info: '', color: 'None' },
      ];
      markerSlider.startMarkerId = 'markerNr0';
      markerSlider.stopMarkerId = 'markerNr1S';
      markerSlider.startBefore = 5;
      markerSlider.getPlaybackStart = vi.fn(() => 25);

      await setupTest();

      // Audio is paused (default), currentTime set to 50
      audioMock.currentTime = 50;
      nDBOverrides[constants.TROFF_SETTING_ENTER_GO_TO_MARKER_BEHAVIOUR] = true;
      settingsPanel.enterGoToMarker = true;
      await settingsPanel.updateComplete;

      expect(audioMock.paused).toBe(true);

      dispatchKeyDown('Enter');
      await new Promise((r) => setTimeout(r, 0));

      // Should NOT seek, just start playback
      expect(audioMock.currentTime).toBe(50);
      expect(audioMock.play).toHaveBeenCalled();
    });

    it('should not seek when no start marker is selected', async () => {
      markerSlider.markers = [
        { id: 'markerNr0', name: 'Start', time: 30, info: '', color: 'None' },
        { id: 'markerNr1', name: 'End', time: 90, info: '', color: 'None' },
      ];
      markerSlider.startMarkerId = null; // No start marker selected
      markerSlider.stopMarkerId = 'markerNr1S';
      markerSlider.getPlaybackStart = vi.fn(() => 0);

      await setupTest();

      // Simulate playing state
      audioMock.paused = false;
      audioMock.currentTime = 50;
      nDBOverrides[constants.TROFF_SETTING_ENTER_GO_TO_MARKER_BEHAVIOUR] = true;
      settingsPanel.enterGoToMarker = true;
      await settingsPanel.updateComplete;

      dispatchKeyDown('Enter');
      await new Promise((r) => setTimeout(r, 0));

      // No start marker, so startTime from getPlaybackStart is 0 — still finite,
      // but currentTime should be set to 0 and pause called
      expect(audioMock.currentTime).toBe(0);
      expect(audioMock.pause).toHaveBeenCalled();
    });

    it('should clamp at 0 when startBefore exceeds marker time', async () => {
      markerSlider.markers = [
        { id: 'markerNr0', name: 'Start', time: 3, info: '', color: 'None' },
        { id: 'markerNr1', name: 'End', time: 90, info: '', color: 'None' },
      ];
      markerSlider.startMarkerId = 'markerNr0';
      markerSlider.stopMarkerId = 'markerNr1S';
      markerSlider.startBefore = 10; // More than marker time
      markerSlider.getPlaybackStart = vi.fn(() => 0); // Math.max(3 - 10, 0) = 0

      await setupTest();

      // Simulate playing state
      audioMock.paused = false;
      audioMock.currentTime = 50;
      nDBOverrides[constants.TROFF_SETTING_ENTER_GO_TO_MARKER_BEHAVIOUR] = true;
      settingsPanel.enterGoToMarker = true;
      await settingsPanel.updateComplete;

      dispatchKeyDown('Enter');
      await new Promise((r) => setTimeout(r, 0));

      expect(audioMock.currentTime).toBe(0);
      expect(audioMock.pause).toHaveBeenCalled();
    });
  });

  describe('Space key - go to marker', () => {
    it('should seek to marker start time when pausing with goToMarker enabled', async () => {
      markerSlider.markers = [
        { id: 'markerNr0', name: 'Start', time: 30, info: '', color: 'None' },
        { id: 'markerNr1', name: 'End', time: 90, info: '', color: 'None' },
      ];
      markerSlider.startMarkerId = 'markerNr0';
      markerSlider.stopMarkerId = 'markerNr1S';
      markerSlider.startBefore = 5;
      markerSlider.getPlaybackStart = vi.fn(() => 25);

      await setupTest();

      // Simulate playing state
      audioMock.paused = false;
      audioMock.currentTime = 50;
      nDBOverrides[constants.TROFF_SETTING_SPACE_GO_TO_MARKER_BEHAVIOUR] = true;
      settingsPanel.spaceGoToMarker = true;
      await settingsPanel.updateComplete;

      // Press Space key
      dispatchKeyDown(' ');
      await new Promise((r) => setTimeout(r, 0));

      // Should seek to 25 and pause
      expect(audioMock.currentTime).toBe(25);
      expect(audioMock.pause).toHaveBeenCalled();
    });

    it('should NOT seek when pausing with goToMarker disabled', async () => {
      markerSlider.markers = [
        { id: 'markerNr0', name: 'Start', time: 30, info: '', color: 'None' },
        { id: 'markerNr1', name: 'End', time: 90, info: '', color: 'None' },
      ];
      markerSlider.startMarkerId = 'markerNr0';
      markerSlider.stopMarkerId = 'markerNr1S';
      markerSlider.startBefore = 5;
      markerSlider.getPlaybackStart = vi.fn(() => 25);

      await setupTest();

      // Simulate playing state
      audioMock.paused = false;
      audioMock.currentTime = 50;
      settingsPanel.spaceGoToMarker = false;
      await settingsPanel.updateComplete;

      dispatchKeyDown(' ');
      await new Promise((r) => setTimeout(r, 0));

      // Should not seek, just pause
      expect(audioMock.currentTime).toBe(50);
      expect(audioMock.pause).toHaveBeenCalled();
    });

    it('should NOT seek when starting playback even with goToMarker enabled', async () => {
      markerSlider.markers = [
        { id: 'markerNr0', name: 'Start', time: 30, info: '', color: 'None' },
        { id: 'markerNr1', name: 'End', time: 90, info: '', color: 'None' },
      ];
      markerSlider.startMarkerId = 'markerNr0';
      markerSlider.stopMarkerId = 'markerNr1S';
      markerSlider.startBefore = 5;
      markerSlider.getPlaybackStart = vi.fn(() => 25);

      await setupTest();

      // Audio is paused (default), currentTime set to 50
      audioMock.currentTime = 50;
      nDBOverrides[constants.TROFF_SETTING_SPACE_GO_TO_MARKER_BEHAVIOUR] = true;
      settingsPanel.spaceGoToMarker = true;
      await settingsPanel.updateComplete;

      expect(audioMock.paused).toBe(true);

      dispatchKeyDown(' ');
      await new Promise((r) => setTimeout(r, 0));

      // Should NOT seek, just start playback
      expect(audioMock.currentTime).toBe(50);
      expect(audioMock.play).toHaveBeenCalled();
    });

    it('should not seek when no start marker is selected', async () => {
      markerSlider.markers = [
        { id: 'markerNr0', name: 'Start', time: 30, info: '', color: 'None' },
        { id: 'markerNr1', name: 'End', time: 90, info: '', color: 'None' },
      ];
      markerSlider.startMarkerId = null;
      markerSlider.stopMarkerId = 'markerNr1S';
      markerSlider.getPlaybackStart = vi.fn(() => 0);

      await setupTest();

      // Simulate playing state
      audioMock.paused = false;
      audioMock.currentTime = 50;
      nDBOverrides[constants.TROFF_SETTING_SPACE_GO_TO_MARKER_BEHAVIOUR] = true;
      settingsPanel.spaceGoToMarker = true;
      await settingsPanel.updateComplete;

      dispatchKeyDown(' ');
      await new Promise((r) => setTimeout(r, 0));

      // No start marker, so startTime from getPlaybackStart is 0 — still finite,
      // but currentTime should be set to 0 and pause called
      expect(audioMock.currentTime).toBe(0);
      expect(audioMock.pause).toHaveBeenCalled();
    });

    it('should clamp at 0 when startBefore exceeds marker time', async () => {
      markerSlider.markers = [
        { id: 'markerNr0', name: 'Start', time: 3, info: '', color: 'None' },
        { id: 'markerNr1', name: 'End', time: 90, info: '', color: 'None' },
      ];
      markerSlider.startMarkerId = 'markerNr0';
      markerSlider.stopMarkerId = 'markerNr1S';
      markerSlider.startBefore = 10;
      markerSlider.getPlaybackStart = vi.fn(() => 0);

      await setupTest();

      // Simulate playing state
      audioMock.paused = false;
      audioMock.currentTime = 50;
      nDBOverrides[constants.TROFF_SETTING_SPACE_GO_TO_MARKER_BEHAVIOUR] = true;
      settingsPanel.spaceGoToMarker = true;
      await settingsPanel.updateComplete;

      dispatchKeyDown(' ');
      await new Promise((r) => setTimeout(r, 0));

      expect(audioMock.currentTime).toBe(0);
      expect(audioMock.pause).toHaveBeenCalled();
    });

    it('should also work with Spacebar key (legacy)', async () => {
      markerSlider.markers = [
        { id: 'markerNr0', name: 'Start', time: 30, info: '', color: 'None' },
        { id: 'markerNr1', name: 'End', time: 90, info: '', color: 'None' },
      ];
      markerSlider.startMarkerId = 'markerNr0';
      markerSlider.stopMarkerId = 'markerNr1S';
      markerSlider.startBefore = 5;
      markerSlider.getPlaybackStart = vi.fn(() => 25);

      await setupTest();

      // Simulate playing state
      audioMock.paused = false;
      audioMock.currentTime = 50;
      nDBOverrides[constants.TROFF_SETTING_SPACE_GO_TO_MARKER_BEHAVIOUR] = true;
      settingsPanel.spaceGoToMarker = true;
      await settingsPanel.updateComplete;

      dispatchKeyDown('Spacebar');
      await new Promise((r) => setTimeout(r, 0));

      expect(audioMock.currentTime).toBe(25);
      expect(audioMock.pause).toHaveBeenCalled();
    });
  });

  describe('Enter and Space keys should be independent', () => {
    it('should only seek for Enter when enterGoToMarker is enabled but spaceGoToMarker is disabled', async () => {
      markerSlider.markers = [
        { id: 'markerNr0', name: 'Start', time: 30, info: '', color: 'None' },
        { id: 'markerNr1', name: 'End', time: 90, info: '', color: 'None' },
      ];
      markerSlider.startMarkerId = 'markerNr0';
      markerSlider.stopMarkerId = 'markerNr1S';
      markerSlider.startBefore = 5;
      markerSlider.getPlaybackStart = vi.fn(() => 25);

      await setupTest();

      audioMock.currentTime = 0;
      nDBOverrides[constants.TROFF_SETTING_ENTER_GO_TO_MARKER_BEHAVIOUR] = true;
      settingsPanel.enterGoToMarker = true;
      settingsPanel.spaceGoToMarker = false;
      await settingsPanel.updateComplete;

      // Press Enter while playing - should seek and pause
      audioMock.paused = false;
      audioMock.currentTime = 50;
      audioMock.pause.mockClear();
      dispatchKeyDown('Enter');
      await new Promise((r) => setTimeout(r, 0));
      expect(audioMock.currentTime).toBe(25);
      expect(audioMock.pause).toHaveBeenCalled();

      // Reset to playing state
      audioMock.paused = false;
      audioMock.currentTime = 50;
      audioMock.pause.mockClear();

      // Press Space while playing - should NOT seek, just pause
      dispatchKeyDown(' ');
      await new Promise((r) => setTimeout(r, 0));
      expect(audioMock.currentTime).toBe(50);
      expect(audioMock.pause).toHaveBeenCalled();
    });

    it('should only seek for Space when spaceGoToMarker is enabled but enterGoToMarker is disabled', async () => {
      markerSlider.markers = [
        { id: 'markerNr0', name: 'Start', time: 30, info: '', color: 'None' },
        { id: 'markerNr1', name: 'End', time: 90, info: '', color: 'None' },
      ];
      markerSlider.startMarkerId = 'markerNr0';
      markerSlider.stopMarkerId = 'markerNr1S';
      markerSlider.startBefore = 5;
      markerSlider.getPlaybackStart = vi.fn(() => 25);

      await setupTest();

      audioMock.currentTime = 0;
      nDBOverrides[constants.TROFF_SETTING_SPACE_GO_TO_MARKER_BEHAVIOUR] = true;
      settingsPanel.enterGoToMarker = false;
      settingsPanel.spaceGoToMarker = true;
      await settingsPanel.updateComplete;

      // Press Space while playing - should seek and pause
      audioMock.paused = false;
      audioMock.currentTime = 50;
      audioMock.pause.mockClear();
      dispatchKeyDown(' ');
      await new Promise((r) => setTimeout(r, 0));
      expect(audioMock.currentTime).toBe(25);
      expect(audioMock.pause).toHaveBeenCalled();

      // Reset to playing state
      audioMock.paused = false;
      audioMock.currentTime = 50;
      audioMock.pause.mockClear();

      // Press Enter while playing - should NOT seek, just pause
      dispatchKeyDown('Enter');
      await new Promise((r) => setTimeout(r, 0));
      expect(audioMock.currentTime).toBe(50);
      expect(audioMock.pause).toHaveBeenCalled();
    });
  });
});
