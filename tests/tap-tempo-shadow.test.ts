import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Regression tests for tap-tempo sync into the SETTINGS PANEL's SHADOW DOM.
 *
 * Real bug (v2Script.ts ~line 1121, `syncCurrentSongControlsValues()`):
 *  - `document.querySelector('#settingsCurrentSongControls')` is used to push
 *    tempo (and pauseBefore/waitBetween/volume/speed/disable*) into the
 *    settings panel's internal controls.
 *  - But `#settingsCurrentSongControls` is a <t-current-song-controls> rendered
 *    INSIDE the <t-settings-panel> component's shadow root (see
 *    components/molecule/t-settings-panel.ts line 558-571; the class extends
 *    LitElement without a createRenderRoot override, so it uses shadow DOM).
 *  - `document.querySelector(...)` does NOT pierce shadow roots → the lookup is
 *    ALWAYS null → the panel's internal controls never receive `tempo` (it has
 *    no template binding either; the other props are synced via host-property
 *    template bindings).
 *  - On mobile the sidebar `#currentSongControls` is hidden and the settings
 *    panel is the visible control surface, so the user sees: tempo never updates
 *    when switching songs (stays on the last tapped value) and resets to "--"
 *    after reload.
 *
 * This suite exercises the REAL components (t-settings-panel + its shadow DOM
 * t-current-song-controls + the inner tap t-butt) instead of the light-DOM
 * <div> scaffold used by tests/tap-tempo-persistence.test.ts.
 */
