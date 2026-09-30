import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MediaItem } from './t-media.js';

describe('t-media slim attribute', () => {
  let el: MediaItem;

  beforeEach(() => {
    el = new MediaItem();
    document.body.appendChild(el);
  });

  afterEach(() => {
    if (document.body.contains(el)) {
      document.body.removeChild(el);
    }
  });

  it('defaults slim to false', async () => {
    await el.updateComplete;

    expect((el as any).slim).toBe(false);
  });

  it('reflects slim=true as an attribute', async () => {
    (el as any).slim = true;
    await el.updateComplete;

    expect(el.hasAttribute('slim')).toBe(true);

    (el as any).slim = false;
    await el.updateComplete;

    expect(el.hasAttribute('slim')).toBe(false);
  });

  it('has a :host([slim]) CSS rule', () => {
    const cssText = (MediaItem.styles as unknown as { cssText: string }).cssText;

    expect(cssText).toContain(':host([slim])');
  });

  it('slim CSS compacts the row but keeps info-column / play-stats visible', () => {
    const cssText = (MediaItem.styles as unknown as { cssText: string }).cssText;

    // Compact row: smaller .media-container padding/gap, smaller .album-art.
    expect(cssText).toContain(':host([slim]) .media-container');
    expect(cssText).toContain(':host([slim]) .album-art');
    // Metadata stays visible in slim mode: no display:none on info/stats.
    expect(cssText).not.toContain(':host([slim]) .info-column');
    expect(cssText).not.toContain(':host([slim]) .play-stats');
  });

  it('slim row has 6px top padding (padding: 6px 8px 4px)', () => {
    const cssText = (MediaItem.styles as unknown as { cssText: string }).cssText;

    const hasShorthand = cssText.includes('padding: 6px 8px 4px');
    const hasLonghand = /:host\(\[slim\]\) \.media-container[^}]*padding-top:\s*6px/.test(
      cssText
    );
    expect(hasShorthand || hasLonghand).toBe(true);
  });

  it('slim row has 4px bottom padding (padding: 6px 8px 4px)', () => {
    const cssText = (MediaItem.styles as unknown as { cssText: string }).cssText;

    const hasShorthand = cssText.includes('padding: 6px 8px 4px');
    const hasLonghand =
      /:host\(\[slim\]\) \.media-container[^}]*padding-bottom:\s*4px/.test(cssText);
    expect(hasShorthand || hasLonghand).toBe(true);
  });
});
