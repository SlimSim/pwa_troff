import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaParent } from './t-media-parent.js';
import { nDB } from '../../assets/internal/db.js';

/**
 * Regression tests for "scroll the selected song into view" / "pre-position the
 * song list in the user's last view".
 *
 * These cover the two behaviours the user reported:
 *   1. On app start the scroll must land in the SAVED view (not the default
 *      tracks view).
 *   2. Every view (tracks / artists / genres / groups) — both the detail view
 *      (t-media rows) and the collapsed LIST view (artist/genre/group items) —
 *      marks & scrolls to the item that contains the currently selected song.
 */

const NAV_KEY = 'TROFF_SONG_LIST_NAVIGATION_STATE';

describe('song-list scroll-to-active-song behaviour', () => {
  let element: MediaParent | null = null;

  beforeEach(() => {
    // Skip the real async _loadSongs() from connectedCallback.
    vi.spyOn(MediaParent.prototype as any, '_loadSongs').mockResolvedValue(undefined);
    nDB.delete(NAV_KEY);
  });

  afterEach(() => {
    if (element && document.body.contains(element)) {
      document.body.removeChild(element);
    }
    element = null;
    nDB.delete(NAV_KEY);
    vi.restoreAllMocks();
  });

  // Mount + let connectedCallback's async post-await (currentSongKey reset)
  // settle before the test mutates state.
  async function mount(): Promise<MediaParent> {
    const el = new MediaParent();
    document.body.appendChild(el);
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    return el;
  }

  // happy-dom renders nested custom elements asynchronously; wait for the child
  // to finish its own render before asserting on its shadow DOM.
  async function childUpdate(selector: string): Promise<HTMLElement> {
    const child = element!.shadowRoot?.querySelector(selector) as
      | (HTMLElement & { updateComplete: Promise<void> })
      | null;
    if (!child) throw new Error(`Expected ${selector} in the shadow root`);
    await new Promise((r) => setTimeout(r, 0));
    await child.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    return child;
  }

  it('scrolls the active song into view when the song list is closed (visible -> false)', async () => {
    element = await mount();
    const spy = vi.spyOn(element as any, '_scrollActiveSongIntoView');
    spy.mockClear(); // ignore the app-start scroll

    element.visible = true;
    await element.updateComplete;
    element.visible = false; // closing triggers the scroll
    await element.updateComplete;

    expect(spy).toHaveBeenCalled();
  });

  it('applies the saved nav state on load so the app-start scroll targets the saved view (not tracks)', async () => {
    nDB.set(NAV_KEY, { tab: 'artists', selected_entity: '' });
    element = await mount();
    expect(element.currentFilter).toBe('artists');
  });

  it('defaults to the tracks view when there is no saved nav state', async () => {
    nDB.delete(NAV_KEY);
    element = await mount();
    expect(element.currentFilter).toBe('tracks');
  });

  it('marks the artist LIST item containing the current song with data-current-song', async () => {
    element = await mount();
    (element as any).songs = [
      { songKey: 'a', title: 'A', artist: 'Beatles' },
      { songKey: 'b', title: 'B', artist: 'Beatles' },
      { songKey: 'c', title: 'C', artist: 'Stones' },
    ];
    (element as any).currentSongKey = 'b';
    (element as any).currentFilter = 'artists';
    await element.updateComplete;
    const artistList = await childUpdate('t-artist-list');

    const marked = artistList.shadowRoot!.querySelectorAll('[data-current-song]');
    expect(marked.length).toBe(1);
    expect(marked[0].querySelector('.artist-name')?.textContent).toContain('Beatles');
    expect(marked[0].querySelector('.artist-name')?.textContent).not.toContain('Stones');
  });

  it('marks the genre LIST item containing the current song with data-current-song', async () => {
    element = await mount();
    (element as any).songs = [
      { songKey: 'a', title: 'A', genre: 'Rock' },
      { songKey: 'b', title: 'B', genre: 'Rock' },
      { songKey: 'c', title: 'C', genre: 'Pop' },
    ];
    (element as any).currentSongKey = 'b';
    (element as any).currentFilter = 'genre';
    await element.updateComplete;
    const genreList = await childUpdate('t-genre-list');

    const marked = genreList.shadowRoot!.querySelectorAll('[data-current-song]');
    expect(marked.length).toBe(1);
    expect(marked[0].querySelector('.genre-name')?.textContent).toContain('Rock');
    expect(marked[0].querySelector('.genre-name')?.textContent).not.toContain('Pop');
  });

  it('marks the group LIST item containing the current song with data-current-song', async () => {
    element = await mount();
    (element as any).songs = [
      { songKey: 'a', title: 'A' },
      { songKey: 'b', title: 'B' },
    ];
    (element as any).groups = [{ name: 'My Group', songs: [{ fullPath: 'a' }], color: '', icon: '' }];
    (element as any).currentSongKey = 'a';
    (element as any).currentFilter = 'groups';
    await element.updateComplete;
    const groupList = await childUpdate('t-group-list');

    const marked = groupList.shadowRoot!.querySelectorAll('[data-current-song]');
    expect(marked.length).toBe(1);
    expect(marked[0].querySelector('.group-name')?.textContent).toContain('My Group');
  });

  it('_findActiveMediaElement returns the data-current-song item in a list view', async () => {
    element = await mount();
    (element as any).songs = [
      { songKey: 'a', title: 'A', artist: 'Beatles' },
      { songKey: 'b', title: 'B', artist: 'Beatles' },
      { songKey: 'c', title: 'C', artist: 'Stones' },
    ];
    (element as any).currentSongKey = 'b';
    (element as any).currentFilter = 'artists';
    await element.updateComplete;
    await childUpdate('t-artist-list');

    const found = (element as any)._findActiveMediaElement();
    expect(found).not.toBeNull();
    expect(found.hasAttribute('data-current-song')).toBe(true);
  });

  it('_findActiveMediaElement returns the active t-media row in the tracks detail view', async () => {
    element = await mount();
    (element as any).songs = [
      { songKey: 'a', title: 'A' },
      { songKey: 'b', title: 'B' },
    ];
    (element as any).currentSongKey = 'b';
    (element as any).currentFilter = 'tracks';
    await element.updateComplete;
    await childUpdate('t-track-list');

    const found = (element as any)._findActiveMediaElement();
    expect(found).not.toBeNull();
    expect(found.tagName.toLowerCase()).toBe('t-media');
  });
});
