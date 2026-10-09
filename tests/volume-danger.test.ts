import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Dial } from '../components/atom/t-dial.js';
import { BottomNav } from '../components/molecule/t-footer.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * FEATURE SPEC: Volume >100% danger styling
 *
 * Volume is now 0-420% (services/audio.ts MAX 420). Danger color convention is
 * var(--accent-color-2, #dd2c00) / var(--important-button, #dd2c00) — see
 * stylesheets/variables-theme.css. No hardcoded new colors; use existing CSS
 * variables.
 *
 * These tests import the ACTUAL components (never re-implementations) so they
 * are RED until the feature lands:
 * 1) t-dial danger display via `dangerWhenOver` (or `danger`) threshold.
 * 2) Footer volume-boost badge when footer.volume > 100.
 * 3) Volume dials wiring in t-footer.ts + t-current-song-controls.ts.
 */

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function readSource(relPath: string): string {
  return readFileSync(path.join(repoRoot, relPath), 'utf8');
}

type DialWithDangerApi = Dial & {
  dangerWhenOver?: number;
  danger?: boolean;
};

function setDangerThreshold(dial: Dial, threshold: number): void {
  const withDanger = dial as DialWithDangerApi;
  withDanger.dangerWhenOver = threshold;
  withDanger.danger = true;
}

function setDangerOff(dial: Dial, threshold: number): void {
  const withDanger = dial as DialWithDangerApi;
  withDanger.dangerWhenOver = threshold;
  withDanger.danger = false;
}

function valueDisplayHasDanger(dial: Dial): boolean {
  const display = dial.shadowRoot?.querySelector('.value-display');
  if (!display) {
    return false;
  }
  return (
    display.classList.contains('danger') ||
    display.hasAttribute('danger') ||
    display.hasAttribute('data-danger')
  );
}

function dialKnobHasDanger(dial: Dial): boolean {
  const root = dial.shadowRoot;
  if (!root) {
    return false;
  }
  const knob =
    root.querySelector('.dial-knob.danger') ??
    root.querySelector('.dial-knob[danger]') ??
    root.querySelector('.t-dial-portal-knob.danger') ??
    root.querySelector('.t-dial-portal-value.danger');
  return knob !== null;
}

function findVolumeBadge(footer: BottomNav): Element | null {
  return (
    footer.shadowRoot?.querySelector(
      '[data-testid="volume-boost-badge"], .volume-boost-badge'
    ) ?? null
  );
}

