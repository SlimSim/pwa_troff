import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TLoading } from './t-loading.js';

describe('t-loading', () => {
  let element: TLoading;

  beforeEach(() => {
    element = new TLoading();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  function getCssText(): string {
    const ctor = element.constructor as typeof TLoading;
    const styles = ctor.styles;
    if (!styles) return '';
    const list = Array.isArray(styles) ? styles : [styles];
    return list.map((s) => String(s)).join('\n');
  }

  function getReducedBlock(cssText: string): string {
    return cssText.split('prefers-reduced-motion').slice(1).join('\n');
  }

  function findKeyframeBlock(cssText: string, namePattern: RegExp): string {
    const headerRe = /@keyframes\s+([A-Za-z0-9_-]+)\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = headerRe.exec(cssText)) !== null) {
      const name = m[1] ?? '';
      if (namePattern.test(name)) {
        const start = m.index;
        const nextAt = cssText.indexOf('@keyframes', start + 1);
        const nextMedia = cssText.indexOf('@media', start + 1);
        let end = cssText.length;
        if (nextAt !== -1) end = Math.min(end, nextAt);
        if (nextMedia !== -1) end = Math.min(end, nextMedia);
        return cssText.slice(start, end);
      }
    }
    return '';
  }

  function distinctPxMagnitudes(block: string): number[] {
    const nums: number[] = [];
    const re = /(-?\d+(?:\.\d+)?)\s*px/g;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(block)) !== null) {
      nums.push(Math.abs(Number(mm[1])));
    }
    return Array.from(new Set(nums)).sort((a, b) => a - b);
  }



  it('registers as t-loading custom element', async () => {
    await element.updateComplete;
    expect(customElements.get('t-loading')).toBeTruthy();
    expect(element).toBeInstanceOf(TLoading);
    expect(element.tagName.toLowerCase()).toBe('t-loading');
  });

  it('shadow renders inline SVG with distinct cup and spoon groups', async () => {
    await element.updateComplete;
    const svg = element.shadowRoot?.querySelector('svg');
    expect(svg).toBeTruthy();
    const cup = element.shadowRoot?.querySelector('.cup, #cup');
    const spoon = element.shadowRoot?.querySelector('.spoon, #spoon');
    expect(cup).toBeTruthy();
    expect(spoon).toBeTruthy();
    expect(cup).not.toBe(spoon);
  });

  it('spoon uses nested dual-ellipse orbit wrappers (top wide + bottom tight)', async () => {
    await element.updateComplete;
    const cssText = getCssText();
    const topWrapper = element.shadowRoot?.querySelector(
      '.spoon-top, .spoon-tilt',
    );
    const bottomWrapper = element.shadowRoot?.querySelector(
      '.spoon-orbit, .spoon-bottom',
    );
    expect(
      topWrapper,
      'expected inner spoon motion wrapper .spoon-top/.spoon-tilt',
    ).toBeTruthy();
    expect(
      bottomWrapper,
      'expected outer spoon motion wrapper .spoon-orbit/.spoon-bottom',
    ).toBeTruthy();
    // Nested around the single logo spoon path (outer wraps inner wraps path).
    const spoonPath = '406.21364,415.86345';
    const topHtml = topWrapper?.outerHTML ?? '';
    const bottomHtml = bottomWrapper?.outerHTML ?? '';
    expect(
      topHtml.includes(spoonPath) || bottomHtml.includes(spoonPath),
      'expected spoon logo path nested inside orbit wrappers',
    ).toBe(true);
    const nested =
      (topWrapper && bottomWrapper
        ? topWrapper.contains(bottomWrapper) ||
          bottomWrapper.contains(topWrapper)
        : false) ||
      topHtml.includes(spoonPath) ||
      bottomHtml.includes(spoonPath);
    expect(nested).toBe(true);
    // Both wrappers need fill-box + explicit origin for WebKit + Chromium.
    expect(cssText).toMatch(
      /\.spoon-(top|tilt)[^}]*transform-box\s*:\s*fill-box/is,
    );
    expect(cssText).toMatch(
      /\.spoon-(top|tilt)[^}]*transform-origin\s*:/is,
    );
    expect(cssText).toMatch(
      /\.spoon-(orbit|bottom)[^}]*transform-box\s*:\s*fill-box/is,
    );
    expect(cssText).toMatch(
      /\.spoon-(orbit|bottom)[^}]*transform-origin\s*:/is,
    );
  });

  it('spoon top traces WIDE upper ellipse via rotate+scale tilt (red rim orbit)', async () => {
    await element.updateComplete;
    const cssText = getCssText();
    const topBlock = findKeyframeBlock(
      cssText,
      /spoon-top|spoon-tilt|orbit-red|swirl-top|stir-top|orbit-top/i,
    );
    expect(
      topBlock,
      'expected top/tilt keyframes (e.g. spoon-tilt)',
    ).toBeTruthy();
    expect(cssText).toMatch(/\.spoon-top|\.spoon-tilt/);
    expect(cssText).toMatch(/\.spoon-(top|tilt)[^}]*animation\s*:/is);
    // Differential top motion: rotate + scale about the spoon-bottom pivot.
    // A rigid translate would move top and bottom identically (same ellipse).
    expect(topBlock).toMatch(/rotate\(/);
    expect(topBlock).toMatch(/scale\(/);
    expect(topBlock).not.toMatch(/360deg/);
    // Wide sweep: substantial rotate swing across one lap (>= 30deg).
    const angles = Array.from(
      topBlock.matchAll(/rotate\(\s*(-?\d+(?:\.\d+)?)\s*deg/g),
    ).map((m) => Number(m[1]));
    expect(angles.length).toBeGreaterThanOrEqual(2);
    const swing = Math.max(...angles) - Math.min(...angles);
    expect(swing).toBeGreaterThanOrEqual(30);
    // Scale stays near 1 so the spoon still reads as a solid object.
    const scales = Array.from(
      topBlock.matchAll(/scale\(\s*(-?\d+(?:\.\d+)?)\s*\)/g),
    ).map((m) => Number(m[1]));
    expect(scales.length).toBeGreaterThanOrEqual(2);
    for (const s of scales) {
      expect(s).toBeGreaterThan(0.6);
      expect(s).toBeLessThan(1.5);
    }
    // Pivot at the spoon-bottom fill-box corner (WebKit + Chromium safe).
    expect(cssText).toMatch(
      /\.spoon-(top|tilt)[^}]*transform-origin\s*:\s*\d+(?:\.\d+)?%/is,
    );
  });

  it('spoon bottom traces SMALL lower ellipse (green liquid orbit) via translate', async () => {
    await element.updateComplete;
    const cssText = getCssText();
    const bottomBlock = findKeyframeBlock(
      cssText,
      /spoon-orbit|spoon-bottom|orbit-green|swirl-bottom|stir-bottom|orbit-bottom/i,
    );
    expect(
      bottomBlock,
      'expected bottom/orbit keyframes (e.g. spoon-orbit)',
    ).toBeTruthy();
    expect(cssText).toMatch(/\.spoon-orbit|\.spoon-bottom/);
    expect(cssText).toMatch(/\.spoon-(orbit|bottom)[^}]*animation\s*:/is);
    expect(bottomBlock).toMatch(/translateX|translate\(/i);
    expect(bottomBlock).toMatch(/translateY|translate\([^)]*,/i);
    const mags = distinctPxMagnitudes(bottomBlock);
    expect(mags.length).toBeGreaterThanOrEqual(2);
    // Ellipse, not a line: both axes move, X wider than Y (rx > ry),
    // and the orbit stays tight inside the glass rim (rx ~ 110).
    const translates = Array.from(
      bottomBlock.matchAll(
        /translate\(\s*(-?\d+(?:\.\d+)?)\s*px\s*,\s*(-?\d+(?:\.\d+)?)\s*px\s*\)/g,
      ),
    ).map((m) => [Number(m[1]), Number(m[2])] as const);
    expect(translates.length).toBeGreaterThanOrEqual(4);
    const xs = translates.map(([x]) => x);
    const ys = translates.map(([, y]) => y);
    const rangeX = Math.max(...xs) - Math.min(...xs);
    const rangeY = Math.max(...ys) - Math.min(...ys);
    expect(rangeX).toBeGreaterThan(0);
    expect(rangeY).toBeGreaterThan(0);
    expect(rangeX).toBeGreaterThan(rangeY);
    expect(rangeX / 2).toBeLessThan(110);
  });

  it('spoon orbits share synchronized lap duration (same linear infinite, no alternate rock)', async () => {
    await element.updateComplete;
    const cssText = getCssText();
    expect(cssText).not.toContain('360deg');
    expect(cssText).not.toMatch(/infinite\s+alternate/);
    const sharedVar = cssText.match(
      /--(stir-duration|orbit-duration|swirl-duration|spoon-duration)\s*:\s*(\d+(?:\.\d+)?s)/i,
    );
    if (sharedVar) {
      const varName = sharedVar[1] as string;
      expect(cssText).toMatch(
        new RegExp(
          `\\.spoon-(orbit|bottom)[^}]*var\\(--${varName}\\)`,
          'is',
        ),
      );
      expect(cssText).toMatch(
        new RegExp(`\\.spoon-(top|tilt)[^}]*var\\(--${varName}\\)`, 'is'),
      );
    } else {
      const topRule =
        cssText.match(/\.spoon-(top|tilt)[^}]*animation[^;]*;/is)?.[0] ?? '';
      const bottomRule =
        cssText.match(/\.spoon-(orbit|bottom)[^}]*animation[^;]*;/is)?.[0] ??
        '';
      expect(topRule, 'expected animation on .spoon-top/.spoon-tilt').toBeTruthy();
      expect(
        bottomRule,
        'expected animation on .spoon-orbit/.spoon-bottom',
      ).toBeTruthy();
      const topDur = topRule.match(/(\d+(?:\.\d+)?s)/)?.[1];
      const bottomDur = bottomRule.match(/(\d+(?:\.\d+)?s)/)?.[1];
      expect(topDur).toBeTruthy();
      expect(bottomDur).toBeTruthy();
      expect(bottomDur).toBe(topDur);
    }
    expect(cssText).toMatch(
      /\.spoon-(top|tilt)[^}]*linear[^}]*infinite/is,
    );
    expect(cssText).toMatch(
      /\.spoon-(orbit|bottom)[^}]*linear[^}]*infinite/is,
    );
  });

  it('disables all spoon motion wrappers under prefers-reduced-motion', async () => {
    await element.updateComplete;
    const cssText = getCssText();
    expect(cssText).toMatch(/prefers-reduced-motion\s*:\s*reduce/);
    const reducedBlock = getReducedBlock(cssText);
    expect(reducedBlock).toMatch(/\.spoon-orbit|\.spoon-bottom/);
    expect(reducedBlock).toMatch(/\.spoon-top|\.spoon-tilt/);
    expect(reducedBlock).toMatch(/animation\s*:\s*none|animation-name\s*:\s*none/);
  });

  it('is monochrome currentColor with transparent background (no blue rect, no gradients)', async () => {
    await element.updateComplete;
    const cssText = getCssText();
    const shadowHtml = element.shadowRoot?.innerHTML ?? '';
    const combined = `${cssText}\n${shadowHtml}`;
    expect(combined).toContain('currentColor');
    expect(combined).not.toContain('#003366');
    expect(combined).not.toContain('003366');
    expect(shadowHtml).not.toMatch(/linearGradient|radialGradient/i);
    expect(combined).not.toMatch(/url\(#/);
  });

  it('is scalable via CSS (host sizing / --t-loading-size var)', async () => {
    await element.updateComplete;
    const cssText = getCssText();
    expect(cssText).toContain(':host');
    expect(cssText).toMatch(/--t-loading-size|1em/);
  });

  it('exposes role=status and a default + overridable accessible label', async () => {
    await element.updateComplete;
    const statusEl =
      element.shadowRoot?.querySelector('[role="status"], [aria-live]');
    const hostRole = element.getAttribute('role');
    expect(statusEl !== null || hostRole === 'status').toBe(true);
    const initialText = (element.shadowRoot?.textContent ?? '').toLowerCase();
    expect(initialText).toContain('loading');
    element.label = 'Fetching songs';
    await element.updateComplete;
    expect(element.shadowRoot?.textContent ?? '').toContain('Fetching songs');
  });

  it('disables every spoon orbit wrapper animation under prefers-reduced-motion', async () => {
    await element.updateComplete;
    const cssText = getCssText();
    expect(cssText).toMatch(/prefers-reduced-motion\s*:\s*reduce/);
    const reducedBlock = getReducedBlock(cssText);
    expect(reducedBlock).toMatch(/\.spoon-orbit|\.spoon-bottom/);
    expect(reducedBlock).toMatch(/\.spoon-top|\.spoon-tilt/);
    expect(reducedBlock).toMatch(/animation\s*:\s*none|animation-name\s*:\s*none/);
  });

  it('uses actual logo path data (multiple paths plus ellipse rim)', async () => {
    await element.updateComplete;
    const shadowHtml = element.shadowRoot?.innerHTML ?? '';
    const paths = Array.from(
      element.shadowRoot?.querySelectorAll('path') ?? [],
    );
    const ellipses = Array.from(
      element.shadowRoot?.querySelectorAll('ellipse') ?? [],
    );
    expect(paths.length).toBeGreaterThanOrEqual(3);
    expect(ellipses.length).toBeGreaterThanOrEqual(1);
    const dData = paths.map((p) => p.getAttribute('d') ?? '').join(' ');
    const snippets = [
      '247.88106,536.82523',
      '418.28486,410.40947',
      '406.21364,415.86345',
      '276.95735,427.64205',
    ];
    const hits = snippets.filter(
      (s) => shadowHtml.includes(s) || dData.includes(s),
    );
    expect(hits.length).toBeGreaterThanOrEqual(3);
    expect(dData.length).toBeGreaterThan(800);
  });

  it('spoon/cup groups carry logo artwork and viewBox preserves logo proportions', async () => {
    await element.updateComplete;
    const svg = element.shadowRoot?.querySelector('svg');
    const cup = element.shadowRoot?.querySelector('.cup, #cup');
    const spoon = element.shadowRoot?.querySelector('.spoon, #spoon');
    const cupHtml = cup?.outerHTML ?? '';
    const spoonHtml = spoon?.outerHTML ?? '';
    expect(spoonHtml).toContain('406.21364,415.86345');
    expect(cupHtml).toContain('276.95735,427.64205');
    expect(svg?.getAttribute('viewBox')).toContain('289.64');
    expect(svg?.getAttribute('viewBox')).not.toBe('0 0 24 24');
  });

  it('drops logo background rect and Inkscape cruft', async () => {
    await element.updateComplete;
    const shadowHtml = element.shadowRoot?.innerHTML ?? '';
    const cssText = getCssText();
    expect(element.shadowRoot?.querySelector('rect')).toBeNull();
    expect(`${cssText}\n${shadowHtml}`).not.toMatch(/inkscape|sodipodi/i);
    expect(shadowHtml).not.toMatch(/<metadata|<defs/i);
  });
});
