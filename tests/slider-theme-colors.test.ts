import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Per-theme slider color task: the slider thumb knob + its full-width line
 * (t-marker-slider AND t-vertical-slider) read `--slider-thumb-color`, and the
 * waveform fills with `--slider-color` (components/organisms/t-marker-slider.ts,
 * `_drawWaveform`).
 *
 * Background: this test was written RED against the pre-task state, where
 * `--slider-thumb-color` was declared ONLY in the col1 base block of
 * stylesheets/variables-theme.css — every other theme left it undefined, so
 * the components' `background-color` / `box-shadow` declarations were invalid
 * there. Five `--slider-color` declarations also resolved nearly invisible
 * against their slider background (`--secondary-color`):
 * col4 base + col4 dark, col5 base + col5 dark and col6 base.
 *
 * TARGET state this pins:
 * - every theme (col1..col6) declares `--slider-thumb-color` as a
 *   `var(--…)` reference to an EXISTING palette var, resolving to a hex
 *   literal in BOTH light and dark mode (light/dark overrides cascade on the
 *   same element, so only the blocks that need a different value declare one);
 * - thumb, waveform and playback-region always resolve to three DIFFERENT
 *   literals (pins the col3 special case — thumb = accent-3, because the col3
 *   wave IS accent-2 — and the col4 dark thumb override);
 * - thumb vs `--secondary-color` (the slider background) and the four changed
 *   waveforms vs `--secondary-color` meet their contrast floors.
 *
 * Harness mirrors tests/countdown-overlay-light-mode-contrast.test.ts: parse
 * the ACTUAL variables-theme.css text and resolve var() chains generically
 * (theme values are never hardcoded). No Firebase / nDB use.
 */

const ROOT = join(__dirname, '..');

const COLS = ['col1', 'col2', 'col3', 'col4', 'col5', 'col6'] as const;
const MODES = ['light', 'dark'] as const;

