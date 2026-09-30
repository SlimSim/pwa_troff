import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MediaItem } from './t-media.js';

/**
 * Type-safe view of the (not yet added) `syncing` property on t-media:
 * `@property({ type: Boolean }) syncing = false`. The intersection cast keeps
 * this test file valid both before (RED) and after the feature lands — no `any`,
 * same pattern as t-detail-header-syncing.test.ts.
 */
type MediaItemSyncing = MediaItem & { syncing: boolean };

/**
 * Syncing badge contract for t-media (spec B):
 *  - the row self-listens on `document` for `song-sync-status`
 *    (detail: { songKey: string, syncing: boolean }, bubbles + composed),
 *  - only events whose `songKey` matches this row's `songKey` toggle the badge,
 *  - syncing === true  → <t-loading> + the literal text "syncing" next to the
 *    song title (inside/next to `.media-title`),
 *  - syncing === false (default) → neither the spinner nor the text is present,
 *  - `group-sync-status` (the group badge event) must NOT reach this row.
 */
describe('t-media syncing badge (song-sync-status)', () => {
  let element: MediaItem;

  beforeEach(async () => {
    element = new MediaItem();
    element.songKey = 'song-a.mp3';
    element.title = 'My Song';
    document.body.appendChild(element);
    await element.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  /** Badge state as observed in the row's shadow root. */
  function getBadgeState() {
    const shadow = element.shadowRoot;
    return {
      loading: shadow?.querySelector('t-loading') ?? null,
      hasSyncingText: /\bsyncing\b/i.test(shadow?.textContent ?? ''),
      title: shadow?.querySelector('.media-title')?.textContent ?? '',
    };
  }

  function dispatchSongSyncStatus(songKey: string, syncing: boolean): void {
    document.dispatchEvent(
      new CustomEvent('song-sync-status', {
        detail: { songKey, syncing },
        bubbles: true,
        composed: true,
      })
    );
  }

  it('default: syncing is false and no badge renders, title intact', async () => {
    expect((element as MediaItemSyncing).syncing, 'syncing must default to false').toBe(false);

    const { loading, hasSyncingText, title } = getBadgeState();
    expect(loading).toBeNull();
    expect(hasSyncingText).toBe(false);
    expect(title).toBe('My Song');
  });

  it('song-sync-status {songKey matching, syncing:true} shows t-loading + "syncing" next to the intact title', async () => {
    dispatchSongSyncStatus('song-a.mp3', true);
    await element.updateComplete;

    const { loading, hasSyncingText, title } = getBadgeState();
    expect(loading, 'badge spinner must appear for the matching song').toBeTruthy();
    expect(customElements.get('t-loading'), 't-media must import t-loading').toBeTruthy();
    expect(hasSyncingText).toBe(true);
    expect(title, 'title must stay rendered').toContain('My Song');
    expect((element as MediaItemSyncing).syncing).toBe(true);

    // Spinner and "syncing" text sit together in one row, to the right of the title.
    const wrapper = loading?.parentElement ?? null;
    expect(wrapper?.textContent ?? '').toMatch(/\bsyncing\b/i);
  });

  it('song-sync-status {syncing:false} hides the badge again', async () => {
    dispatchSongSyncStatus('song-a.mp3', true);
    await element.updateComplete;
    // RED guard: the badge must actually appear before we take it away.
    expect(getBadgeState().loading, 'badge must appear before it can be removed').toBeTruthy();

    dispatchSongSyncStatus('song-a.mp3', false);
    await element.updateComplete;

    const { loading, hasSyncingText, title } = getBadgeState();
    expect(loading).toBeNull();
    expect(hasSyncingText).toBe(false);
    expect(title).toBe('My Song');
    expect((element as MediaItemSyncing).syncing).toBe(false);
  });

  it('song-sync-status for a DIFFERENT songKey is ignored (no badge)', async () => {
    dispatchSongSyncStatus('some-other-song.mp3', true);
    await element.updateComplete;

    expect(
      (element as MediaItemSyncing).syncing,
      'events for other songs must not toggle this row'
    ).toBe(false);
    const { loading, hasSyncingText } = getBadgeState();
    expect(loading).toBeNull();
    expect(hasSyncingText).toBe(false);
  });

  it('group-sync-status does NOT drive the song badge (event names are distinct)', async () => {
    document.dispatchEvent(
      new CustomEvent('group-sync-status', {
        detail: { syncing: true },
        bubbles: true,
        composed: true,
      })
    );
    await element.updateComplete;

    expect(
      (element as MediaItemSyncing).syncing,
      'group-sync-status must not reach t-media'
    ).toBe(false);
    expect(getBadgeState().loading).toBeNull();
  });
});
