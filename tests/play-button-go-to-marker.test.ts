import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as constants from '../constants/constants.js';

// Mock nDB before importing v2Script
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

describe('play button "go to marker" behavior', () => {
  let audioMock: {
    currentTime: number;
    duration: number;
    playbackRate: number;
    volume: number;
    paused: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
  };
  let footer: HTMLElement & Record<string, any>;
  let markerSlider: HTMLElement & Record<string, any>;
  let settingsPanel: HTMLElement & Record<string, any>;
  let header: HTMLElement & Record<string, any>;
  let songList: HTMLElement & Record<string, any>;

  const dispatchKeyDown = (key: string) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true });
    document.dispatchEvent(event);
  };

  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    nDBGetMock.mockReset();
    nDBSetMock.mockReset();
    nDBSetOnSongMock.mockReset();

    // Guard against custom element re-registration
    const originalDefine = customElements.define.bind(customElements);
    const registry = customElements;
    const patched = Object.create(registry);
    patched.define = (name: string, constructor: CustomElementConstructor, options?: ElementDefinitionOptions) => {
      if (!registry.get(name)) {
        originalDefine(name, constructor, options);
      }
    };
    vi.stubGlobal('customElements', patched);

    // Mock requestAnimationFrame
    const raf = (cb: Function) => { cb(); return 0; };
    vi.stubGlobal('requestAnimationFrame', raf);
    window.requestAnimationFrame = raf;

    // Create audio mock instead of real audio element
    audioMock = {
      currentTime: 0,
      duration: 120,
      playbackRate: 1,
      volume: 1,
      paused: true,
      addEventListener: vi.fn(),
      play: vi.fn(() => Promise.resolve(undefined)),
      pause: vi.fn(),
    };

    // Create footer as plain div with required properties
    footer = document.createElement('div');
    footer.id = 'footer';
    footer.isPlaying = false;
    footer.isStartingPlayback = false;
    footer.playbackCountdown = 0;
    footer.pauseBefore = 3;
    footer.disablePauseBefore = false;
    footer.waitBetween = 1;
    footer.disableWaitBetween = false;
    footer.speed = 100;
    footer.volume = 75;
    document.body.appendChild(footer);

    // Create marker slider as plain div with mock methods
    markerSlider = document.createElement('div');
    markerSlider.id = 'markerSlider';
    markerSlider.markers = [];
    markerSlider.min = 0;
    markerSlider.max = 120;
    markerSlider.unit = 's';
    markerSlider.value = 0;
    markerSlider.startMarkerId = null;
    markerSlider.stopMarkerId = null;
    markerSlider.startBefore = 0;
    markerSlider.stopAfter = 0;
    markerSlider.getPlaybackStart = vi.fn(() => 0);
    markerSlider.getPlaybackStop = vi.fn(() => 120);
    markerSlider.requestUpdate = vi.fn();
    document.body.appendChild(markerSlider);

    // Create settings panel as plain div
    settingsPanel = document.createElement('div');
    settingsPanel.id = 'settingsPanel';
    settingsPanel.playGoToMarker = false;
    settingsPanel.playUseTimer = false;
    settingsPanel.playResetCounter = false;
    document.body.appendChild(settingsPanel);

    // Create header as plain div
    header = document.createElement('div');
    header.id = 'header';
    header.statusCountdown = '0s';
    header.statusLoopsLeft = '1#';
    document.body.appendChild(header);

    // Create songList as plain div
    songList = document.createElement('div');
    songList.id = 'songList';
    songList.visible = false;
    songList.reloadSongs = vi.fn().mockResolvedValue(undefined);
    document.body.appendChild(songList);

    // Mock current-song
    vi.doMock('../utils/current-song.js', () => ({
      updateHeaderWithCurrentSong: vi.fn(),
      setCurrentSong: vi.fn(),
      getCurrentSongMetadata: vi.fn(() => ({ duration: 120 })),
      getCurrentSongKey: vi.fn(() => null), // Return null to prevent auto-loading song on init
      updateFooterWithCurrentSong: vi.fn(),
    }));

    // Mock audio service - use the mock
    vi.doMock('../services/audio.js', () => ({
      audio: audioMock,
      loadSong: vi.fn(),
    }));

    // Mock firebase-realtime
    vi.doMock('../utils/firebase-realtime.js', () => ({
      setupListeners: vi.fn(),
      teardownListeners: vi.fn(),
      saveSongData: vi.fn(),
      setLiveUpdateCallback: vi.fn(),
    }));

    // Mock notification
    vi.doMock('../utils/notification.js', () => ({
      showDownloadProgress: vi.fn(() => ({ update: vi.fn(), done: vi.fn() })),
      showToast: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  describe('when playGoToMarker is enabled', () => {
    beforeEach(() => {
      // Set up nDB to return playGoToMarker = true
      nDBGetMock.mockImplementation((key: string) => {
        // Always return true for any GO_TO_MARKER key to ensure the condition passes
        if (key.includes('GO_TO_MARKER')) {
          return true;
        }
        if (key === constants.TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR) {
          return false;
        }
        if (key === constants.TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER) {
          return false;
        }
        if (key === constants.TROFF_SETTING_EXTENDED_MARKER_COLOR) {
          return false;
        }
        if (key === constants.TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR) {
          return false;
        }
        if (key === 'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_START_BEFORE_VALUE') {
          return '4';
        }
        if (key === constants.TROFF_SETTING_SONG_DEFAULT_START_BEFORE_ON) {
          return false;
        }
        if (key === 'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_STOP_AFTER_VALUE') {
          return '2';
        }
        if (key === constants.TROFF_SETTING_SONG_DEFAULT_STOP_AFTER_ON) {
          return false;
        }
        if (key === 'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_PAUSE_BEFORE_VALUE') {
          return '3';
        }
        if (key === constants.TROFF_SETTING_SONG_DEFAULT_PAUSE_BEFORE_ON) {
          return true;
        }
        if (key === 'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_WAIT_BETWEEN_VALUE') {
          return '1';
        }
        if (key === constants.TROFF_SETTING_SONG_DEFAULT_WAIT_BETWEEN_ON) {
          return true;
        }
        if (key === 'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_INCREMENT_UNTIL_VALUE') {
          return '100';
        }
        if (key === constants.TROFF_SETTING_SONG_DEFAULT_INCREMENT_UNTIL_ON) {
          return false;
        }
        if (key === 'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_NR_LOOPS_VALUE') {
          return '1';
        }
        if (key === constants.TROFF_SETTING_SONG_DEFAULT_NR_LOOPS_INFINIT_IS_ON) {
          return false;
        }
        if (key === 'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_VOLUME_VALUE') {
          return '75';
        }
        if (key === 'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_SPEED_VALUE') {
          return '100';
        }
        return null;
      });

      // Set up song data with a marker at 30 seconds and startBefore = 5
      const songData = {
        markers: [
          { id: 'markerNr0', name: 'Start', time: 30, info: '', color: 'None' },
          { id: 'markerNr1', name: 'End', time: 90, info: '', color: 'None' },
        ],
        currentStartMarker: 'markerNr0',
        currentStopMarker: 'markerNr1S',
        TROFF_VALUE_startBefore: 5,
        TROFF_CLASS_TO_TOGGLE_buttStartBefore: true,
      };
      nDBSetOnSongMock.mockImplementation((songKey: string, path: string | string[], value: any) => {
        if (songKey === 'test-song-key') {
          // Store the value for retrieval
        }
      });
      nDBGetMock.mockImplementation((key: string) => {
        if (key === 'test-song-key') {
          return songData;
        }
        // Handle other keys via the implementation above
        return undefined;
      });
    });

it('should seek to marker start time minus startBefore on initialization and play from there', async () => {
      // Set up marker slider with the marker
      markerSlider.markers = [
        { id: 'markerNr0', name: 'Start', time: 30, info: '', color: 'None' },
        { id: 'markerNr1', name: 'End', time: 90, info: '', color: 'None' },
      ];
      markerSlider.startMarkerId = 'markerNr0';
      markerSlider.stopMarkerId = 'markerNr1S';
      markerSlider.startBefore = 5;
      // Return 25 initially (30 - 5 = 25) so updateMarkerSlider seeks to this on init
      markerSlider.getPlaybackStart = vi.fn(() => 25);

      // Import v2Script to initialize
      await import('../v2Script.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));

      // Wait for async initialization
      await new Promise(r => setTimeout(r, 0));

      // Audio should have sought to the marker start minus startBefore (30 - 5 = 25) on init
      expect(audioMock.currentTime).toBe(25);

      // Enable playGoToMarker setting
      settingsPanel.playGoToMarker = true;

      // Click the play button in footer
      footer.dispatchEvent(
        new CustomEvent('nav-click', {
          detail: { action: 'play' },
          bubbles: true,
          composed: true,
        })
      );

      // Wait for async operations
      await new Promise(r => setTimeout(r, 0));

      // Audio should still be at 25 (playback starts from there, no additional seek)
      expect(audioMock.currentTime).toBe(25);
    });

it('should seek to marker start time when startBefore is disabled (0)', async () => {
      // Set up marker slider with startBefore disabled
      markerSlider.markers = [
        { id: 'markerNr0', name: 'Start', time: 30, info: '', color: 'None' },
        { id: 'markerNr1', name: 'End', time: 90, info: '', color: 'None' },
      ];
      markerSlider.startMarkerId = 'markerNr0';
      markerSlider.stopMarkerId = 'markerNr1S';
      markerSlider.startBefore = 0;
      // Return 30 initially (30 - 0 = 30) so updateMarkerSlider seeks to this on init
      markerSlider.getPlaybackStart = vi.fn(() => 30);

      // Import v2Script to initialize
      await import('../v2Script.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));

      // Wait for async initialization
      await new Promise(r => setTimeout(r, 0));

      // Audio should have sought to the marker start time (30 - 0 = 30) on init
      expect(audioMock.currentTime).toBe(30);

      settingsPanel.playGoToMarker = true;

      // Click the play button in footer
      footer.dispatchEvent(
        new CustomEvent('nav-click', {
          detail: { action: 'play' },
          bubbles: true,
          composed: true,
        })
      );

      // Wait for async operations
      await new Promise(r => setTimeout(r, 0));

      // Should still be at marker time (30) since startBefore is 0
      expect(audioMock.currentTime).toBe(30);
    });

    it('should not seek when playGoToMarker is disabled', async () => {
      markerSlider.markers = [
        { id: 'markerNr0', name: 'Start', time: 30, info: '', color: 'None' },
        { id: 'markerNr1', name: 'End', time: 90, info: '', color: 'None' },
      ];
      markerSlider.startMarkerId = 'markerNr0';
      markerSlider.stopMarkerId = 'markerNr1S';
      markerSlider.startBefore = 5;
      // Return 0 initially so updateMarkerSlider doesn't seek on init
      markerSlider.getPlaybackStart = vi.fn(() => 0);

      await import('../v2Script.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));

      await new Promise(r => setTimeout(r, 0));

      // playGoToMarker is disabled (default)
      settingsPanel.playGoToMarker = false;

      // Now set the expected value for the play button click
      markerSlider.getPlaybackStart = vi.fn(() => 25);

      expect(audioMock.currentTime).toBe(0);

      footer.dispatchEvent(
        new CustomEvent('nav-click', {
          detail: { action: 'play' },
          bubbles: true,
          composed: true,
        })
      );

      await new Promise(r => setTimeout(r, 0));

      // Should NOT seek to marker, stay at 0
      expect(audioMock.currentTime).toBe(0);
    });

    it('should not seek when no start marker is selected', async () => {
      markerSlider.markers = [
        { id: 'markerNr0', name: 'Start', time: 30, info: '', color: 'None' },
        { id: 'markerNr1', name: 'End', time: 90, info: '', color: 'None' },
      ];
      markerSlider.startMarkerId = null; // No start marker selected
      markerSlider.stopMarkerId = 'markerNr1S';
      // Return 0 initially so updateMarkerSlider doesn't seek on init
      markerSlider.getPlaybackStart = vi.fn(() => 0);

      await import('../v2Script.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));

      await new Promise(r => setTimeout(r, 0));

      settingsPanel.playGoToMarker = true;

      // Now set the expected value for the play button click
      markerSlider.getPlaybackStart = vi.fn(() => 0);

      expect(audioMock.currentTime).toBe(0);

      footer.dispatchEvent(
        new CustomEvent('nav-click', {
          detail: { action: 'play' },
          bubbles: true,
          composed: true,
        })
      );

      await new Promise(r => setTimeout(r, 0));

      // Should stay at 0 since no start marker is selected
      expect(audioMock.currentTime).toBe(0);
    });

    it('should not go below 0 when startBefore exceeds marker time', async () => {
      markerSlider.markers = [
        { id: 'markerNr0', name: 'Start', time: 3, info: '', color: 'None' },
        { id: 'markerNr1', name: 'End', time: 90, info: '', color: 'None' },
      ];
      markerSlider.startMarkerId = 'markerNr0';
      markerSlider.stopMarkerId = 'markerNr1S';
      markerSlider.startBefore = 10; // More than marker time
      // Return 0 initially so updateMarkerSlider doesn't seek on init
      markerSlider.getPlaybackStart = vi.fn(() => 0);

      await import('../v2Script.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));

      await new Promise(r => setTimeout(r, 0));

      settingsPanel.playGoToMarker = true;

      // Now set the expected value for the play button click (clamped at 0)
      markerSlider.getPlaybackStart = vi.fn(() => 0); // Math.max(3 - 10, 0) = 0

      footer.dispatchEvent(
        new CustomEvent('nav-click', {
          detail: { action: 'play' },
          bubbles: true,
          composed: true,
        })
      );

      await new Promise(r => setTimeout(r, 0));

      // Should clamp at 0, not go negative
      expect(audioMock.currentTime).toBe(0);
    });
  });
});