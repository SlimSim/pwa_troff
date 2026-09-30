import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { CSSResult } from 'lit';
import { BottomNav } from '../components/molecule/t-footer.js';

/**
 * User request (explicit, overrides previous):
 * "SKIP the background and text-shadow, i removed that for a reason!
 *  if we solve the correct color we dont need them!"
 *
 * So `.countdown-overlay` in the ACTUAL BottomNav (t-footer) must:
 * - KEEP: `color: var(--countdown-overlay-color, ...)` (theme-aware correct color,
 *   defined in stylesheets/variables-theme.css)
 * - KEEP: fullscreen (`position: fixed` + `inset: 0`) + non-blocking
 *   (`pointer-events: none`)
 * - REMOVE: `background: rgba(0,0,0,0.55)` + `text-shadow` dim helpers
 *   (no background/dim/backdrop-filter, no text-shadow/text-stroke,
 *   transparent background).
 *
 * This file is RED while those 2 declarations still exist, GREEN after
 * @coder removes only those 2 declarations.
 *
 * NOTE for @coder: tests/countdown-overlay-visibility.test.ts currently
 * REQUIRES a dim backdrop — it is superseded by this user request and will
 * need updating/removal.
 *
 * Harness mirrors tests/countdown-overlay-visibility.test.ts: instantiate
 * the ACTUAL BottomNav class (never a re-implementation), read the RAW Lit
 * static styles (happy-dom drops var() from serialized cssText, so
 * BottomNav.styles is the source of truth). No Firebase / nDB use.
 */

type StyledClass = { styles?: CSSResult | CSSResult[] };

/** Raw (unparsed) Lit static CSS — immune to happy-dom dropping var(). */
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

/** True when the computed background is fully transparent. */
function isTransparentBackground(value: string): boolean {
  const normalized = value.replace(/\s+/g, '').toLowerCase();
  return (
    normalized === '' ||
    normalized === 'transparent' ||
    normalized === 'rgba(0,0,0,0)' ||
    /rgba\([^,]+,[^,]+,[^,]+,0(\.0*)?\)/.test(normalized)
  );
}

describe('countdown overlay clean color — no dim helpers (user request)', () => {
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

  it('keeps the correct color + fullscreen + non-blocking behavior', async () => {
    footer.isStartingPlayback = true;
    footer.playbackCountdown = 3;
    await footer.updateComplete;

    const overlay = footer.shadowRoot?.querySelector(
      '[data-testid="countdown-overlay"]'
    ) as HTMLElement | null;
    expect(overlay, 'no countdown overlay rendered while isStartingPlayback=true').not.toBeNull();

    const footerCss = rawStaticCss(BottomNav as unknown as StyledClass);
    const overlayRule = rawRuleBlocks(footerCss, '.countdown-overlay');
    expect(overlayRule, 'expected a .countdown-overlay rule in BottomNav static styles').not.toBe(
      ''
    );

    // Correct theme-aware color (must be kept).
    expect(
      /var\(--countdown-overlay-color/.test(overlayRule),
      `countdown-overlay color must stay var(--countdown-overlay-color, ...); rule was:\n${overlayRule}`
    ).toBe(true);

    // Fullscreen must be kept.
    expect(
      /position\s*:\s*fixed/.test(overlayRule),
      `overlay must keep position: fixed; rule was:\n${overlayRule}`
    ).toBe(true);
    expect(
      /inset\s*:\s*0/.test(overlayRule),
      `overlay must keep inset: 0; rule was:\n${overlayRule}`
    ).toBe(true);

    // Non-blocking must be kept.
    expect(
      /pointer-events\s*:\s*none/.test(overlayRule),
      `overlay must keep pointer-events: none; rule was:\n${overlayRule}`
    ).toBe(true);
  });

  it('has NO background/dim/backdrop-filter and NO text-shadow/text-stroke (transparent, color-only)', async () => {
    footer.isStartingPlayback = true;
    footer.playbackCountdown = 3;
    await footer.updateComplete;

    const overlay = footer.shadowRoot?.querySelector(
      '[data-testid="countdown-overlay"]'
    ) as HTMLElement | null;
    expect(overlay, 'no countdown overlay rendered while isStartingPlayback=true').not.toBeNull();
    if (!overlay) {
      return;
    }

    const footerCss = rawStaticCss(BottomNav as unknown as StyledClass);
    const overlayRule = rawRuleBlocks(footerCss, '.countdown-overlay');
    expect(overlayRule, 'expected a .countdown-overlay rule in BottomNav static styles').not.toBe(
      ''
    );

    // User explicitly removed these for a reason: the correct
    // var(--countdown-overlay-color) needs no dim helpers.
    expect(
      /background/.test(overlayRule),
      `overlay must NOT declare any background (dim) — user removed it; rule was:\n${overlayRule}`
    ).toBe(false);
    expect(
      /backdrop-filter/.test(overlayRule),
      `overlay must NOT declare backdrop-filter; rule was:\n${overlayRule}`
    ).toBe(false);
    expect(
      /text-shadow/.test(overlayRule),
      `overlay must NOT declare text-shadow — user removed it; rule was:\n${overlayRule}`
    ).toBe(false);
    const hasTextStroke =
      /-webkit-text-stroke/.test(overlayRule) || /text-stroke/.test(overlayRule);
    expect(hasTextStroke, `overlay must NOT declare text-stroke; rule was:\n${overlayRule}`).toBe(
      false
    );

    // Transparent background: no dim layer behind the number.
    const computedBg = getComputedStyle(overlay).backgroundColor;
    expect(
      isTransparentBackground(computedBg),
      `overlay background must be transparent (no dim layer); computed backgroundColor was: "${computedBg}"; rule was:\n${overlayRule}`
    ).toBe(true);
  });
});
