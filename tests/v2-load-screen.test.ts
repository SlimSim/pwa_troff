import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Feature spec — option D: early t-loading import on v2 boot splash.
 *
 * Current state of v2.html (pre-implementation):
 *   - #loadScreen exists with branding, but the spinner is an inlined copy
 *     of t-loading's SVG+CSS (~lines 235-549); <t-loading> is commented out.
 *   - The spoon keyframes / .loadParent duplicate CSS lives in
 *     #loadScreenStyle, and #loadScreen contains an <svg> descendant.
 *   - There is no early module import of t-loading before /v2Script.js.
 *   - v2Script.ts has `// document.getElementById('loadScreen')?.remove();`
 *     commented out, so #loadScreen survives DOMContentLoaded.
 *
 * Planned implementation under test (must be RED before the coder implements):
 *   1. v2.html #loadScreen contains a LIVE <t-loading> (not commented).
 *   2. v2.html #loadScreen no longer contains the inlined spoon SVG copy:
 *      no <svg> descendant inside #loadScreen, no .loadParent and no
 *      `@keyframes spoon-tilt` left in v2.html (they live in t-loading's
 *      shadow CSS).
 *   3. v2.html has an EARLY module import of t-loading (a
 *      <script type="module"> that references t-loading) occurring BEFORE
 *      src="/v2Script.js".
 *   4. v2Script.ts re-enables the null-safe #loadScreen removal after its
 *      DOMContentLoaded init.
 *   5. v2Script.ts keeps importing ./components/atom/t-loading.js so the
 *      custom element registers.
 *   6. Branding text ("Troff"/"loading") still present inside #loadScreen.
 *
 * Harness mirrors tests/v2Script-volume-speed-boot.test.ts: DOM skeleton for
 * the ids v2Script queries, duplicate custom-element define guard, rAF stub,
 * and Firebase/nDB/audio/current-song mocks — Firebase and nDB are never real.
 * HTML content is asserted by reading v2.html directly, the same pattern as
 * tests/es-module-shims-guard.test.ts.
 */

const ROOT = join(__dirname, '..');

/** Raw contents of v2.html (for style/script-order assertions). */
function readV2HtmlRaw(): string {
  return readFileSync(join(ROOT, 'v2.html'), 'utf-8');
}

/** Parse the <body> content of v2.html into a detached container. */
function readV2HtmlBody(): HTMLElement {
  const html = readV2HtmlRaw();
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const wrapper = document.createElement('div');
  wrapper.innerHTML = match ? match[1] : '';
  return wrapper;
}

describe('v2 boot splash (loadScreen + t-loading)', () => {
  // -------------------------------------------------------------------------
  // Static content checks on v2.html
  // -------------------------------------------------------------------------
  describe('v2.html boot splash markup', () => {
    it('contains #loadScreen as a direct child of <body>', () => {
      const body = readV2HtmlBody();
      const loadScreen = body.querySelector('#loadScreen');
      expect(
        loadScreen,
        'v2.html is missing <div id="loadScreen"> inside <body>'
      ).not.toBeNull();
      expect(loadScreen?.parentElement).toBe(body);
    });

    it('contains a live <t-loading> element inside #loadScreen', () => {
      const loadScreen = readV2HtmlBody().querySelector('#loadScreen');
      expect(
        loadScreen,
        'v2.html is missing <div id="loadScreen"> inside <body>'
      ).not.toBeNull();
      // A commented-out <!-- <t-loading> --> parses as a comment node, so
      // querySelector correctly returns null for the current state.
      expect(
        loadScreen?.querySelector('t-loading'),
        '#loadScreen must contain a live <t-loading> spinner (not commented out)'
      ).not.toBeNull();
    });

    it('has no inlined spoon SVG copy inside #loadScreen', () => {
      const loadScreen = readV2HtmlBody().querySelector('#loadScreen');
      expect(
        loadScreen,
        'v2.html is missing <div id="loadScreen"> inside <body>'
      ).not.toBeNull();
      expect(
        loadScreen?.querySelector('svg'),
        '#loadScreen must not contain an inlined <svg> — use <t-loading> instead'
      ).toBeNull();
    });

    it('does not keep the duplicated spinner CSS (.loadParent / spoon keyframes) in v2.html', () => {
      const html = readV2HtmlRaw();
      expect(
        html.includes('.loadParent'),
        'v2.html must not contain the duplicated .loadParent spinner CSS'
      ).toBe(false);
      expect(
        html.includes('@keyframes spoon-tilt'),
        'v2.html must not contain @keyframes spoon-tilt (lives in t-loading shadow CSS)'
      ).toBe(false);
    });

    it('imports t-loading in an early module script before /v2Script.js', () => {
      const html = readV2HtmlRaw();
      const v2ScriptIdx = html.indexOf('src="/v2Script.js"');
      expect(
        v2ScriptIdx,
        'v2.html is missing <script src="/v2Script.js">'
      ).toBeGreaterThan(-1);

      const earlyImport = html.match(
        /<script[^>]*type="module"[^>]*>[\s\S]*?t-loading[\s\S]*?<\/script>/
      );
      expect(
        earlyImport,
        'v2.html needs an early <script type="module"> importing t-loading before the main bundle'
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
        'v2.html is missing <div id="loadScreen"> inside <body>'
      ).not.toBeNull();
      expect(loadScreen?.textContent ?? '').toMatch(/troff|loading/i);
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
