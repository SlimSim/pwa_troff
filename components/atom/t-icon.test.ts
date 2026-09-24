import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TIcon } from './t-icon.js';

describe('t-icon loading state uses <t-loading> (not inline circle spinner)', () => {
  let element: TIcon;

  beforeEach(() => {
    element = new TIcon();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function getCssText(): string {
    const ctor = element.constructor as typeof TIcon;
    const styles = ctor.styles;
    if (!styles) return '';
    const list = Array.isArray(styles) ? styles : [styles];
    return list.map((s) => String(s)).join('\n');
  }

  it('before icon load, shadow contains t-loading and no old circle spinner svg', async () => {
    await element.updateComplete;

    const shadow = element.shadowRoot;
    expect(shadow, 't-icon should have a shadow root').toBeTruthy();

    // (a) target: <t-loading> replaces the inline spinner
    expect(
      shadow?.querySelector('t-loading'),
      'expected t-loading in shadow DOM before the icon loads',
    ).toBeTruthy();

    // (a) old inline circle spinner must be gone
    expect(
      shadow?.querySelector('svg.spinner'),
      'old svg.spinner circle must not render',
    ).toBeNull();
    expect(
      shadow?.querySelector('circle[r="10"]'),
      'old circle[r="10"] spinner must not render',
    ).toBeNull();
  });

  it('static styles no longer include .spinner / @keyframes spin for the old circle', async () => {
    await element.updateComplete;

    const cssText = getCssText();
    expect(cssText).toBeTruthy();
    // (b) old spinner CSS removed from t-icon itself
    // (t-loading owns its own styles in its own component)
    expect(
      cssText,
      't-icon styles must not define the old .spinner rule',
    ).not.toMatch(/\.spinner\b/);
    expect(
      cssText,
      't-icon styles must not define the old @keyframes spin',
    ).not.toMatch(/@keyframes\s+spin\b/);
    expect(cssText).not.toMatch(/animation\s*:\s*spin\b/);
  });

  it('after fetch resolves, shadow shows the real icon svg and no t-loading', async () => {
    const markerPath = 'M10 10h4v4h-4z';
    const svgText =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
      `<path d="${markerPath}"></path></svg>`;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => svgText,
      }),
    );

    element.name = 'play';
    await element.updateComplete;

    // updated() fetches asynchronously, then calls requestUpdate()
    await vi.waitFor(() => {
      expect(
        element.shadowRoot?.querySelector('path'),
        'expected real icon path after fetch resolves',
      ).toBeTruthy();
    });

    const shadow = element.shadowRoot;
    // (c) real icon content rendered, loading indicator gone
    const path = shadow?.querySelector('path');
    expect(path?.getAttribute('d')).toBe(markerPath);
    expect(shadow?.querySelector('t-loading')).toBeNull();

    // existing behavior preserved: old spinner never appears either
    expect(shadow?.querySelector('svg.spinner')).toBeNull();
    expect(shadow?.querySelector('circle[r="10"]')).toBeNull();

    expect(fetch).toHaveBeenCalledWith('/assets/icons/play.svg');
  });
});
