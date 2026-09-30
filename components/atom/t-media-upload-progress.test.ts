import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MediaItem } from './t-media.js';

/**
 * The (not yet added) upload progress API on t-media:
 * -2 = not tracked/done, -1 = queued, 0-100 = uploading %.
 */
type MediaItemWithUpload = { uploadProgress: number };

describe('t-media upload progress bar', () => {
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

  /** Any progress bar in the row — works whether the class is
   *  .download-progress-bar (reused) or .upload-progress-bar (new). */
  const getProgressBars = (): Element[] => {
    if (!el.shadowRoot) return [];
    return Array.from(el.shadowRoot.querySelectorAll('[class*="progress-bar"]'));
  };

  const setUploadProgress = (percent: number) => {
    (el as unknown as MediaItemWithUpload).uploadProgress = percent;
  };

  it('defaults uploadProgress to -2 (not tracked/done) and renders no upload bar', async () => {
    await el.updateComplete;

    // Default value is part of the spec: -2 means "not tracked / done".
    expect((el as unknown as MediaItemWithUpload).uploadProgress).toBe(-2);

    const text = el.shadowRoot?.textContent ?? '';
    expect(text).not.toContain('Uploading');
    expect(text).not.toContain('Pending upload');
    expect(getProgressBars()).toHaveLength(0);
  });

  it('renders "Uploading 42%" when uploadProgress=42 even when downloaded=true', async () => {
    await el.updateComplete;

    el.downloaded = true;
    setUploadProgress(42);
    await el.updateComplete;

    // Unlike the download bar (which only shows when !downloaded), the upload
    // bar must render regardless of `downloaded`.
    expect(el.downloaded).toBe(true);
    expect(el.shadowRoot?.textContent).toContain('Uploading 42%');
  });

  it('renders "Pending upload" when uploadProgress=-1 (queued)', async () => {
    await el.updateComplete;

    setUploadProgress(-1);
    await el.updateComplete;

    expect(el.shadowRoot?.textContent).toContain('Pending upload');
  });

  it('upload takes precedence: only one bar per row when download and upload would both show', async () => {
    await el.updateComplete;

    el.downloaded = false;
    el.downloadProgress = 50;
    setUploadProgress(42);
    await el.updateComplete;

    const bars = getProgressBars();
    expect(bars).toHaveLength(1);
    expect(bars[0].textContent).toContain('Uploading 42%');
    expect(el.shadowRoot?.textContent).not.toContain('Downloading');
  });
});
