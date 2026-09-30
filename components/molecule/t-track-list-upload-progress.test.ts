import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TrackList } from './t-track-list.js';

/** The (not yet added) upload progress map property on the list components. */
type TrackListWithUpload = { uploadProgressMap: Record<string, number> };
/** The (not yet added) upload progress property on t-media rows. */
type MediaItemWithUpload = { uploadProgress: number };

describe('t-track-list uploadProgressMap forwarding', () => {
  let element: TrackList;

  beforeEach(() => {
    element = new TrackList();
    document.body.appendChild(element);
    element.tracks = [{ songKey: 'track.mp3', title: 'Track', downloaded: true }];
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  it('forwards the uploadProgressMap entry to the t-media row', async () => {
    await element.updateComplete;

    // Set AFTER the initial render so the test also requires the map to be a
    // reactive @property (a plain field would never re-run the bindings).
    (element as unknown as TrackListWithUpload).uploadProgressMap = { 'track.mp3': 42 };
    await element.updateComplete;

    const media = element.shadowRoot?.querySelector('t-media');
    expect(media).toBeTruthy();
    expect((media as unknown as MediaItemWithUpload).uploadProgress).toBe(42);
  });

  it('forwards -2 when the song has no entry in the map', async () => {
    await element.updateComplete;

    const media = element.shadowRoot?.querySelector('t-media');
    expect(media).toBeTruthy();
    expect((media as unknown as MediaItemWithUpload).uploadProgress).toBe(-2);
  });
});