/** A raw custom-property reference must reuse an existing palette var. */
const VAR_REFERENCE_RE = /^var\(--[\w-]+\)$/;
/** Resolved literals must be plain hex colors (what the theme blocks use). */
const HEX_LITERAL_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** ACTUAL theme CSS text (never a copy of its values). */
function readThemeCss(): string {
  return readFileSync(join(ROOT, 'stylesheets', 'variables-theme.css'), 'utf-8');
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
 * Merged custom-property declarations for one theme in one mode, honouring
 * real cascade order: base `[data-theme='colX']` first, then the
 * `[data-theme='colX'][data-mode='light'|'dark']` override wins (v2Script.ts
 * applies the mode as body[data-mode], so both selectors match and the
 * double-attribute selector wins on specificity). Blocks that declare no
 * override simply keep the base value — same-element cascade.
 */
function declarationsForMode(cssText: string, col: string, mode: string): Decls {
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
  // Pass 2: mode overrides win.
  blockRe.lastIndex = 0;
  while ((match = blockRe.exec(clean)) !== null) {
    if (selectorTargets(match[1], col, mode)) {
      applyBlock(match[1], match[2]);
    }
  }
  return decls;
}

/**
 * Resolve a custom property through generic CSS var() chaining against the
 * merged declarations (NOT theme logic — just var() semantics). Returns the
 * raw chain head and the final literal, e.g. ["var(--accent-color-2)", "#dd2c00"].
 * Throws (via expect) when a var is undeclared and has no fallback — the RED
 * trigger for a missing --slider-thumb-color.
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

describe('per-theme slider thumb/waveform colors (variables-theme.css)', () => {
  it('every theme declares --slider-thumb-color as a var() reference resolving to a hex literal (light + dark)', () => {
    const cssText = readThemeCss();
    const report: string[] = [];
    const failures: string[] = [];
    for (const col of COLS) {
      for (const mode of MODES) {
        const decls = declarationsForMode(cssText, col, mode);
        try {
          const thumb = resolveChain(decls, '--slider-thumb-color');
          if (!VAR_REFERENCE_RE.test(thumb.raw)) {
            failures.push(
              `${col} ${mode}: --slider-thumb-color raw "${thumb.raw}" must be a ` +
                `var(--…) reference (reuse the existing palette, no new literals)`
            );
          }
          if (!HEX_LITERAL_RE.test(thumb.literal)) {
            failures.push(
              `${col} ${mode}: --slider-thumb-color: ${thumb.raw} → ${thumb.literal} ` +
                `must resolve to a hex literal`
            );
          }
          report.push(`${col} ${mode}: --slider-thumb-color: ${thumb.raw} → ${thumb.literal}`);
        } catch (err) {
          failures.push(`${col} ${mode}: ${(err as Error).message}`);
        }
      }
    }
    expect(
      failures,
      `--slider-thumb-color must exist for all 6 themes in light AND dark mode — the ` +
        `t-marker-slider and t-vertical-slider thumb/line/glow read it, so every theme ` +
        `must declare it (col1: var(--accent-color-2)); themes failing below have a ` +
        `missing or unresolvable declaration:\n` +
        report.join('\n') +
        `\nFailures:\n${failures.join('\n')}`
    ).toEqual([]);
  });

  it('thumb, waveform and playback-region resolve to three DIFFERENT literals per theme per mode', () => {
    const cssText = readThemeCss();
    const report: string[] = [];
    const failures: string[] = [];
    for (const col of COLS) {
      for (const mode of MODES) {
        const decls = declarationsForMode(cssText, col, mode);
        try {
          const thumb = resolveChain(decls, '--slider-thumb-color');
          const wave = resolveChain(decls, '--slider-color');
          const region = resolveChain(decls, '--slider-playback-region-color');
          report.push(
            `${col} ${mode}: thumb ${thumb.raw} → ${thumb.literal}; ` +
              `wave ${wave.raw} → ${wave.literal}; ` +
              `region ${region.raw} → ${region.literal}`
          );
          if (thumb.literal === wave.literal) {
            failures.push(
              `${col} ${mode}: thumb (${thumb.raw} → ${thumb.literal}) and waveform ` +
                `(${wave.raw} → ${wave.literal}) resolve to the SAME literal — the knob ` +
                `must stay visually distinct from the waveform behind it`
            );
          }
          if (thumb.literal === region.literal) {
            failures.push(
              `${col} ${mode}: thumb (${thumb.raw} → ${thumb.literal}) and playback ` +
                `region (${region.raw} → ${region.literal}) resolve to the SAME literal`
            );
          }
          if (wave.literal === region.literal) {
            failures.push(
              `${col} ${mode}: waveform (${wave.raw} → ${wave.literal}) and playback ` +
                `region (${region.raw} → ${region.literal}) resolve to the SAME literal`
            );
          }
        } catch (err) {
          failures.push(`${col} ${mode}: ${(err as Error).message}`);
        }
      }
    }
    expect(
      failures,
      `thumb (--slider-thumb-color), waveform (--slider-color) and playback region ` +
        `(--slider-playback-region-color) must stay three distinct colors in every theme/` +
        `mode (pins the col3 special case — thumb = accent-3 because the col3 wave IS ` +
        `accent-2 — and the col4 dark thumb override):\n` +
        report.join('\n') +
        `\nFailures:\n${failures.join('\n')}`
    ).toEqual([]);
  });

  it('thumb vs slider background (--secondary-color) meets the per-theme contrast floor', () => {
    // Floor per theme/mode: 2.5 where the knob only has to be findable,
    // 3:1 (non-text WCAG floor) where the theme leans on the knob as the
    // primary affordance. All computed from the ACTUAL css — no pinned values.
    const TARGETS: ReadonlyArray<{ col: string; mode: string; min: number }> = [
      { col: 'col1', mode: 'light', min: 2.5 },
      { col: 'col1', mode: 'dark', min: 2.5 },
      { col: 'col2', mode: 'light', min: 2.5 },
      { col: 'col2', mode: 'dark', min: 2.5 },
      { col: 'col3', mode: 'light', min: 2.5 },
      { col: 'col3', mode: 'dark', min: 3 },
      { col: 'col4', mode: 'light', min: 3 },
      { col: 'col4', mode: 'dark', min: 3 },
      { col: 'col5', mode: 'dark', min: 3 },
      { col: 'col5', mode: 'light', min: 2.5 },
      { col: 'col6', mode: 'light', min: 3 },
      { col: 'col6', mode: 'dark', min: 3 },
    ];
    const cssText = readThemeCss();
    const report: string[] = [];
    const failures: string[] = [];
    for (const { col, mode, min } of TARGETS) {
      const decls = declarationsForMode(cssText, col, mode);
      try {
        const thumb = resolveChain(decls, '--slider-thumb-color');
        const bg = resolveChain(decls, '--secondary-color');
        const ratio = contrastRatio(parseColorToRgb(thumb.literal), parseColorToRgb(bg.literal));
        report.push(
          `${col} ${mode}: thumb ${thumb.raw} → ${thumb.literal} vs background ` +
            `--secondary-color ${bg.raw} → ${bg.literal} = ${ratio.toFixed(2)}:1 ` +
            `(needs ≥ ${min}:1)`
        );
        if (ratio < min) {
          failures.push(
            `${col} ${mode}: thumb ${thumb.raw} → ${thumb.literal} vs slider background ` +
              `${bg.raw} → ${bg.literal} = ${ratio.toFixed(2)}:1 (< ${min}:1)`
          );
        }
      } catch (err) {
        failures.push(`${col} ${mode}: ${(err as Error).message}`);
      }
    }
    expect(
      failures,
      `slider thumb must stay readable against the slider background ` +
        `(--secondary-color) in every theme/mode:\n` +
        report.join('\n') +
        `\nFailures:\n${failures.join('\n')}`
    ).toEqual([]);
  });

  it('the four changed waveforms (--slider-color) reach ≥ 3:1 vs --secondary-color', () => {
    // Five --slider-color declarations changed in total; C2 floors the four
    // observable with data-mode set (col5 base is always masked by the col5
    // light/dark overrides — v2Script sets data-mode on body). The other
    // themes' --slider-color values are out of scope and stay untouched.
    const TARGETS: ReadonlyArray<{ col: string; mode: string }> = [
      { col: 'col4', mode: 'light' },
      { col: 'col4', mode: 'dark' },
      { col: 'col5', mode: 'dark' },
      { col: 'col6', mode: 'light' },
    ];
    const MIN_WAVE_CONTRAST = 3;
    const cssText = readThemeCss();
    const report: string[] = [];
    const failures: string[] = [];
    for (const { col, mode } of TARGETS) {
      const decls = declarationsForMode(cssText, col, mode);
      try {
        const wave = resolveChain(decls, '--slider-color');
        const bg = resolveChain(decls, '--secondary-color');
        const ratio = contrastRatio(parseColorToRgb(wave.literal), parseColorToRgb(bg.literal));
        report.push(
          `${col} ${mode}: wave ${wave.raw} → ${wave.literal} vs background ` +
            `--secondary-color ${bg.raw} → ${bg.literal} = ${ratio.toFixed(2)}:1 ` +
            `(needs ≥ ${MIN_WAVE_CONTRAST}:1)`
        );
        if (ratio < MIN_WAVE_CONTRAST) {
          failures.push(
            `${col} ${mode}: waveform ${wave.raw} → ${wave.literal} vs slider background ` +
              `${bg.raw} → ${bg.literal} = ${ratio.toFixed(2)}:1 (< ${MIN_WAVE_CONTRAST}:1)`
          );
        }
      } catch (err) {
        failures.push(`${col} ${mode}: ${(err as Error).message}`);
      }
    }
    expect(
      failures,
      `the four changed --slider-color declarations must clear 3:1 against the slider ` +
        `background (pre-fix values were ≈1.19–1.65:1 — nearly invisible):\n` +
        report.join('\n') +
        `\nFailures:\n${failures.join('\n')}`
    ).toEqual([]);
  });
});
