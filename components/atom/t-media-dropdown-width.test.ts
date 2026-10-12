import { describe, it, expect } from 'vitest';
import { MediaItem } from './t-media.js';

/**
 * REGRESSION SPEC (song-row dropdown overflow):
 *
 * The song-row dropdown content `.status-box[slot=dropdown]` (inside
 * `t-dropdown-button`, whose panel renders `position: fixed` with
 * `min-width: 180px` and NO max-width) gained a `More` section with a
 * collapsed `span.dropdown-info-text[data-song-info]`
 * (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`).
 *
 * BUG: with a LONG song note, the collapsed nowrap info text has NO width
 * constraint and neither does `.status-box`, so the fixed-position dropdown
 * panel stretches wider than the viewport instead of truncating.
 *
 * Expected fix (CSS-only, in `t-media.ts` static styles):
 * - Constrain `.status-box` with a viewport-based `max-width` (using `100vw`)
 *   plus `overflow: hidden` so it can never exceed the viewport.
 * - Cap `.dropdown-info-text` (collapsed) at `max-width: 100%` so nowrap
 *   truncates instead of stretching the panel.
 * - Make `.dropdown-info-text.expanded` wrap long unbroken strings
 *   (`overflow-wrap: anywhere` / `break-word` or `word-break: break-word`).
 *
 * CSS-contract precedent (happy-dom does not resolve shadow styles
 * reliably): assert against the ACTUAL `MediaItem.styles` cssText, scoped
 * per-selector like `t-media-status-remove.test.ts`.
 *
 * These tests import the ACTUAL component (never re-implementations) and
 * FAIL (RED) until the fix lands.
 */

/** The component stylesheet as text (repo precedent: cssText assertions). */
function mediaCssText(): string {
  return (MediaItem.styles as unknown as { cssText: string }).cssText;
}

/** Declaration bodies of every rule whose selector matches `selectorPattern`. */
function declarationBlocks(selectorPattern: RegExp): string[] {
  const rulePattern = new RegExp(selectorPattern.source + '[^{}]*\\{([^{}]*)\\}', 'g');
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = rulePattern.exec(mediaCssText())) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

/**
 * Rules whose full selector text matches `selectorPattern`, with the selector
 * and body kept together so expanded-state rules can be told apart from the
 * collapsed base rule.
 */
function ruleEntries(selectorPattern: RegExp): { selector: string; body: string }[] {
  const rulePattern = new RegExp('(' + selectorPattern.source + '[^{}]*)\\{([^{}]*)\\}', 'g');
  const entries: { selector: string; body: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = rulePattern.exec(mediaCssText())) !== null) {
    entries.push({ selector: match[1], body: match[2] });
  }
  return entries;
}

describe('t-media dropdown width regression (long song note overflow)', () => {
  it('.status-box rule caps width to the viewport (max-width with 100vw) and clips overflow', () => {
    const blocks = declarationBlocks(/\.status-box/);
    expect(blocks.length).toBeGreaterThan(0);

    const capped = blocks.filter(
      (block) => /max-width:[^;{}]*100vw/.test(block)
    );
    expect(
      capped.length,
      '.status-box must declare a viewport-based max-width (e.g. max-width: min(300px, calc(100vw - 32px)))'
    ).toBeGreaterThan(0);
    expect(
      capped.some((block) => /overflow:\s*hidden/.test(block)),
      '.status-box max-width rule must also clip with overflow: hidden'
    ).toBe(true);
  });

  it('.dropdown-info-text (collapsed) cannot force growth (max-width: 100%)', () => {
    const collapsed = ruleEntries(/\.dropdown-info-text/).filter(
      (entry) => !/\.expanded/.test(entry.selector) && !/:hover/.test(entry.selector)
    );
    expect(collapsed.length).toBeGreaterThan(0);

    expect(
      collapsed.some((entry) => /max-width:[^;{}]*100%/.test(entry.body)),
      '.dropdown-info-text collapsed rule must declare max-width: 100% so nowrap truncates instead of stretching'
    ).toBe(true);
  });

  it('.dropdown-info-text.expanded wraps long unbroken strings', () => {
    const expanded = ruleEntries(/\.dropdown-info-text\.expanded/);
    expect(expanded.length).toBeGreaterThan(0);

    expect(
      expanded.some(
        (entry) =>
          /overflow-wrap:[^;{}]*(anywhere|break-word)/.test(entry.body) ||
          /word-break:\s*break-word/.test(entry.body)
      ),
      '.dropdown-info-text.expanded must wrap long unbroken strings (overflow-wrap: anywhere/break-word or word-break: break-word)'
    ).toBe(true);
  });
});
