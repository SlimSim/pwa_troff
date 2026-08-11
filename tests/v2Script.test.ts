import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDuration } from '../utils/formatters.js';
import * as constants from '../constants/constants.js';

// Shared holder so the hoisted firebaseClient mock can capture the
// onAuthStateChanged callback for tests that trigger the sign-in flow.
const authState = vi.hoisted(() => ({
  onAuthCb: null as ((user: unknown) => void) | null,
  authSpy: null as ReturnType<typeof vi.fn> | null,
}));

vi.mock('../services/firebaseClient.js', () => ({
  auth: {},
  onAuthStateChanged: (auth: unknown, cb: (user: unknown) => void) => {
    authState.onAuthCb = cb;
    if (authState.authSpy) authState.authSpy(cb);
    return () => {};
  },
}));

describe('v2Script utilities and related functions', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    // Make requestAnimationFrame fire synchronously in tests.
    // Happy-dom doesn't implement rAF, so the auto-open code
    // (which uses rAF to defer the expand until after first paint)
    // would never execute without this mock.
    const raf = (cb: Function) => { cb(); return 0; };
    vi.stubGlobal('requestAnimationFrame', raf);
    window.requestAnimationFrame = raf;
    // Silence duplicate custom element definitions that happen when
    // multiple tests import v2Script.js (which registers components).
    // Without this guard, the second import throws:
    //   "the name "t-butt" has already been used with this registry"
    const registry = customElements;
    const originalDefine = registry.define.bind(registry);
    const patched = Object.create(registry);
    patched.define = (name: string, constructor: CustomElementConstructor, options?: ElementDefinitionOptions) => {
      if (!registry.get(name)) {
        originalDefine(name, constructor, options);
      }
    };
    vi.stubGlobal('customElements', patched);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  describe('formatDuration (actual implementation)', () => {
    it('should format zero seconds as 0:00', () => {
      expect(formatDuration(0)).toBe('0:00');
    });

    it('should format negative seconds as 0:00', () => {
      expect(formatDuration(-10)).toBe('0:00');
    });

    it('should format null/undefined as 0:00', () => {
      expect(formatDuration(null as unknown as number)).toBe('0:00');
      expect(formatDuration(undefined as unknown as number)).toBe('0:00');
    });

    it('should format seconds less than a minute', () => {
      expect(formatDuration(30)).toBe('0:30');
      expect(formatDuration(59)).toBe('0:59');
    });

    it('should format exact minutes', () => {
      expect(formatDuration(60)).toBe('1:00');
      expect(formatDuration(120)).toBe('2:00');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(90)).toBe('1:30');
      expect(formatDuration(125)).toBe('2:05');
      expect(formatDuration(3661)).toBe('61:01');
    });

    it('should round down seconds', () => {
      expect(formatDuration(30.9)).toBe('0:30');
      expect(formatDuration(60.7)).toBe('1:00');
    });
  });

  describe('TROFF constants (actual implementation)', () => {
    it('should have required TROFF setting constants defined', () => {
      expect(constants.TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR).toBeDefined();
      expect(constants.TROFF_SETTING_ENTER_RESET_COUNTER).toBeDefined();
      expect(constants.TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR).toBeDefined();
      expect(constants.TROFF_SETTING_SPACE_RESET_COUNTER).toBeDefined();
      expect(constants.TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR).toBeDefined();
      expect(constants.TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER).toBeDefined();
    });

    it('should have go to marker setting constants defined', () => {
      expect(constants.TROFF_SETTING_ENTER_GO_TO_MARKER_BEHAVIOUR).toBeDefined();
      expect(constants.TROFF_SETTING_SPACE_GO_TO_MARKER_BEHAVIOUR).toBeDefined();
      expect(constants.TROFF_SETTING_PLAY_UI_BUTTON_GO_TO_MARKER_BEHAVIOUR).toBeDefined();
    });

    it('should have correct constant string values', () => {
      expect(constants.TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR).toBe(
        'TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR'
      );
      expect(constants.TROFF_SETTING_SPACE_RESET_COUNTER).toBe('TROFF_SETTING_SPACE_RESET_COUNTER');
    });
  });

  describe('auto-open on app load when no song selected', () => {
    it('expands the header and opens the song list when no current song and no hash', async () => {
      // Create the DOM elements v2Script queries on DOMContentLoaded
      const header = document.createElement('div');
      header.id = 'header';
      document.body.appendChild(header);

      const songList = document.createElement('div');
      songList.id = 'songList';
      document.body.appendChild(songList);

      const footer = document.createElement('div');
      footer.id = 'footer';
      document.body.appendChild(footer);

      const settingsPanel = document.createElement('div');
      settingsPanel.id = 'settingsPanel';
      document.body.appendChild(settingsPanel);

      const markerSlider = document.createElement('div');
      markerSlider.id = 'markerSlider';
      (markerSlider as any).getPlaybackStart = vi.fn(() => 0);
      document.body.appendChild(markerSlider);

      // Mock current-song to return null (no current song selected)
      vi.doMock('../utils/current-song.js', () => ({
        updateHeaderWithCurrentSong: vi.fn(),
        setCurrentSong: vi.fn(),
        getCurrentSongMetadata: vi.fn(() => ({ duration: 120 })),
        getCurrentSongKey: vi.fn(() => null),
        updateFooterWithCurrentSong: vi.fn(),
      }));

      vi.doMock('../assets/internal/db.js', () => ({
        nDB: {
          get: vi.fn(() => null),
          set: vi.fn(),
          setOnSong: vi.fn(),
        },
      }));

      vi.doMock('../services/audio.js', () => ({
        audio: {
          currentTime: 0,
          duration: 120,
          playbackRate: 1,
          volume: 1,
          paused: true,
          addEventListener: vi.fn(),
        },
        loadSong: vi.fn(),
      }));

      // Ensure no URL hash
      window.location.hash = '';

      await import('../v2Script.js');

      document.dispatchEvent(new Event('DOMContentLoaded'));

      // rAF fires synchronously in tests, so the condition is met immediately
      expect((header as any).expanded).toBe(true);

      // The event handler sets songList.visible when header-expand fires
      expect((songList as any).visible).toBe(true);
    }, 30000);
  });

  describe('marker dialog defaults integration', () => {
    it('sets marker dialog initial time and suggested name on marker-dialog-opened', async () => {
      const footer = document.createElement('div');
      footer.id = 'footer';
      document.body.appendChild(footer);

      vi.doMock('../utils/current-song.js', () => ({
        updateHeaderWithCurrentSong: vi.fn(),
        setCurrentSong: vi.fn(),
        getCurrentSongMetadata: vi.fn(() => ({ duration: 120 })),
        getCurrentSongKey: vi.fn(() => 'song-1'),
        updateFooterWithCurrentSong: vi.fn(),
      }));

      vi.doMock('../assets/internal/db.js', () => ({
        nDB: {
          get: vi.fn(() => ({ markers: [{ id: 'm1' }, { id: 'm2' }] })),
          set: vi.fn(),
          setOnSong: vi.fn(),
        },
      }));

      vi.doMock('../services/audio.js', () => ({
        audio: {
          currentTime: 37,
          duration: 120,
          playbackRate: 1,
          volume: 1,
          addEventListener: vi.fn(),
        },
        loadSong: vi.fn(),
      }));

      await import('../v2Script.js');

      document.dispatchEvent(new Event('DOMContentLoaded'));
      footer.dispatchEvent(
        new CustomEvent('marker-dialog-opened', {
          bubbles: true,
          composed: true,
        })
      );

      expect(
        (footer as HTMLElement & { markerDialogInitialTime?: number }).markerDialogInitialTime
      ).toBe(37);
      expect(
        (footer as HTMLElement & { markerDialogSuggestedName?: string }).markerDialogSuggestedName
      ).toBe('marker nr 3');
    }, 30000);
  });

  describe('boot-time sync refreshes the already-loaded song', () => {
    it('re-renders synced markers after Firebase sync completes (no re-select needed)', async () => {
      const header = document.createElement('div');
      header.id = 'header';
      document.body.appendChild(header);

      const footer = document.createElement('div');
      footer.id = 'footer';
      document.body.appendChild(footer);

      const settingsPanel = document.createElement('div');
      settingsPanel.id = 'settingsPanel';
      document.body.appendChild(settingsPanel);

      // markerSlider with the property the live-update path writes to
      const markerSlider = document.createElement('div');
      markerSlider.id = 'markerSlider';
      (markerSlider as any).markers = [];
      (markerSlider as any).getPlaybackStart = vi.fn(() => 0);
      (markerSlider as any).getPlaybackStop = vi.fn(() => 10);
      (markerSlider as any).addEventListener = vi.fn();
      document.body.appendChild(markerSlider);

      const audioEl = {
        currentTime: 0,
        duration: 120,
        playbackRate: 1,
        volume: 1,
        paused: true,
        load: vi.fn(),
        addEventListener: vi.fn(),
      };
      vi.doMock('../services/audio.js', () => ({
        audio: audioEl,
        loadSong: vi.fn(() => Promise.resolve({ url: 'track.mp3', isVideo: false })),
      }));

      // A current song is already restored from localStorage at boot
      vi.doMock('../utils/current-song.js', () => ({
        updateHeaderWithCurrentSong: vi.fn(),
        updateFooterWithCurrentSong: vi.fn(),
        getCurrentSongMetadata: vi.fn(() => ({ duration: 120 })),
        getCurrentSongKey: vi.fn(() => 'track.mp3'),
        setCurrentSong: vi.fn(),
      }));

      // nDB starts with a STALE song (no markers yet). The Firebase sync pulls
      // the server's markers into nDB only when the auth flow runs — exactly
      // the race that left the open song stale before the fix.
      const nDBData: Record<string, unknown> = {
        'track.mp3': {
          // stale: markers absent; a local timestamp older than the server's
          latestUploadToFirebase: 1,
          fileData: { duration: 120 },
        },
      };
      const nDBMock = {
        get: vi.fn((key: string) =>
          key === 'stroCurrentSongPathAndGalleryId'
            ? { strPath: 'track.mp3' }
            : nDBData[key]
        ),
        set: vi.fn((key: string, val: unknown) => {
          if (key) nDBData[key] = val;
        }),
        setOnSong: vi.fn(),
      };
      vi.doMock('../assets/internal/db.js', () => ({ nDB: nDBMock }));

      // syncFirebaseGroups pulls the server markers into nDB on sign-in
      vi.doMock('../utils/firebase-sync.js', () => ({
        syncFirebaseGroups: vi.fn(async () => {
          nDBData['track.mp3'] = {
            markers: [{ id: 'synced-marker', time: 5 }],
            latestUploadToFirebase: 100,
            fileData: { duration: 120 },
          };
        }),
      }));

      // Trigger sign-in via the hoisted firebaseClient mock; the boot flow's
      // post-sync refresh must re-render the already-open song.
      authState.onAuthCb = null;
      // The boot auth-flow side-effect-imports a legacy notify module that calls
      // jQuery (`$.notify.defaults`) at module load, which is undefined here.
      vi.doMock('../assets/internal/notify-js/notify.config.js', () => ({}));

      vi.doMock('../utils/firebase-realtime.js', () => ({
        setupListeners: vi.fn(() => Promise.resolve()),
        setupGroupSongListeners: vi.fn(() => Promise.resolve()),
        teardownListeners: vi.fn(),
        saveSongData: vi.fn(() => Promise.resolve()),
        setLiveUpdateCallback: vi.fn(() => Promise.resolve()),
        setGroupUpdateCallback: vi.fn(),
      }));

      window.location.hash = '';
      await import('../v2Script.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));

      // Let the boot auth-flow's dynamic import resolve so onAuthStateChanged
      // is registered before we trigger sign-in.
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Trigger sign-in; the post-sync refresh must re-render the open song.
      const cb = authState.onAuthCb;
      if (cb) (cb as (user: unknown) => void)({ email: 'test@example.com' });
      await new Promise((resolve) => setTimeout(resolve, 30));

      // The marker slider must show the synced markers even though the song was
      // already loaded at boot (without requiring a manual re-selection).
      expect((markerSlider as any).markers).toEqual([{ id: 'synced-marker', time: 5 }]);
    }, 30000);
  });
});
