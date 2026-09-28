import { describe, it, expect } from 'vitest';
import type { CSSResult } from 'lit';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BottomNav } from '../components/molecule/t-footer.js';

/**
 * User report: "it works great except: forest light mode, sunset light mode
 * and bold light mode — could you take a look at the color and on-color there?"
 *
 * Context (all ACTUAL sources, never re-implemented):
 * - `.countdown-overlay` in components/molecule/t-footer.ts paints its number
 *   with `color: var(--countdown-overlay-color, #fff)` and — per explicit user request
 *   (see tests/countdown-overlay-no-dim.test.ts) — declares NO background and
 *   NO text-shadow. So the countdown number floats directly over the page
 *   background (`--body-background`).
 * - `--slider-color` / `--countdown-overlay-color` / `--body-background` are defined
 *   per theme in stylesheets/variables-theme.css; light mode is selected via
 *   `body[data-theme='colX'][data-mode='light']` (v2Script.ts sets
 *   `data-theme`/`data-mode` on document.body).
 * - Theme name mapping comes from the ACTUAL settings panel
 *   (components/molecule/t-settings-panel.ts): forest→col2, sunset→col3,
 *   bold→col5.
 *
 * Finding under test (must be RED until @coder fixes the theme CSS):
 * in forest light, sunset light and bold light, the resolved
 * `--countdown-overlay-color` is near-white while the resolved `--body-background`
 * is ALSO near-white (≈1.0–1.1:1, far below the 3:1 WCAG floor for the
 * 6rem/bold countdown number), so the countdown is effectively invisible.
 *
 * Harness mirrors tests/countdown-overlay-slider-color.test.ts: import the
 * ACTUAL BottomNav class, read RAW Lit static styles, and parse the ACTUAL
 * variables-theme.css text (generic CSS var() resolution only — theme values
 * are never hardcoded). No Firebase / nDB use.
 */

const ROOT = join(__dirname, '..');

/** Minimum contrast for the countdown number (6rem, weight 700 → large-scale
 *  text, WCAG 1.4.3 large-text floor is 3:1). */
const MIN_LARGE_TEXT_CONTRAST = 3.0;

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

/** ACTUAL theme CSS text (never a copy of its values). */
function readThemeCss(): string {
  return readFileSync(join(ROOT, 'stylesheets', 'variables-theme.css'), 'utf-8');
}

/** ACTUAL settings-panel source — the authority for name→col mapping. */
function readSettingsPanelSource(): string {
  return readFileSync(join(ROOT, 'components', 'molecule', 't-settings-panel.ts'), 'utf-8');
}

/**
 * Map a user-visible theme name (e.g. 'forest') to its data-theme col id
 * (e.g. 'col2') using the ACTUAL t-settings-panel.ts source: find the
 * `</span>name</t-butt` label and take the nearest preceding
 * `_setTheme('colX')` call.
 */
function themeColForName(panelSource: string, name: string): string {
  const label = `</span>${name}</t-butt`;
  const labelIndex = panelSource.indexOf(label);
  expect(
    labelIndex,
    `expected to find the "${name}" theme button (${label}) in the ACTUAL t-settings-panel.ts`
  ).toBeGreaterThan(-1);
  const before = panelSource.slice(0, labelIndex);
  const matches = [...before.matchAll(/_setTheme\('(col\d+)'\)/g)];
  expect(
    matches.length,
    `expected a _setTheme('colX') call before the "${name}" label in the ACTUAL t-settings-panel.ts`
  ).toBeGreaterThan(0);
  return matches[matches.length - 1][1];
}

type Decls = Record<string, string>;

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** True when a selector targets the given col in the given data-mode. */
function selectorTargets(selector: string, col: string, mode: string): boolean {
  const themeRe = new RegExp(`\\[data-theme\\s*=\\s*['"]${col}['"]\\]`);
  const modeRe = new RegExp(`\\[data-mode\\s*=\\s*['"]${mode}['"]\\]`);
  return themeRe.test(selector) && modeRe.test(selector);
}

