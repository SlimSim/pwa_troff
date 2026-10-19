import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Feature spec — option D: early t-loading import on v2 boot splash.
 *
 * NOTE (redirect-shim architecture): v2.html is now ONLY a minimal redirect
 * shim (see tests/v2-redirect-shim.test.ts as source of truth) and must NOT
 * contain #loadScreen, <t-loading>, or /v2Script.js. index.html IS the live
 * v2 app now, so all boot-splash markup assertions below read index.html.
 *
 * Current state of index.html (live v2 app):
 *   - #loadScreen exists with branding and a LIVE <t-loading> spinner.
 *   - No inlined spoon SVG copy; no .loadParent / @keyframes spoon-tilt
 *     (they live in t-loading's shadow CSS).
 *   - An early module import of t-loading occurs BEFORE src="/v2Script.js".
 *   - v2Script.ts removes #loadScreen after its DOMContentLoaded init
 *     (null-safe) and imports ./components/atom/t-loading.js.
 *   - Branding text ("Troff"/"loading") present inside #loadScreen.
 *
 * Harness mirrors tests/v2Script-volume-speed-boot.test.ts: DOM skeleton for
 * the ids v2Script queries, duplicate custom-element define guard, rAF stub,
 * and Firebase/nDB/audio/current-song mocks — Firebase and nDB are never real.
 * HTML content is asserted by reading index.html directly, the same pattern as
 * tests/es-module-shims-guard.test.ts.
 */

const ROOT = join(__dirname, '..');

/** Raw contents of v2.html (redirect shim — must stay splash-free). */
function readV2HtmlRaw(): string {
  return readFileSync(join(ROOT, 'v2.html'), 'utf-8');
}

/** Raw contents of index.html (the live v2 app with the boot splash). */
function readAppHtmlRaw(): string {
  return readFileSync(join(ROOT, 'index.html'), 'utf-8');
}

/** Parse the <body> content of index.html into a detached container. */
function readV2HtmlBody(): HTMLElement {
  const html = readAppHtmlRaw();
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const wrapper = document.createElement('div');
  wrapper.innerHTML = match ? match[1] : '';
  return wrapper;
}

describe('v2 boot splash (loadScreen + t-loading)', () => {
  // -------------------------------------------------------------------------
  // Static content checks on index.html (the live v2 app)
  // -------------------------------------------------------------------------
  describe('index.html boot splash markup', () => {
    it('contains #loadScreen as a direct child of <body>', () => {
      const body = readV2HtmlBody();
      const loadScreen = body.querySelector('#loadScreen');
      expect(
        loadScreen,
        'index.html is missing <div id="loadScreen"> inside <body>'
      ).not.toBeNull();
      expect(loadScreen?.parentElement).toBe(body);
    });

    it('contains a live <t-loading> element inside #loadScreen', () => {
      const loadScreen = readV2HtmlBody().querySelector('#loadScreen');
      expect(
        loadScreen,
        'index.html is missing <div id="loadScreen"> inside <body>'
      ).not.toBeNull();
      // A commented-out <!-- <t-loading> --> parses as a comment node, so
      // querySelector correctly returns null for the old state.
      expect(
        loadScreen?.querySelector('t-loading'),
        '#loadScreen must contain a live <t-loading> spinner (not commented out)'
      ).not.toBeNull();
    });

    it('has no inlined spoon SVG copy inside #loadScreen', () => {
      const loadScreen = readV2HtmlBody().querySelector('#loadScreen');
      expect(
        loadScreen,
        'index.html is missing <div id="loadScreen"> inside <body>'
      ).not.toBeNull();
      expect(
        loadScreen?.querySelector('svg'),
        '#loadScreen must not contain an inlined <svg> — use <t-loading> instead'
      ).toBeNull();
    });

    it('does not keep the duplicated spinner CSS (.loadParent / spoon keyframes) in index.html', () => {
      const html = readAppHtmlRaw();
      expect(
        html.includes('.loadParent'),
        'index.html must not contain the duplicated .loadParent spinner CSS'
      ).toBe(false);
      expect(
        html.includes('@keyframes spoon-tilt'),
        'index.html must not contain @keyframes spoon-tilt (lives in t-loading shadow CSS)'
      ).toBe(false);
    });

    it('imports t-loading in an early module script before /v2Script.js', () => {
      const html = readAppHtmlRaw();
      const v2ScriptIdx = html.indexOf('src="/v2Script.js"');
      expect(
        v2ScriptIdx,
        'index.html is missing <script src="/v2Script.js">'
      ).toBeGreaterThan(-1);

      const earlyImport = html.match(
        /<script[^>]*type="module"[^>]*>[\s\S]*?t-loading[\s\S]*?<\/script>/
      );
      expect(
        earlyImport,
        'index.html needs an early <script type="module"> importing t-loading before the main bundle'
      ).not.toBeNull();
      expect(
        earlyImport!.index!,
        'the t-loading module import must come BEFORE src="/v2Script.js"'
      ).toBeLessThan(v2ScriptIdx);
    });

    it('contains branding text "Troff" or "loading" inside #loadScreen', () => {
      const loadScreen = readV2HtmlBody().querySelector('#loadScreen');
      expect(
        loadScreen,
        'index.html is missing <div id="loadScreen"> inside <body>'
      ).not.toBeNull();
      expect(loadScreen?.textContent ?? '').toMatch(/troff|loading/i);
    });
  });

  // -------------------------------------------------------------------------
  // v2.html is a redirect shim — asserts NO boot splash here.
  // Source of truth: tests/v2-redirect-shim.test.ts.
  // -------------------------------------------------------------------------
  describe('v2.html redirect shim has no boot splash', () => {
    it('contains no #loadScreen or <t-loading> (lives in index.html now)', () => {
      const html = readV2HtmlRaw();
      expect(
        html,
        'v2.html shim must NOT contain #loadScreen (see tests/v2-redirect-shim.test.ts)'
      ).not.toContain('loadScreen');
      expect(
        html,
        'v2.html shim must NOT contain <t-loading> (see tests/v2-redirect-shim.test.ts)'
      ).not.toContain('t-loading');
    });

    it('loads no /v2Script.js (lives in index.html now)', () => {
      const html = readV2HtmlRaw();
      expect(
        html,
        'v2.html shim must NOT load v2Script.js (see tests/v2-redirect-shim.test.ts)'
      ).not.toContain('v2Script.js');
    });
  });

  // -------------------------------------------------------------------------
  // Runtime behavior of v2Script on DOMContentLoaded
  // -------------------------------------------------------------------------
  describe('v2Script boot splash behavior', () => {
    beforeEach(() => {
      vi.resetModules();
      document.body.innerHTML = '';

      // Make requestAnimationFrame fire synchronously (happy-dom has no rAF),
      // otherwise the auto-open code would never execute in tests.
      const raf = (cb: Function) => {
        cb();
        return 0;
      };
      vi.stubGlobal('requestAnimationFrame', raf);
      window.requestAnimationFrame = raf;

      // Silence duplicate custom element definitions that happen when multiple
      // tests import v2Script.js (which registers components).
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

      // ---- module mocks (registered before importing v2Script.js) ----

      vi.doMock('../services/firebaseClient.js', () => ({
        auth: {},
        onAuthStateChanged: () => () => {},
      }));

      // The auth flow side-effect-imports this legacy notify module that calls
      // jQuery ($.notify.defaults) at module load, which is undefined here.
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

      window.location.hash = '';
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      document.body.innerHTML = '';
    });

    /** Build the DOM skeleton v2Script queries on DOMContentLoaded. */
    function buildDom(): void {
      const header = document.createElement('div');
      header.id = 'header';
      document.body.appendChild(header);

      const footer = document.createElement('div');
      footer.id = 'footer';
      document.body.appendChild(footer);

      const settingsPanel = document.createElement('div');
      settingsPanel.id = 'settingsPanel';
      document.body.appendChild(settingsPanel);

      const songList = document.createElement('div');
      songList.id = 'songList';
      document.body.appendChild(songList);

      const markerSlider = document.createElement('div') as HTMLElement & {
        getPlaybackStart?: () => number;
      };
      markerSlider.id = 'markerSlider';
      markerSlider.getPlaybackStart = vi.fn(() => 0);
      document.body.appendChild(markerSlider);
    }

    it('removes #loadScreen after the DOMContentLoaded init', async () => {
      buildDom();
      const loadScreen = document.createElement('div');
      loadScreen.id = 'loadScreen';
      document.body.appendChild(loadScreen);

      await import('../v2Script.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));

      expect(
        document.getElementById('loadScreen'),
        '#loadScreen must be removed once the app finished initialising'
      ).toBeNull();
    }, 30000);

    it('does not throw on DOMContentLoaded when #loadScreen is absent (null-safe)', async () => {
      buildDom();
      await import('../v2Script.js');

      expect(() => {
        document.dispatchEvent(new Event('DOMContentLoaded'));
      }).not.toThrow();
    }, 30000);

    it('registers the t-loading custom element after importing v2Script', async () => {
      await import('../v2Script.js');

      expect(
        customElements.get('t-loading'),
        'v2Script must import ./components/atom/t-loading.js so <t-loading> registers'
      ).toBeTruthy();
    }, 30000);
  });
});