describe('t-dial danger display (volume >100%)', () => {
  let dial: Dial;

  beforeEach(() => {
    dial = new Dial();
    document.body.appendChild(dial);
  });

  afterEach(() => {
    if (document.body.contains(dial)) {
      document.body.removeChild(dial);
    }
  });

  it('exposes a danger threshold API (dangerWhenOver or danger)', async () => {
    await dial.updateComplete;
    const withDanger = dial as DialWithDangerApi;
    const hasThresholdApi =
      'dangerWhenOver' in dial ||
      'danger' in dial ||
      withDanger.dangerWhenOver !== undefined ||
      withDanger.danger !== undefined;
    const src = readSource('components/atom/t-dial.ts');
    const srcHasApi = src.includes('dangerWhenOver') || /[.?[]danger\b/.test(src);
    expect(
      hasThresholdApi || srcHasApi,
      'expected t-dial to expose dangerWhenOver?: number (or danger boolean) ' +
        'so volume dials can flag >100%, but neither property nor source binding exists'
    ).toBe(true);
  });

  it('shows danger on value-display when value 150 exceeds threshold 100', async () => {
    dial.min = 0;
    dial.max = 420;
    setDangerThreshold(dial, 100);
    dial.value = 150;
    await dial.updateComplete;

    const display = dial.shadowRoot?.querySelector('.value-display');
    expect(display, 't-dial must render .value-display').not.toBeNull();
    expect(
      valueDisplayHasDanger(dial),
      'expected .value-display to carry danger indicator (class "danger" or ' +
        'danger attribute) when _value 150 > dangerWhenOver 100'
    ).toBe(true);
  });

  it('does NOT show danger on value-display when value 80 is at/below 100', async () => {
    dial.min = 0;
    dial.max = 420;
    setDangerOff(dial, 100);
    dial.value = 80;
    await dial.updateComplete;

    expect(valueDisplayHasDanger(dial)).toBe(false);
  });

  it('danger styling uses the existing danger variable (accent-color-2 / important-button)', () => {
    const src = readSource('components/atom/t-dial.ts');
    const dangerBlocks = src
      .split('}')
      .filter((block: string) => block.includes('danger'));
    expect(
      dangerBlocks.length,
      'expected t-dial.ts to contain a danger CSS rule (e.g. .value-display.danger)'
    ).toBeGreaterThan(0);
    const usesDangerVariable = dangerBlocks.some(
      (block: string) =>
        block.includes('accent-color-2') || block.includes('important-button')
    );
    expect(
      usesDangerVariable,
      'expected t-dial danger rule to use var(--accent-color-2, #dd2c00) or ' +
        'var(--important-button, #dd2c00) — no hardcoded new colors'
    ).toBe(true);
  });

  it('applies danger to the dial wheel (dial-knob / portal knob)', async () => {
    dial.min = 0;
    dial.max = 420;
    setDangerThreshold(dial, 100);
    dial.value = 150;
    await dial.updateComplete;

    const src = readSource('components/atom/t-dial.ts');
    const srcHasKnobDanger =
      (src.includes('.dial-knob') || src.includes('t-dial-portal-knob')) &&
      src.includes('danger') &&
      (src.includes('accent-color-2') || src.includes('important-button'));
    expect(
      dialKnobHasDanger(dial) || srcHasKnobDanger,
      'expected dial wheel (.dial-knob / .t-dial-portal-knob) to carry danger ' +
        'styling when value 150 > 100, via danger class/attribute + ' +
        'var(--accent-color-2)/var(--important-button) CSS'
    ).toBe(true);
  });
});

describe('footer volume-boost badge (volume >100%)', () => {
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

  it('shows a volume-boost badge with a volume icon when volume is 150', async () => {
    footer.volume = 150;
    await footer.updateComplete;

    const badge = findVolumeBadge(footer);
    expect(
      badge,
      'expected footer to render [data-testid="volume-boost-badge"] / ' +
        '.volume-boost-badge when volume 150 > 100'
    ).not.toBeNull();
    const icon = badge?.querySelector('t-icon[name="volume"]');
    expect(
      icon,
      'expected volume-boost badge to contain <t-icon name="volume">'
    ).not.toBeNull();
  });

  it('hides the volume-boost badge when volume is 80', async () => {
    footer.volume = 80;
    await footer.updateComplete;

    expect(findVolumeBadge(footer)).toBeNull();
  });

  it('badge markup exists in source with danger styling (important / accent-color-2)', () => {
    const src = readSource('components/molecule/t-footer.ts');
    expect(
      src.includes('volume-boost-badge'),
      'expected t-footer.ts to contain volume-boost-badge markup'
    ).toBe(true);
    expect(
      src.includes('name="volume"'),
      'expected volume-boost badge to contain <t-icon name="volume">'
    ).toBe(true);
    const badgeBlocks = src
      .split('}')
      .filter((block: string) => block.includes('volume-boost-badge'));
    const usesDangerStyling =
      src.includes('volume-boost-badge') &&
      (src.includes('important') || src.includes('accent-color-2'));
    expect(
      badgeBlocks.length > 0 || usesDangerStyling,
      'expected volume-boost badge to use danger styling ' +
        '(important / var(--accent-color-2, #dd2c00))'
    ).toBe(true);
  });
});

describe('volume dials wiring (danger threshold)', () => {
  it('t-footer volume t-dial passes danger threshold (dangerWhenOver or danger)', () => {
    const src = readSource('components/molecule/t-footer.ts');
    const volumeDial = src.match(/<t-dial[^>]*label="Volume"[^>]*>/s);
    expect(volumeDial, 'Volume t-dial not found in t-footer.ts').toBeTruthy();
    const block = volumeDial?.[0] ?? '';
    expect(
      block.includes('dangerWhenOver') || block.includes('danger'),
      'expected t-footer Volume t-dial to pass dangerWhenOver="100" ' +
        '(or danger binding) so >100% triggers danger styling'
    ).toBe(true);
  });

  it('t-current-song-controls volume t-dial passes danger threshold (dangerWhenOver or danger)', () => {
    const src = readSource('components/molecule/t-current-song-controls.ts');
    const volumeDial = src.match(/<t-dial[^>]*label="Volume"[^>]*>/s);
    expect(
      volumeDial,
      'Volume t-dial not found in t-current-song-controls.ts'
    ).toBeTruthy();
    const block = volumeDial?.[0] ?? '';
    expect(
      block.includes('dangerWhenOver') || block.includes('danger'),
      'expected t-current-song-controls Volume t-dial to pass dangerWhenOver="100" ' +
        '(or danger binding) so >100% triggers danger styling'
    ).toBe(true);
  });
});
