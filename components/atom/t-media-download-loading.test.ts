import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MediaItem } from './t-media.js';

/**
 * Album-art download spinner contract for t-media (spec Option A):
 *  - downloaded === false → `.album-art` contains a <t-loading> spinner and
 *    NEITHER the <img> nor the <t-icon> (the spinner wins even when
 *    `albumArt` is set),
 *  - downloaded === true (default) → unchanged: <img> when `albumArt`,
 *    otherwise <t-icon name="note"> / <t-icon name="movie-tape"> per `isVideo`,
 *    and NO spinner,
 *  - the bottom `.download-progress-bar` stays exactly as-is ("Pending
 *    download" for downloadProgress = -1, "Downloading 42%" for 42),
 *  - a rule in `static styles` sizes the spinner inside the 40x40 album-art
 *    box (`.album-art t-loading` setting `--t-loading-size`), no inline styles.
 *
 * NOTE: `syncing` stays false throughout so the separate syncing badge
 * (which also renders a <t-loading>) never interferes with these queries.
 */
describe('t-media album-art download spinner (downloaded flag)', () => {
  let element: MediaItem;

  beforeEach(async () => {
    element = new MediaItem();
    document.body.appendChild(element);
    await element.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  /** Album-art box contents as observed in the row's shadow root. */
  function getAlbumArtState() {
    const box = element.shadowRoot?.querySelector('.album-art') ?? null;
    return {
      box,
      spinner: box?.querySelector('t-loading') ?? null,
      icon: box?.querySelector('t-icon') ?? null,
      img: box?.querySelector('img') ?? null,
      allSpinners: Array.from(element.shadowRoot?.querySelectorAll('t-loading') ?? []),
    };
  }

  function getIconName(): string | null {
    const { icon } = getAlbumArtState();
    return icon ? icon.getAttribute('name') : null;
  }

  function getDownloadProgressBar(): Element | null {
    return element.shadowRoot?.querySelector('.download-progress-bar') ?? null;
  }

  it('downloaded=false: .album-art shows only the spinner (no icon/img)', async () => {
    element.downloaded = false;
    await element.updateComplete;

    expect(customElements.get('t-loading'), 't-media must import t-loading').toBeTruthy();

    const { box, spinner, icon, img, allSpinners } = getAlbumArtState();
    expect(box, '.album-art box must still render').toBeTruthy();
    expect(spinner, 'spinner must replace the icon while the song is not downloaded').toBeTruthy();
    expect(icon, 't-icon must not render next to the spinner').toBeNull();
    expect(img, 'img must not render next to the spinner').toBeNull();

    // Exactly one spinner in the whole row, and it lives inside .album-art.
    expect(allSpinners, 'no stray spinner outside the album-art box').toHaveLength(1);
    expect(allSpinners[0], 'the only spinner must be the album-art one').toBe(spinner);

    // Spinner sizing belongs in static styles, never on the element itself.
    expect(spinner?.hasAttribute('style'), 'no inline style on the spinner').toBe(false);
    expect(box?.hasAttribute('style'), 'no inline style on the album-art box').toBe(false);
  });

  it('downloaded=false + albumArt: spinner takes precedence over <img>', async () => {
    element.albumArt = 'data:image/png;base64,x';
    element.downloaded = false;
    await element.updateComplete;

    const { spinner, img, icon } = getAlbumArtState();
    expect(spinner, 'spinner wins even when the album art is already known').toBeTruthy();
    expect(img, 'no <img> while the song is not downloaded').toBeNull();
    expect(icon, 'no fallback icon while the song is not downloaded').toBeNull();
  });

  it('static styles contain a .album-art t-loading rule setting --t-loading-size', () => {
    const cssText = MediaItem.styles.cssText;
    const albumArtSpinnerRule =
      /\.album-art[^{}]*\bt-loading\b[^{}]*\{[^}]*--t-loading-size[^}]*\}/;
    expect(
      albumArtSpinnerRule.test(cssText),
      'static styles must contain a `.album-art t-loading { --t-loading-size: … }` rule'
    ).toBe(true);
  });

  it('default (downloaded=true): no spinner, t-icon name="note" unchanged', async () => {
    expect(element.downloaded, 'downloaded must default to true').toBe(true);

    const { spinner, icon, img } = getAlbumArtState();
    expect(spinner, 'no spinner when the song is downloaded').toBeNull();
    expect(img, 'no album-art image without albumArt').toBeNull();
    expect(icon, 'fallback t-icon must render').toBeTruthy();
    expect(getIconName(), 'note icon for non-video songs').toBe('note');
  });

  it('downloaded=true with albumArt: <img> renders, still no spinner', async () => {
    element.albumArt = 'data:image/png;base64,x';
    await element.updateComplete;

    const { spinner, img, icon } = getAlbumArtState();
    expect(spinner, 'no spinner when the song is downloaded').toBeNull();
    expect(img, 'album-art image must render when downloaded').toBeTruthy();
    expect(img?.getAttribute('src')).toBe('data:image/png;base64,x');
    expect(icon, 'no fallback icon when albumArt is set').toBeNull();
  });

  it('downloaded=false + downloadProgress=-1: "Pending download" bar', async () => {
    element.downloaded = false;
    element.downloadProgress = -1;
    await element.updateComplete;

    const bar = getDownloadProgressBar();
    expect(bar, 'the download progress bar must stay with Option A').toBeTruthy();
    expect(bar?.textContent ?? '').toContain('Pending download');
    expect(bar?.querySelector('.progress-label')?.textContent ?? '').toContain('Pending download');
  });

  it('downloaded=false + downloadProgress=42: "Downloading 42%" bar', async () => {
    element.downloaded = false;
    element.downloadProgress = 42;
    await element.updateComplete;

    const bar = getDownloadProgressBar();
    expect(bar, 'the download progress bar must stay with Option A').toBeTruthy();
    expect(bar?.querySelector('.progress-label')?.textContent ?? '').toContain('Downloading 42%');
  });

  it('flipping downloaded back to true: spinner gone, t-icon back, bar gone', async () => {
    element.downloaded = false;
    await element.updateComplete;

    element.downloaded = true;
    await element.updateComplete;

    const { spinner, icon, img } = getAlbumArtState();
    expect(spinner, 'spinner must disappear once the song is downloaded').toBeNull();
    expect(img, 'still no album art image').toBeNull();
    expect(icon, 'fallback t-icon must come back').toBeTruthy();
    expect(getIconName()).toBe('note');
    expect(getDownloadProgressBar(), 'no progress bar once downloaded').toBeNull();
  });
});
