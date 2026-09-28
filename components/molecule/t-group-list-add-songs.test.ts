import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GroupList } from './t-group-list.js';

describe('t-group-list add songs UI', () => {
  let element: GroupList;

  const libraryTracks = [
    {
      songKey: 'song-a',
      title: 'Alpha Song',
      artist: 'Alpha Artist',
      album: 'Alpha Album',
      genre: 'Tango',
    },
    {
      songKey: 'song-b',
      title: 'Yellow Submarine Remix',
      artist: 'Beatles',
      album: 'Abbey Road',
      genre: 'Rock',
    },
    {
      songKey: 'song-c',
      title: 'Some Song',
      artist: 'Someone',
      album: 'live-album',
      genre: 'Pop',
    },
  ];

  function setLibrary(tracks: any[]) {
    (element as any).tracks = tracks;
  }

  function setGroupSongs(fullPaths: string[]) {
    (element as any).groups = [
      {
        id: 1,
        name: 'Test Group',
        songs: fullPaths.map((fullPath) => ({ fullPath })),
        tracks: [],
      },
    ];
  }

  function availableMediaEls(): HTMLElement[] {
    const list = element.shadowRoot?.querySelector('.add-songs-list');
    if (!list) return [];
    return Array.from(list.querySelectorAll('t-media')) as HTMLElement[];
  }

  beforeEach(() => {
    element = new GroupList();
    document.body.appendChild(element);
    (element as any).groups = [
      {
        id: 1,
        name: 'Test Group',
        songs: [],
        tracks: [],
      },
    ];
    (element as any).tracks = [...libraryTracks];
    (element as any)._selectedGroupKey = '1';
    (element as any)._songManagementOpen = true;
    (element as any)._addSongQuery = '';
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  it('renders available songs as t-media rows (not plain title-only divs)', async () => {
    await element.updateComplete;

    const mediaEls = availableMediaEls();
    expect(mediaEls.length).toBeGreaterThan(0);

    // No legacy plain rows should remain in the available list.
    expect(
      element.shadowRoot?.querySelector('.add-songs-list .add-songs-item')
    ).toBeNull();

    for (const media of mediaEls) {
      expect((media as any).songKey).toBeTruthy();
      expect((media as any).hideEditButton).toBe(true);
    }
  });

  it('each available row has an add overlay button that dispatches group-song-added', async () => {
    const addedSpy = vi.fn();
    element.addEventListener('group-song-added', addedSpy);
    await element.updateComplete;

    const list = element.shadowRoot?.querySelector('.add-songs-list');
    expect(list).toBeTruthy();

    const addBtn = list?.querySelector('t-butt') as HTMLElement | null;
    expect(addBtn).toBeTruthy();
    expect(addBtn?.querySelector('t-icon')).toBeTruthy();

    addBtn?.click();
    await element.updateComplete;

    expect(addedSpy).toHaveBeenCalledTimes(1);
    const event = addedSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.groupKey).toBe('1');
    expect(event.detail.songKey).toBeTruthy();
  });

  it('clicking an available-song row dispatches group-song-added without leaking media-selected', async () => {
    const addedSpy = vi.fn();
    const selectedSpy = vi.fn();
    element.addEventListener('group-song-added', addedSpy);
    element.addEventListener('media-selected', selectedSpy);
    await element.updateComplete;

    const mediaEls = availableMediaEls();
    expect(mediaEls.length).toBeGreaterThan(0);

    (mediaEls[0] as HTMLElement).click();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect(addedSpy).toHaveBeenCalledTimes(1);
    const event = addedSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({
      groupKey: '1',
      songKey: 'song-a',
      title: 'Alpha Song',
    });
    expect(selectedSpy).not.toHaveBeenCalled();
  });

  it('search matches artist and album (multi-field), not title-only', async () => {
    await element.updateComplete;

    // Artist match: title does not contain "beatles".
    (element as any)._addSongQuery = 'beatles';
    await element.updateComplete;
    const artistKeys = availableMediaEls().map((m) => (m as any).songKey);
    expect(artistKeys).toContain('song-b');

    // Album match: title does not contain "live-album".
    (element as any)._addSongQuery = 'live-album';
    await element.updateComplete;
    const albumKeys = availableMediaEls().map((m) => (m as any).songKey);
    expect(albumKeys).toContain('song-c');
  });

  it('excludes songs already in the group from the available list', async () => {
    setGroupSongs(['song-a']);
    setLibrary([...libraryTracks]);
    (element as any)._addSongQuery = '';
    await element.updateComplete;

    const keys = availableMediaEls().map((m) => (m as any).songKey);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys).not.toContain('song-a');
    expect(keys).toContain('song-b');
  });

  it('shows "No songs in library" when the library is empty', async () => {
    setLibrary([]);
    await element.updateComplete;

    expect(element.shadowRoot?.querySelector('.add-songs-list')).toBeNull();
    expect(element.shadowRoot?.textContent).toContain('No songs in library');
  });

  it('shows no-match and all-added empty states', async () => {
    // Query matches nothing.
    (element as any)._addSongQuery = 'nomatch-xyz';
    await element.updateComplete;
    expect(element.shadowRoot?.textContent).toContain('No songs match "nomatch-xyz"');

    // Every library song already in the group, no query.
    setGroupSongs(['song-a', 'song-b', 'song-c']);
    (element as any)._addSongQuery = '';
    await element.updateComplete;
    expect(availableMediaEls().length).toBe(0);
    expect(element.shadowRoot?.textContent).toContain(
      'All songs are already in this group'
    );
  });
});
