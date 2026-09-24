import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MediaParent } from './t-media-parent.js';

// ---------------------------------------------------------------------------
// Mock the album-art helper (same as t-media-parent-download.test.ts) so the
// import graph of t-media-parent loads without side effects.
// ---------------------------------------------------------------------------

const extractAlbumArtSpy = vi.hoisted(() => vi.fn(async (_songKey: string) => {}));
vi.mock('../../utils/album-art.js', () => ({
  extractAlbumArt: extractAlbumArtSpy,
}));

/**
 * The (not yet added) upload progress API on t-media-parent:
 * a per-song Map fed by bubbling `song-upload-progress` CustomEvents,
 * exposed via getUploadProgress/_getUploadProgressMap for list rendering.
 */
type MediaParentWithUpload = {
  getUploadProgress(songKey: string): number;
  _getUploadProgressMap(): Record<string, number>;
};

describe('t-media-parent song-upload-progress handling', () => {
  let element: MediaParent;

  beforeEach(() => {
    extractAlbumArtSpy.mockClear();
    vi.spyOn(
      MediaParent.prototype as unknown as { _loadSongs: () => Promise<void> },
      '_loadSongs'
    ).mockResolvedValue(undefined);

    element = new MediaParent();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  /** Let the async connectedCallback chain (listener registration) settle. */
  const flushConnection = () => new Promise((resolve) => setTimeout(resolve, 0));

  const dispatchProgress = (songKey: string, percent: number) => {
    element.dispatchEvent(
      new CustomEvent('song-upload-progress', {
        detail: { songKey, percent },
        bubbles: true,
        composed: true,
      })
    );
  };

  it('records percent from a bubbling song-upload-progress event', async () => {
    await element.updateComplete;
    await flushConnection();

    dispatchProgress('track.mp3', 42);

    const upload = element as unknown as MediaParentWithUpload;
    expect(upload.getUploadProgress('track.mp3')).toBe(42);
    expect(upload._getUploadProgressMap()).toEqual({ 'track.mp3': 42 });
  });

  it('clears the entry when percent is -1 (done/failed) so the bar disappears', async () => {
    await element.updateComplete;
    await flushConnection();

    dispatchProgress('track.mp3', 42);
    dispatchProgress('track.mp3', -1);

    const upload = element as unknown as MediaParentWithUpload;
    // Absent keys report -2 ("not tracked/done"), mirroring getDownloadProgress.
    expect(upload.getUploadProgress('track.mp3')).toBe(-2);
    expect(upload._getUploadProgressMap()).toEqual({});
  });

  it('passes the upload progress map down to the rendered t-track-list', async () => {
    await element.updateComplete;
    await flushConnection();

    (element as unknown as { songs: unknown[] }).songs = [
      { songKey: 'track.mp3', title: 'Track', downloaded: true },
    ];
    (element as unknown as { groups: unknown[] }).groups = [];
    await element.updateComplete;

    dispatchProgress('track.mp3', 42);
    await element.updateComplete;

    const trackList = element.shadowRoot?.querySelector('t-track-list');
    expect(trackList).toBeTruthy();
    const map = (trackList as unknown as { uploadProgressMap?: Record<string, number> })
      .uploadProgressMap;
    expect(map).toEqual({ 'track.mp3': 42 });
  });
});