/** True when a selector targets the given col with NO data-mode (base/default). */
function selectorIsBase(selector: string, col: string): boolean {
  const themeRe = new RegExp(`\\[data-theme\\s*=\\s*['"]${col}['"]\\]`);
  return themeRe.test(selector) && !/\[data-mode\s*=/.test(selector);
}

/**
 * Merged custom-property declarations for one theme in light mode, honouring
 * real cascade order: base `[data-theme='colX']` first, then the
 * `[data-theme='colX'][data-mode='light']` override wins. (v2Script.ts applies
 * light mode as body[data-mode='light'], so both selectors match and the
 * double-attribute selector wins on specificity.)
 */
function declarationsForLightMode(cssText: string, col: string): Decls {
  const decls: Decls = {};
  const clean = stripComments(cssText);
  const blockRe = /([^{}]+)\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  const applyBlock = (selector: string, body: string): void => {
    for (const part of body.split(';')) {
      const declMatch = part.match(/^\s*(--[\w-]+)\s*:\s*(.+?)\s*$/);
      if (declMatch) {
        decls[declMatch[1]] = declMatch[2];
      }
    }
    void selector;
  };
  // Pass 1: base (default) declarations.
  while ((match = blockRe.exec(clean)) !== null) {
    if (selectorIsBase(match[1], col)) {
      applyBlock(match[1], match[2]);
    }
  }
  // Pass 2: light-mode overrides win.
  blockRe.lastIndex = 0;
  while ((match = blockRe.exec(clean)) !== null) {
    if (selectorTargets(match[1], col, 'light')) {
      applyBlock(match[1], match[2]);
    }
  }
  return decls;
}

/**
 * Resolve a custom property through generic CSS var() chaining against the
 * merged declarations (NOT theme logic — just var() semantics). Returns the
 * raw chain head and the final literal, e.g. ["var(--on-theme-color)", "#fff"].
 */
function resolveChain(decls: Decls, name: string): { raw: string; literal: string } {
  const raw = decls[name];
  expect(raw, `expected ${name} to be declared for this theme/mode`).toBeDefined();
  const seen: string[] = [name];
  let current = (raw as string).trim();
  const varRe = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+?))?\s*\)$/;
  for (let step = 0; step < 10; step += 1) {
    const varMatch = current.match(varRe);
    if (!varMatch) {
      return { raw: (raw as string).trim(), literal: current };
    }
    const refName = varMatch[1];
    const fallback = varMatch[2];
    expect(
      seen.includes(refName),
      `circular var() chain resolving ${name}: ${[...seen, refName].join(' → ')}`
    ).toBe(false);
    seen.push(refName);
    const refValue = decls[refName];
    if (refValue === undefined) {
      expect(fallback, `${name} chains to undeclared ${refName} with no fallback`).toBeDefined();
      current = (fallback as string).trim();
    } else {
      current = refValue.trim();
    }
  }
  throw new Error(`var() chain too deep resolving ${name}: ${seen.join(' → ')}`);
}

const NAMED_COLORS: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  lightgray: '#d3d3d3',
  lightgrey: '#d3d3d3',
  lightblue: '#add8e6',
  gray: '#808080',
  grey: '#808080',
  red: '#ff0000',
  transparent: '#000000',
};

function parseColorToRgb(literal: string): [number, number, number] {
  const value = literal.trim().toLowerCase();
  const hexMatch = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    const full =
      hex.length === 3
        ? hex
            .split('')
            .map((ch) => ch + ch)
            .join('')
        : hex;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  }
  const rgbMatch = value.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/
  );
  if (rgbMatch) {
    return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
  }
  const named = NAMED_COLORS[value];
  if (named) {
    return parseColorToRgb(named);
  }
  throw new Error(`unsupported color literal in ACTUAL theme CSS: "${literal}"`);
}

function relativeLuminance(rgb: [number, number, number]): number {
  const linear = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('countdown overlay color/on-color in forest/sunset/bold light mode (user report)', () => {
  it('premise: overlay text is var(--countdown-overlay-color) with NO background, so it renders over --body-background', () => {
    const footerCss = rawStaticCss(BottomNav as unknown as StyledClass);
    const overlayRule = rawRuleBlocks(footerCss, '.countdown-overlay');
    expect(
      overlayRule,
      'expected a .countdown-overlay rule in the ACTUAL BottomNav static styles'
    ).not.toBe('');
    expect(
      /var\(--countdown-overlay-color/.test(overlayRule),
      `overlay text must come from var(--countdown-overlay-color); rule was:\n${overlayRule}`
    ).toBe(true);
    expect(
      /background/.test(overlayRule),
      `overlay must declare no background (user removed it) so the number floats over the page; rule was:\n${overlayRule}`
    ).toBe(false);
  });

  it('RED: --countdown-overlay-color vs --body-background contrast >= 3.0 in forest/sunset/bold light mode', () => {
    const cssText = readThemeCss();
    const panelSource = readSettingsPanelSource();
    const reportLines: string[] = [];
    const failures: string[] = [];
    for (const name of ['forest', 'sunset', 'bold']) {
      const col = themeColForName(panelSource, name);
      const decls = declarationsForLightMode(cssText, col);
      const onSlider = resolveChain(decls, '--countdown-overlay-color');
      const bodyBg = resolveChain(decls, '--body-background');
      const slider = resolveChain(decls, '--slider-color');
      const ratio = contrastRatio(
        parseColorToRgb(onSlider.literal),
        parseColorToRgb(bodyBg.literal)
      );
      reportLines.push(
        `${name} light ([data-theme='${col}'][data-mode='light']): ` +
          `--slider-color: ${slider.raw} → ${slider.literal}; ` +
          `--countdown-overlay-color: ${onSlider.raw} → ${onSlider.literal}; ` +
          `--body-background: ${bodyBg.raw} → ${bodyBg.literal}; ` +
          `countdown-text-vs-page contrast = ${ratio.toFixed(2)}:1`
      );
      if (ratio < MIN_LARGE_TEXT_CONTRAST) {
        failures.push(
          `${name} light: countdown text ${onSlider.literal} over page ${bodyBg.literal} = ${ratio.toFixed(2)}:1 (< ${MIN_LARGE_TEXT_CONTRAST}:1)`
        );
      }
    }
    expect(
      failures,
      `countdown number unreadable in light mode (white-ish --countdown-overlay-color over white-ish --body-background, overlay has no background):\n` +
        reportLines.join('\n') +
        `\nFailures:\n${failures.join('\n')}`
    ).toEqual([]);
  });
});