describe('tap-tempo shadow DOM sync in v2Script', () => {
  // Local nDB store backing the mocked nDB module.
  const nDBStore: Record<string, any> = {};

  // Mutable current-song key the getCurrentSongKey mock closes over, so a test
  // can simulate a song change by flipping it (defaults to 'song-1').
  let currentSongKey = 'song-1';

  /** Plain stub elements v2Script's DOMContentLoaded setup requires. */
  const createStubDom = (): { songList: HTMLElement } => {
    const header = document.createElement('div');
    header.id = 'header';
    document.body.appendChild(header);

    const songList = document.createElement('div');
    songList.id = 'songList';
    document.body.appendChild(songList);

    const footer = document.createElement('div');
    footer.id = 'footer';
    document.body.appendChild(footer);

    const markerSlider = document.createElement('div');
    markerSlider.id = 'markerSlider';
    (markerSlider as any).getPlaybackStart = vi.fn(() => 0);
    document.body.appendChild(markerSlider);

    return { songList };
  };

  /**
   * REAL custom elements, created AFTER v2Script is imported (the import
   * registers every component, see v2Script.ts lines 1-14).
   */
  const createRealComponents = (): {
    settingsPanel: any;
    currentSongControls: any;
  } => {
    const settingsPanel = document.createElement('t-settings-panel') as any;
    settingsPanel.id = 'settingsPanel';
    document.body.appendChild(settingsPanel);

    const currentSongControls = document.createElement('t-current-song-controls') as any;
    currentSongControls.id = 'currentSongControls';
    document.body.appendChild(currentSongControls);

    return { settingsPanel, currentSongControls };
  };

  /** The <t-current-song-controls> living inside the settings panel's shadow root. */
  const getInternalControls = (settingsPanel: any): any => {
    return settingsPanel.shadowRoot?.querySelector('#settingsCurrentSongControls') ?? null;
  };

  /** Find the "Tap tempo" <t-butt> inside a t-current-song-controls' shadow root. */
  const findTapTempoButton = (controls: { shadowRoot: ShadowRoot | null }): HTMLElement | null => {
    const buttons = controls.shadowRoot?.querySelectorAll('t-butt');
    if (!buttons) {
      return null;
    }
    for (const button of Array.from(buttons)) {
      const text = (button.textContent ?? '').trim().toLowerCase();
      if (text.includes('tap tempo')) {
        return button as HTMLElement;
      }
    }
    return null;
  };

  /**
   * Tap the tempo button 3 times, advancing the fake clock after every click
   * (same click-then-advance pattern as
   * components/molecule/t-current-song-controls.test.ts lines 67-98).
   *
   * Taps land at t=0, t=500, t=500+secondIntervalMs:
   *  - secondIntervalMs=500 -> taps at 0/500/1000 -> 2*60/1.0 = 120 bpm
   *  - secondIntervalMs=750 -> taps at 0/500/1250 -> 2*60/1.25 = 96 bpm
   */
  const tapTempo = (tapButton: HTMLElement, secondIntervalMs: number) => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    tapButton.click(); // t=0   - first tap (resets, no tempo yet)
    vi.advanceTimersByTime(500);
    tapButton.click(); // t=500
    vi.advanceTimersByTime(secondIntervalMs);
    tapButton.click(); // t=500+secondIntervalMs

    vi.useRealTimers();
  };

  const mockModules = () => {
    vi.doMock('../utils/current-song.js', () => ({
      updateHeaderWithCurrentSong: vi.fn(),
      setCurrentSong: vi.fn(),
      getCurrentSongMetadata: vi.fn(() => ({ duration: 120 })),
      getCurrentSongKey: vi.fn(() => currentSongKey),
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
    currentSongKey = 'song-1';
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

  describe('boot load: saved tempo reaches the settings panel shadow DOM', () => {
    it('syncs TROFF_VALUE_tapTempo=96 into the settings panel internal controls', async () => {
      createStubDom();
      nDBStore['song-1'] = { markers: [], TROFF_VALUE_tapTempo: 96 };
      mockModules();

      await import('../v2Script.js');
      const { settingsPanel, currentSongControls } = createRealComponents();
      document.dispatchEvent(new Event('DOMContentLoaded'));

      // Let the settings panel render its shadow content (which contains the
      // internal <t-current-song-controls id="settingsCurrentSongControls">).
      await settingsPanel.updateComplete;

      const internalControls = getInternalControls(settingsPanel);
      expect(internalControls).toBeTruthy();

      // The panel's internal controls must show the saved tempo. This is the
      // real bug: document.querySelector() cannot pierce the shadow root, so
      // syncCurrentSongControlsValues() never finds this element -> tempo stays 0.
      expect(internalControls.tempo).toBe(96);

      // Sidebar control (light DOM) is synced directly and does get the value —
      // proves the sidebar works while the settings panel does not.
      expect(currentSongControls.tempo).toBe(96);
    }, 30000);
  });

  describe('save path: real tap inside the settings panel shadow DOM', () => {
    it('persists the tapped tempo to the current song in nDB', async () => {
      createStubDom();
      nDBStore['song-1'] = { markers: [] };
      mockModules();

      await import('../v2Script.js');
      const { settingsPanel } = createRealComponents();
      document.dispatchEvent(new Event('DOMContentLoaded'));

      await settingsPanel.updateComplete;

      const internalControls = getInternalControls(settingsPanel);
      expect(internalControls).toBeTruthy();
      await internalControls.updateComplete;

      const tapButton = findTapTempoButton(internalControls);
      expect(tapButton).toBeTruthy();

      // 3 taps at 0ms / 500ms / 1000ms -> 120 bpm (same pattern as
      // components/molecule/t-current-song-controls.test.ts lines 67-98).
      tapTempo(tapButton!, 500);

      // The save forwarding through the settings panel @setting-changed binding
      // works: the panel re-dispatches the internal control's event and v2Script
      // writes TROFF_VALUE_tapTempo to the current song.
      expect(nDBStore['song-1'].TROFF_VALUE_tapTempo).toBe(120);
    }, 30000);
  });

  describe('song change sync into the settings panel shadow DOM', () => {
    it('resets the panel internal tempo when switching to a song without tempo', async () => {
      const { songList } = createStubDom();
      nDBStore['song-1'] = { markers: [], TROFF_VALUE_tapTempo: 96 };
      nDBStore['song-2'] = { markers: [] };
      mockModules();

      await import('../v2Script.js');
      const { settingsPanel, currentSongControls } = createRealComponents();
      document.dispatchEvent(new Event('DOMContentLoaded'));

      await settingsPanel.updateComplete;

      const internalControls = getInternalControls(settingsPanel);
      expect(internalControls).toBeTruthy();
      await internalControls.updateComplete;

      // Repro setup: the user taps tempo on the settings panel (mobile surface).
      // Taps at 0ms / 500ms / 1250ms -> 2*60/1.25 = 96 bpm, so the panel now
      // shows the same 96 bpm that song-1 has stored. The self-update inside the
      // component works (the tap handler lives in t-current-song-controls).
      const tapButton = findTapTempoButton(internalControls);
      expect(tapButton).toBeTruthy();
      tapTempo(tapButton!, 750);
      expect(internalControls.tempo).toBe(96);

      // Switch to song-2 (no tempo stored) via the app's own song-change path.
      currentSongKey = 'song-2';
      songList.dispatchEvent(
        new CustomEvent('media-selected', {
          detail: { songKey: 'song-2' },
          bubbles: true,
          composed: true,
        })
      );

      // Sidebar (light DOM) resets to 0 — the direct property sync works.
      expect(currentSongControls.tempo).toBe(0);

      // The settings panel internal controls must reset to 0 as well. This is
      // the real bug: syncCurrentSongControlsValues() cannot find
      // #settingsCurrentSongControls through the shadow root, so the panel keeps
      // showing the last tapped value (stays 96).
      expect(internalControls.tempo).toBe(0);
    }, 30000);
  });
});
