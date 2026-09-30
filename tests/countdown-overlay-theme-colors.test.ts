import { describe, it, expect } from 'vitest';
import type { CSSResult } from 'lit';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BottomNav } from '../components/molecule/t-footer.js';

/**
 * Regression test for user theme color request for countdown overlay:
 *
 * "can we get var(--accent-color-1) for standard theme, both light and dark?
 *  and for bold, can we get var(--theme-color)?
 *  and for winning, dark, can we get --accent-color-1, and for light var(--accent-color-3)?
 *  and for ocean, can we get something that fits better?"
 *
 * Theme mapping (confirmed from ACTUAL t-settings-panel.ts):
 *   standard = col1
 *   bold = col5
 *   winning = col4
 *   ocean = col6
 *
 * .countdown-overlay (in ACTUAL BottomNav) uses color: var(--countdown-overlay-color)
 * with no background (per prior user request).
 *
 * This test uses raw CSS parsing (readFileSync + regex on ACTUAL
 * stylesheets/variables-theme.css) to assert the *exact* --countdown-overlay-color
 * declarations in the theme blocks. No re-implementation of theme logic,
 * no hardcoded color values, just the var references requested.
 *
 * Must be RED on current CSS (current assignments differ); will turn GREEN
 * only after @coder updates the declarations in variables-theme.css.
 *
 * For ocean we chose var(--accent-color-1) (a fitting teal accent from the
 * theme's own accent palette, for thematic consistency with
 * --active-play-region etc. and better identity than generic
 * --on-regular-buton-color or literal black in dark).
 */

const ROOT = join(__dirname, '..');

function readThemeCss(): string {
  return readFileSync(join(ROOT, 'stylesheets', 'variables-theme.css'), 'utf-8');
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

type StyledClass = { styles?: CSSResult | CSSResult[] };

function rawStaticCss(cls: StyledClass): string {
  const styles = cls.styles;
  const list = Array.isArray(styles) ? styles : [styles];
  return list.map((s) => (typeof s?.cssText === 'string' ? s.cssText : '')).join('\n');
}

function rawRuleBlocks(staticCss: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}\\s*\\{[^}]*\\}`, 'g');
  return staticCss.match(re)?.join('\n') ?? '';
}

/**
 * Extract the exact right-hand side of --countdown-overlay-color declaration
 * from the block for the given selector (base or override).
 * Returns null if block or decl not present.
 * Pure string parse of the ACTUAL css file.
 */
function getOnSliderColorDecl(css: string, selector: string): string | null {
  const clean = stripComments(css);
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blockRe = new RegExp(esc + '\\s*\\{([\\s\\S]*?)\\}', 'm');
  const blockMatch = clean.match(blockRe);
  if (!blockMatch) return null;
  const body = blockMatch[1];
  const declRe = /--countdown-overlay-color\s*:\s*([^;]+?)\s*;/;
  const declMatch = body.match(declRe);
  return declMatch ? declMatch[1].trim() : null;
}

describe('countdown overlay theme colors (user request for specific vars)', () => {
  it('premise: .countdown-overlay in ACTUAL BottomNav uses var(--countdown-overlay-color) (no reimplementation)', () => {
    const footerCss = rawStaticCss(BottomNav as unknown as StyledClass);
    const overlayRule = rawRuleBlocks(footerCss, '.countdown-overlay');
    expect(overlayRule, 'expected a .countdown-overlay rule in BottomNav static styles').not.toBe(
      ''
    );
    expect(
      /color\s*:\s*var\(--countdown-overlay-color/.test(overlayRule),
      `countdown-overlay must use var(--countdown-overlay-color); rule was:\n${overlayRule}`
    ).toBe(true);
  });

  it('RED: exact --countdown-overlay-color var references in theme blocks for standard/bold/winning/ocean', () => {
    const cssText = readThemeCss();

    // standard (col1): base (light) + dark override → var(--accent-color-1)
    expect(
      getOnSliderColorDecl(cssText, "[data-theme='col1']"),
      'standard base (light) --countdown-overlay-color must be var(--accent-color-1)'
    ).toBe('var(--accent-color-1)');
    expect(
      getOnSliderColorDecl(cssText, "[data-theme='col1'][data-mode='dark']"),
      'standard dark --countdown-overlay-color must be var(--accent-color-1)'
    ).toBe('var(--accent-color-1)');

    // bold (col5): base + light override → var(--theme-color)
    expect(
      getOnSliderColorDecl(cssText, "[data-theme='col5']"),
      'bold base --countdown-overlay-color must be var(--theme-color)'
    ).toBe('var(--theme-color)');
    expect(
      getOnSliderColorDecl(cssText, "[data-theme='col5'][data-mode='light']"),
      'bold light --countdown-overlay-color must be var(--theme-color)'
    ).toBe('var(--theme-color)');

    // winning (col4): light override uses var(--accent-color-3), dark uses var(--accent-color-1)
    expect(
      getOnSliderColorDecl(cssText, "[data-theme='col4'][data-mode='light']"),
      'winning light --countdown-overlay-color must be var(--accent-color-3)'
    ).toBe('var(--accent-color-3)');
    expect(
      getOnSliderColorDecl(cssText, "[data-theme='col4'][data-mode='dark']"),
      'winning dark --countdown-overlay-color must be var(--accent-color-1)'
    ).toBe('var(--accent-color-1)');

    // ocean (col6): chose var(--accent-color-1) as something that fits better
    // (thematic teal accent from ocean's palette, for consistency with
    // --slider-playback-region-color and --active-play-region; contrasts
    // the light cyan body and provides ocean identity vs current generic)
    expect(
      getOnSliderColorDecl(cssText, "[data-theme='col6']"),
      'ocean base (light) --countdown-overlay-color must be var(--accent-color-1) (chosen fit)'
    ).toBe('var(--accent-color-1)');
    expect(
      getOnSliderColorDecl(cssText, "[data-theme='col6'][data-mode='dark']"),
      'ocean dark --countdown-overlay-color must be var(--accent-color-1) (chosen fit)'
    ).toBe('var(--accent-color-1)');
  });
});
