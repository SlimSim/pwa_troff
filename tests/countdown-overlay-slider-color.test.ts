import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { CSSResult } from 'lit';
import { BottomNav } from '../components/molecule/t-footer.js';
import { MarkerSlider } from '../components/organisms/t-marker-slider.js';

/**
 * Regression test for: "what variable is the t-marker-slider background?
 * and what is that colors --on-color? can we put the countdown-color to
 * that color?"
 *
 * Finding (locked by the first test below, using the ACTUAL MarkerSlider):
 * t-marker-slider's track + thumb background is `var(--slider-color)`
 * (components/organisms/t-marker-slider.ts: `.slider-track` and
 * `.slider-thumb` both declare `background-color: var(--slider-color)`).
 * There is deliberately NO `--countdown-overlay-color` variable anywhere in
 * stylesheets/variables-theme.css (light themes col1–col6, dark-mode
 * overrides, col3/col5 light-mode overrides) — so the slider background
 * has no corresponding `--on-` variable today.
 *
 * Requirement under test (second test, must be RED until @coder fixes):
 * `.countdown-overlay` in the ACTUAL BottomNav (t-footer) must derive its
 * text `color` from the slider background's corresponding `--on-`
 * variable, i.e. `var(--countdown-overlay-color, ...)` — theme-aware and
 * dark/light aware via variables-theme.css, instead of the current
 * `color: var(--theme-color, pink)`.
 *
 * Harness mirrors tests/countdown-overlay-visibility.test.ts: import the
 * ACTUAL component classes (never a re-implementation), read the RAW Lit
 * static styles (happy-dom drops var() declarations from serialized
 * cssText, so BottomNav.styles / MarkerSlider.styles are the source of
 * truth), and drive the real `isStartingPlayback` / `playbackCountdown`
 * properties that v2Script sets. No Firebase / nDB use.
 */

type StyledClass = { styles?: CSSResult | CSSResult[] };

/** Raw (unparsed) Lit static CSS of a component class — immune to
 * happy-dom dropping `var()` declarations from serialized cssText. */
function rawStaticCss(cls: StyledClass): string {
  const styles = cls.styles;
  const list = Array.isArray(styles) ? styles : [styles];
  return list.map((s) => (typeof s?.cssText === 'string' ? s.cssText : '')).join('\n');
}

/** Raw rule block(s) for one selector from raw static CSS text. */
function rawRuleBlocks(staticCss: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}\\s*\\{[^}]*\\}`, 'g');
  return staticCss.match(re)?.join('\n') ?? '';
}

describe('countdown overlay uses t-marker-slider background on-color', () => {
  let footer: BottomNav;

  beforeEach(() => {
    footer = new BottomNav();
    document.body.appendChild(footer);
  });

  afterEach(() => {
    if (document.body.contains(footer)) {
      document.body.removeChild(footer);
    }
  });

  it('locks the finding: t-marker-slider track/thumb background is var(--slider-color)', () => {
    const sliderCss = rawStaticCss(MarkerSlider as unknown as StyledClass);
    const trackRule = rawRuleBlocks(sliderCss, '.slider-track');
    const thumbRule = rawRuleBlocks(sliderCss, '.slider-thumb');

    expect(trackRule, 'expected a .slider-track rule in MarkerSlider static styles').not.toBe('');
    expect(thumbRule, 'expected a .slider-thumb rule in MarkerSlider static styles').not.toBe('');
    expect(
      /background-color\s*:\s*var\(--slider-color/.test(trackRule),
      `slider track background must be var(--slider-color); rule was:\n${trackRule}`
    ).toBe(true);
    expect(
      /background-color\s*:\s*var\(--slider-color/.test(thumbRule),
      `slider thumb background must be var(--slider-color); rule was:\n${thumbRule}`
    ).toBe(true);
  });

  it('countdown-overlay text color uses the slider background on-color var(--countdown-overlay-color)', async () => {
    // The overlay the user should see fullscreen actually renders.
    footer.isStartingPlayback = true;
    footer.playbackCountdown = 3;
    await footer.updateComplete;

    const overlay = footer.shadowRoot?.querySelector(
      '[data-testid="countdown-overlay"]'
    ) as HTMLElement | null;
    expect(overlay, 'no countdown overlay rendered while isStartingPlayback=true').not.toBeNull();

    // Source of truth: raw static styles (happy-dom serialization drops var()).
    const footerCss = rawStaticCss(BottomNav as unknown as StyledClass);
    const overlayRule = rawRuleBlocks(footerCss, '.countdown-overlay');
    expect(overlayRule, 'expected a .countdown-overlay rule in BottomNav static styles').not.toBe(
      ''
    );

    // RED today: rule declares `color: var(--theme-color, pink)` and never
    // references the slider background's on-color variable.
    expect(
      /var\(--countdown-overlay-color/.test(overlayRule),
      'countdown-overlay color must reference the t-marker-slider background ' +
        'on-color variable var(--countdown-overlay-color, ...) so the fullscreen number ' +
        'stays theme-aware (all themes) and dark/light aware; ' +
        `actual .countdown-overlay rule was:\n${overlayRule}`
    ).toBe(true);
  });
});
