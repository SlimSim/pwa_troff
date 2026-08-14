import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Regression tests for tap-tempo persistence in v2Script.
 *
 * Bug: tapping tempo shows the BPM but it is NOT persisted per-song:
 *  - switching songs keeps showing the same tempo
 *  - reloading resets the display to "--" (tempo 0)
 *
 * What the code SHOULD do (v2Script.ts):
 *  - `settingsPanel` 'setting-changed' handler with `setting === 'tempo'`
 *    writes `currentSongData.TROFF_VALUE_tapTempo = value` and calls
 *    `nDB.set(songKey, currentSongData)` (line ~1491).
 *  - `syncCurrentSongControlsValues()` reads
 *    `parseStoredNumber(songData.TROFF_VALUE_tapTempo, 0)` into
 *    `currentSongControls.tempo` during boot (line ~1090).
 */
describe('tap-tempo persistence in v2Script', () => {
  // Local nDB store backing the mocked nDB module.
  const nDBStore: Record<string, any> = {};

  const createDom = (withCurrentSongControls: boolean): HTMLElement | null => {
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

    if (withCurrentSongControls) {
      const currentSongControls = document.createElement('div');
      currentSongControls.id = 'currentSongControls';
      document.body.appendChild(currentSongControls);
      return currentSongControls;
    }
    return null;
  };

  const mockModules = () => {
    vi.doMock('../utils/current-song.js', () => ({
      updateHeaderWithCurrentSong: vi.fn(),
      setCurrentSong: vi.fn(),
      getCurrentSongMetadata: vi.fn(() => ({ duration: 120 })),
      getCurrentSongKey: vi.fn(() => 'song-1'),
      updateFooterWithCurrentSong: vi.fn(),
    }));

    vi.doMock('../assets/internal/db.js', () => ({
      nDB: {
        get: vi.fn((key: string) => nDBStore[key] ?? null),
        set: vi.fn((key: string, value: unknown) => {
          nDBStore[key] = value;
        }),
        setOnSong: vi.fn((key: string, path: string | string[], value: unknown) => {
          const songData = nDBStore[key] ?? {};
          if (Array.isArray(path)) {
            let target: any = songData;
            for (let i = 0; i < path.length - 1; i++) {
              if (!target[path[i]]) target[path[i]] = {};
              target = target[path[i]];
            }
            target[path[path.length - 1]] = value;
          } else {
            songData[path] = value;
          }
          nDBStore[key] = songData;
        }),
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

    // firebaseClient is dynamically imported by v2Script's auth IIFE and by
    // saveSongData(). It imports Firebase CDN URLs, so mock it to keep the
    // tests offline and deterministic.
    vi.doMock('../services/firebaseClient.js', () => ({
      db: {},
      doc: vi.fn(),
      setDoc: vi.fn(),
      getDoc: vi.fn(),
      onSnapshot: vi.fn(),
    }));
  };

  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    Object.keys(nDBStore).forEach((key) => delete nDBStore[key]);
    window.location.hash = '';

    // Make requestAnimationFrame fire synchronously in tests (happy-dom does
    // not implement rAF, so the auto-open code would never run without this).
    const raf = (cb: Function) => {
      cb();
      return 0;
    };
    vi.stubGlobal('requestAnimationFrame', raf);
    window.requestAnimationFrame = raf;

    // Silence duplicate custom element definitions that happen when multiple
    // tests import v2Script.js (which registers components). Without this
    // guard, the second import throws:
    //   "the name "t-butt" has already been used with this registry"
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  describe('save path', () => {
    it('persists the tapped tempo to the current song in nDB via setting-changed', async () => {
      createDom(false);
      nDBStore['song-1'] = { markers: [] };
      // A second song must stay untouched: the save must be per-song, not global.
      nDBStore['song-2'] = { markers: [] };
      mockModules();

      await import('../v2Script.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));

      const settingsPanel = document.getElementById('settingsPanel') as HTMLElement;
      settingsPanel.dispatchEvent(
        new CustomEvent('setting-changed', {
          detail: { setting: 'tempo', value: 120 },
          bubbles: true,
          composed: true,
        })
      );

      expect(nDBStore['song-1'].TROFF_VALUE_tapTempo).toBe(120);
      // Per-song persistence: the tempo must NOT leak onto other songs.
      expect(nDBStore['song-2'].TROFF_VALUE_tapTempo).toBeUndefined();
    }, 30000);
  });

  describe('load path', () => {
    it('loads the song-specific saved tempo into currentSongControls during boot', async () => {
      createDom(false);
      // createDom creates a plain stub <div id="settingsPanel"> for the save
      // path test; remove it here so only the REAL <t-settings-panel> below
      // exists when DOMContentLoaded fires (getElementById returns the first
      // matching element).
      document.getElementById('settingsPanel')?.remove();

      nDBStore['song-1'] = { markers: [], TROFF_VALUE_tapTempo: 96 };
      mockModules();

      // Importing v2Script registers every component module (see v2Script.ts
      // lines 1-14), so the real custom elements below are defined.
      await import('../v2Script.js');

      // REAL settings-panel element. Its internal
      // <t-current-song-controls id="settingsCurrentSongControls"> lives in the
      // panel's SHADOW ROOT (components/molecule/t-settings-panel.ts lines
      // 558-571), so the plain light-DOM <div> fixture could never receive the
      // tempo through syncCurrentSongControlsValues().
      const settingsPanel = document.createElement('t-settings-panel') as any;
      settingsPanel.id = 'settingsPanel';
      document.body.appendChild(settingsPanel);

      // REAL sidebar element (light DOM) — receives the direct property push.
      const currentSongControls = document.createElement('t-current-song-controls') as any;
      currentSongControls.id = 'currentSongControls';
      document.body.appendChild(currentSongControls);

      document.dispatchEvent(new Event('DOMContentLoaded'));

      // Let the settings panel render its shadow content (which contains the
      // internal <t-current-song-controls id="settingsCurrentSongControls">).
      await (settingsPanel as any).updateComplete;

      // syncCurrentSongControlsValues() runs during boot and should read the
      // song's TROFF_VALUE_tapTempo into currentSongControls.tempo.
      expect((currentSongControls as any).tempo).toBe(96);
      // The settings panel's internal instance receives the same value through
      // the shadow-root push (v2Script.ts line 1121-1122) AND the host-property
      // push + .tempo=${this.tempo} template binding (v2Script.ts line 1143,
      // t-settings-panel.ts line 570).
      expect(
        (settingsPanel.shadowRoot?.querySelector('#settingsCurrentSongControls') as any)?.tempo
      ).toBe(96);
    }, 30000);
  });
});
