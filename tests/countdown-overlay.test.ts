import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BottomNav } from '../components/molecule/t-footer.js';

/**
 * Feature spec (translated from Swedish request):
 * "Vi vill ha en full-screen countdown (likt mobile på v1) som dyker upp
 *  (utan att blocka ui't) när nedräkningen görs)"
 * Means: when a countdown runs (before playback / loop start), show a
 * full-screen countdown overlay similar to mobile v1, which appears WITHOUT
 * blocking the UI (non-blocking: click-through, UI remains interactive).
 *
 * Current state (pre-implementation):
 * - v2Script.ts `updatePlaybackCountdown()` only pushes the countdown number
 *   into `t-footer` (`isStartingPlayback` + `playbackCountdown`) and
 *   `t-header` (`statusCountdown` text). There is no fullscreen overlay.
 * - `t-footer` renders the countdown as a small `.play-countdown` div INSIDE
 *   the play button (`.play-button-wrapper`), not a full-viewport overlay.
 * - No `t-countdown-overlay` (or similar `t-*`) element exists anywhere.
 *
 * Planned implementation under test (must be RED before the coder implements):
 * 1. While `isStartingPlayback` is true, a dedicated fullscreen overlay
 *    element is rendered (either inside `t-footer` shadow DOM or as a
 *    `t-*` Lit component in the document) — NOT just the small
 *    `.play-countdown` inside the play button.
 * 2. The overlay displays the current countdown number and updates as
 *    `playbackCountdown` changes.
 * 3. The overlay is non-blocking: `pointer-events: none` (click-through, UI
 *    remains interactive) via component CSS (no inline styles).
 * 4. The overlay covers the full viewport: `position: fixed` + full-viewport
 *    sizing (`inset: 0` / `100vw`+`100vh`/`100dvh` or `top/left/right/bottom`).
 * 5. The overlay disappears when the countdown ends / is cancelled
 *    (`isStartingPlayback` false).
 *
 * Harness mirrors components/molecule/t-footer.test.ts: instantiate the
 * ACTUAL BottomNav class (never a re-implementation), append to the body,
 * drive the real `isStartingPlayback`/`playbackCountdown` properties that
 * v2Script sets, and assert on the real shadow DOM. No Firebase / nDB use.
 */

/** Selectors for the expected overlay. Deliberately does NOT match the
 * existing small `.play-countdown` inside the play button. */
const OVERLAY_SELECTORS = [
  '[data-testid="countdown-overlay"]',
  '.countdown-overlay',
  '#countdown-overlay',
  't-countdown-overlay',
  '.fullscreen-countdown',
].join(', ');

/** Collect all CSS text reachable from a shadow root (style tags +
 * adoptedStyleSheets), plus the shadow CSS of a nested overlay element. */
function collectCssText(root: ShadowRoot): string {
  const parts: string[] = [];
  root.querySelectorAll('style').forEach((style) => {
    parts.push(style.textContent ?? '');
  });
  const sheets: CSSStyleSheet[] = root.adoptedStyleSheets ?? [];
  for (const sheet of sheets) {
    try {
      for (let i = 0; i < sheet.cssRules.length; i++) {
        const rule = sheet.cssRules[i];
        if (rule) {
          parts.push(rule.cssText);
        }
      }
    } catch {
      // Ignore unreadable (cross-origin) sheets; local CSS is what matters.
    }
  }
  return parts.join('\n');
}

function collectOverlayCss(footer: BottomNav, overlay: Element): string {
  const chunks: string[] = [];
  if (footer.shadowRoot) {
    chunks.push(collectCssText(footer.shadowRoot));
  }
  const overlayRoot = (overlay as HTMLElement).shadowRoot;
  if (overlayRoot) {
    chunks.push(collectCssText(overlayRoot));
  }
  // Document-level styles also count (overlay may live outside t-footer).
  document.querySelectorAll('style').forEach((style) => {
    chunks.push(style.textContent ?? '');
  });
  return chunks.join('\n');
}

/** The overlay under test: a dedicated element in footer shadow DOM or in
 * the document (covers both "inside t-footer" and "new t-* component"
 * implementation shapes). */
function findCountdownOverlay(footer: BottomNav): Element | null {
  const inFooter = footer.shadowRoot?.querySelector(OVERLAY_SELECTORS) ?? null;
  if (inFooter) {
    return inFooter;
  }
  return document.querySelector(OVERLAY_SELECTORS);
}

describe('fullscreen non-blocking countdown overlay', () => {
  let footer: BottomNav;

  beforeEach(() => {
    footer = new BottomNav();
    document.body.appendChild(footer);
  });

  afterEach(() => {
    if (document.body.contains(footer)) {
      document.body.removeChild(footer);
    }
    document.querySelectorAll('t-countdown-overlay').forEach((el) => el.remove());
  });

  it('renders a dedicated overlay element while the countdown runs', async () => {
    footer.isStartingPlayback = true;
    footer.playbackCountdown = 3;
    await footer.updateComplete;

    const overlay = findCountdownOverlay(footer);
    expect(
      overlay,
      'expected a dedicated fullscreen countdown overlay ' +
        `(${OVERLAY_SELECTORS}) while isStartingPlayback=true, but found none — ` +
        'the countdown only renders as small .play-countdown text inside the play button'
    ).not.toBeNull();
  });

  it('overlay shows the current countdown number and updates with it', async () => {
    footer.isStartingPlayback = true;
    footer.playbackCountdown = 3;
    await footer.updateComplete;

    const overlay = findCountdownOverlay(footer);
    expect(
      overlay,
      'no countdown overlay rendered while isStartingPlayback=true'
    ).not.toBeNull();
    expect(overlay?.textContent ?? '').toContain('3');

    footer.playbackCountdown = 2;
    await footer.updateComplete;
    expect(findCountdownOverlay(footer)?.textContent ?? '').toContain('2');
  });

  it('overlay is non-blocking (pointer-events: none via CSS, not inline)', async () => {
    footer.isStartingPlayback = true;
    footer.playbackCountdown = 3;
    await footer.updateComplete;

    const overlay = findCountdownOverlay(footer);
    expect(
      overlay,
      'no countdown overlay rendered while isStartingPlayback=true'
    ).not.toBeNull();
    if (!overlay) {
      return;
    }

    // UI must stay interactive: no inline pointer-events hack, the
    // click-through must come from component CSS.
    expect(
      (overlay as HTMLElement).style.pointerEvents,
      'overlay must not rely on inline styles (repo rule: no inline styles)'
    ).toBe('');

    const css = collectOverlayCss(footer, overlay);
    const computed = getComputedStyle(overlay).pointerEvents;
    expect(
      /pointer-events\s*:\s*none/.test(css) || computed === 'none',
      'countdown overlay must be click-through (pointer-events: none) so it ' +
        'never blocks UI interaction'
    ).toBe(true);
  });

  it('overlay covers the full viewport (position: fixed + full-size)', async () => {
    footer.isStartingPlayback = true;
    footer.playbackCountdown = 3;
    await footer.updateComplete;

    const overlay = findCountdownOverlay(footer);
    expect(
      overlay,
      'no countdown overlay rendered while isStartingPlayback=true'
    ).not.toBeNull();
    if (!overlay) {
      return;
    }

    const css = collectOverlayCss(footer, overlay);
    const computedPosition = getComputedStyle(overlay).position;
    const isFixed = /position\s*:\s*fixed/.test(css) || computedPosition === 'fixed';
    const isFullSize =
      /inset\s*:\s*0/.test(css) ||
      /100v[wh]/.test(css) ||
      /100dv[wh]/.test(css) ||
      (/top\s*:\s*0/.test(css) && /left\s*:\s*0/.test(css));
    expect(isFixed, 'countdown overlay must use position: fixed').toBe(true);
    expect(
      isFullSize,
      'countdown overlay must cover the full viewport ' +
        '(inset: 0 / 100vw+100vh / top+left+right+bottom 0)'
    ).toBe(true);
  });

  it('overlay is not trapped inside the play button', async () => {
    footer.isStartingPlayback = true;
    footer.playbackCountdown = 3;
    await footer.updateComplete;

    const overlay = findCountdownOverlay(footer);
    expect(
      overlay,
      'no countdown overlay rendered while isStartingPlayback=true'
    ).not.toBeNull();
    if (!overlay) {
      return;
    }

    const playButtonWrapper = footer.shadowRoot?.querySelector('.play-button-wrapper');
    expect(
      playButtonWrapper?.contains(overlay) ?? false,
      'countdown overlay must not live inside .play-button-wrapper — ' +
        'it must be a top-level fullscreen layer'
    ).toBe(false);
  });

  it('overlay disappears when the countdown ends / is cancelled', async () => {
    footer.isStartingPlayback = true;
    footer.playbackCountdown = 3;
    await footer.updateComplete;
    expect(
      findCountdownOverlay(footer),
      'no countdown overlay rendered while isStartingPlayback=true'
    ).not.toBeNull();

    // Mirrors v2Script clearPlaybackCountdown(): flags off, count reset.
    footer.isStartingPlayback = false;
    footer.playbackCountdown = 0;
    await footer.updateComplete;

    const overlay = findCountdownOverlay(footer);
    const hidden =
      overlay === null ||
      (overlay as HTMLElement).hasAttribute('hidden') ||
      getComputedStyle(overlay).display === 'none' ||
      (overlay.textContent ?? '').trim() === '';
    expect(hidden, 'countdown overlay must disappear once the countdown ends').toBe(true);
  });
});
