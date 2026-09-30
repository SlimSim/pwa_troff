// Unified search-status tests: the `.no-results` div handles BOTH the
// zero-result and the partial-result cases, and the separate
// `t-butt.show-all-search` button is REMOVED.
//
// Feature spec:
// - Top-level lists (t-media-parent `searchQuery` trimmed non-empty):
//   ALWAYS render a `.no-results` div (never `.show-all-wrap` /
//   `t-butt.show-all-search`).
//   - 0 results: keep existing messages (`No tracks match`, `No artists
//     match`, `No genres match`, `No groups match`) + clear button.
//   - >0 results: show `showing X out of Y` + a `t-butt.no-results-clear`
//     (text contains `clear` or `show all`) that clears `searchQuery`.
// - Group detail (`_groupTrackSearch` non-empty, `_selectedGroupKey` set):
//   same unified `.no-results` div for both cases; 0-case keeps
//   `No songs match`; >0-case shows `showing X out of Y` + clear button
//   that clears `_groupTrackSearch`. No `t-butt.show-all-search`.
// - Artist detail (`_artistTrackSearch`) / genre detail
//   (`_genreTrackSearch`): same, with `No tracks match` for the 0-case.
// - Empty / whitespace-only search: NO `.no-results` div.
//
// These tests import the ACTUAL components and the ACTUAL filter helpers
// from `utils/media-search.js` (never re-implemented). The
// unified-div-with-results assertions and the no-show-all-button assertions
// FAIL on current code (RED): today partial results render the list +
// `t-butt.show-all-search` instead of a `.no-results` div.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaParent } from '../components/molecule/t-media-parent.js';
import { GroupList } from '../components/molecule/t-group-list.js';
import { ArtistList } from '../components/molecule/t-artist-list.js';
import { GenreList } from '../components/molecule/t-genre-list.js';
import {
  filterTracks,
  filterArtists,
  filterGenres,
  filterGroups,
} from '../utils/media-search.js';
import type {
  TrackLike,
  GroupLike,
  ArtistLike,
  GenreLike,
} from '../utils/media-search.js';

// ---------------------------------------------------------------------------
// Test-only views onto private component state. Each cast goes through
// `unknown` into a narrow interface, so public fields stay typed directly
// off the element and private fields get explicit shapes.
// ---------------------------------------------------------------------------

/** Private song/group storage on MediaParent (public filter + query stay direct). */
interface MediaParentPrivateState {
  songs: TrackLike[];
  groups: GroupLike[];
}

function mediaState(el: MediaParent): MediaParentPrivateState {
  return el as unknown as MediaParentPrivateState;
}

/**
 * Whitespace-normalized text: Lit templates sometimes split
 * `showing X out of Y` across lines (`out of\n Y`), so raw
 * `textContent` contains newlines. Collapse whitespace before asserting.
 */
function normalizedText(el: HTMLElement | null): string {
  return (el?.textContent ?? '').toLowerCase().replace(/\s+/g, ' ');
}

/** Private lifecycle hooks on MediaParent, for spying in setup. */
interface MediaParentProtoHooks {
  _loadSongs: () => Promise<void>;
  _scrollActiveSongIntoView: () => void;
}

function mediaProto(): MediaParentProtoHooks {
  return MediaParent.prototype as unknown as MediaParentProtoHooks;
}

/** Private detail-view search state on GroupList. */
interface GroupDetailPrivateState {
  _selectedGroupKey: string;
  _groupTrackSearch: string;
}

function groupDetailState(el: GroupList): GroupDetailPrivateState {
  return el as unknown as GroupDetailPrivateState;
}

/** Private detail-view search state on ArtistList. */
interface ArtistDetailPrivateState {
  _artistTrackSearch: string;
}

function artistDetailState(el: ArtistList): ArtistDetailPrivateState {
  return el as unknown as ArtistDetailPrivateState;
}

/** Private detail-view search state on GenreList. */
interface GenreDetailPrivateState {
  _genreTrackSearch: string;
}

function genreDetailState(el: GenreList): GenreDetailPrivateState {
  return el as unknown as GenreDetailPrivateState;
}

// ---------------------------------------------------------------------------
// t-media-parent: unified `.no-results` div (top-level lists)
// ---------------------------------------------------------------------------

describe('t-media-parent unified search-status (.no-results for 0 and >0)', () => {
  let element: MediaParent;

  beforeEach(() => {
    vi.spyOn(mediaProto(), '_loadSongs').mockResolvedValue(undefined);
    vi.spyOn(mediaProto(), '_scrollActiveSongIntoView').mockImplementation(() => {});
    element = new MediaParent();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  function getNoResults(): HTMLElement | null {
    return element.shadowRoot?.querySelector('.no-results') as HTMLElement | null;
  }

  function getShowAllButton(): HTMLElement | null {
    return element.shadowRoot?.querySelector('t-butt.show-all-search') as HTMLElement | null;
  }

  function getClearButton(): HTMLElement | null {
    return element.shadowRoot?.querySelector(
      '.no-results t-butt.no-results-clear'
    ) as HTMLElement | null;
  }

  it('tracks: partial results render .no-results with "showing X out of Y" + clear button (no show-all button)', async () => {
    mediaState(element).songs = [
      { songKey: 'a', title: 'Tango' },
      { songKey: 'b', title: 'Waltz' },
      { songKey: 'c', title: 'Foxtrot' },
    ];
    mediaState(element).groups = [];
    element.currentFilter = 'tracks';
    element.searchQuery = 'tango';
    await element.updateComplete;

    // Ground the expected counts in the REAL filter helper.
    const visible = filterTracks(mediaState(element).songs, 'tango');
    expect(visible).toHaveLength(1);

    const noResults = getNoResults();
    expect(noResults).toBeTruthy();
    expect(normalizedText(noResults)).toContain('showing 1 out of 3');

    const clear = getClearButton();
    expect(clear).toBeTruthy();
    expect(clear?.tagName.toLowerCase()).toBe('t-butt');
    expect((clear?.textContent ?? '').toLowerCase()).toMatch(/clear|show all/);

    // The old separate button must be gone.
    expect(getShowAllButton()).toBeNull();
    expect(element.shadowRoot?.querySelector('.show-all-wrap')).toBeNull();
  });

  it('tracks: clicking the unified clear button clears searchQuery', async () => {
    mediaState(element).songs = [
      { songKey: 'a', title: 'Tango' },
      { songKey: 'b', title: 'Waltz' },
      { songKey: 'c', title: 'Foxtrot' },
    ];
    mediaState(element).groups = [];
    element.currentFilter = 'tracks';
    element.searchQuery = 'tango';
    await element.updateComplete;

    const clear = getClearButton();
    expect(clear).toBeTruthy();
    clear!.click();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect(element.searchQuery).toBe('');
  });

  it('groups: partial results render .no-results with "showing X out of Y" + clear button (no show-all button)', async () => {
    mediaState(element).songs = [];
    mediaState(element).groups = [
      { id: 'g1', name: 'Tango Night', songs: [] },
      { id: 'g2', name: 'Practice List', songs: [] },
      { id: 'g3', name: 'My Favorites', songs: [] },
    ];
    element.currentFilter = 'groups';
    element.searchQuery = 'tango';
    await element.updateComplete;

    const visible = filterGroups(mediaState(element).groups, 'tango');
    expect(visible).toHaveLength(1);

    const noResults = getNoResults();
    expect(noResults).toBeTruthy();
    expect(normalizedText(noResults)).toContain('showing 1 out of 3');

    const clear = getClearButton();
    expect(clear).toBeTruthy();
    expect((clear?.textContent ?? '').toLowerCase()).toMatch(/clear|show all/);

    expect(getShowAllButton()).toBeNull();
  });

  it('groups: clicking the unified clear button clears searchQuery', async () => {
    mediaState(element).songs = [];
    mediaState(element).groups = [
      { id: 'g1', name: 'Tango Night', songs: [] },
      { id: 'g2', name: 'Practice List', songs: [] },
      { id: 'g3', name: 'My Favorites', songs: [] },
    ];
    element.currentFilter = 'groups';
    element.searchQuery = 'tango';
    await element.updateComplete;

    const clear = getClearButton();
    expect(clear).toBeTruthy();
    clear!.click();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect(element.searchQuery).toBe('');
  });

  it('artists: partial results render .no-results with "showing X out of Y" + clear button (no show-all button)', async () => {
    mediaState(element).songs = [
      { songKey: 'a', title: 'Song A', artist: 'Piazzolla' },
      { songKey: 'b', title: 'Song B', artist: 'Gardel' },
      { songKey: 'c', title: 'Song C', artist: 'Strauss' },
    ];
    mediaState(element).groups = [];
    element.currentFilter = 'artists';
    element.searchQuery = 'piazz';
    await element.updateComplete;

    // Total artists = 3 unique names; verify the filter contract directly
    // via the real helper.
    const allArtists: ArtistLike[] = [
      { name: 'Piazzolla', tracks: [] },
      { name: 'Gardel', tracks: [] },
      { name: 'Strauss', tracks: [] },
    ];
    expect(filterArtists(allArtists, 'piazz')).toHaveLength(1);

    const noResults = getNoResults();
    expect(noResults).toBeTruthy();
    expect(normalizedText(noResults)).toContain('showing 1 out of 3');

    const clear = getClearButton();
    expect(clear).toBeTruthy();
    expect((clear?.textContent ?? '').toLowerCase()).toMatch(/clear|show all/);

    expect(getShowAllButton()).toBeNull();
  });

  it('artists: clicking the unified clear button clears searchQuery', async () => {
    mediaState(element).songs = [
      { songKey: 'a', title: 'Song A', artist: 'Piazzolla' },
      { songKey: 'b', title: 'Song B', artist: 'Gardel' },
      { songKey: 'c', title: 'Song C', artist: 'Strauss' },
    ];
    mediaState(element).groups = [];
    element.currentFilter = 'artists';
    element.searchQuery = 'piazz';
    await element.updateComplete;

    const clear = getClearButton();
    expect(clear).toBeTruthy();
    clear!.click();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect(element.searchQuery).toBe('');
  });

  it('genres: partial results render .no-results with "showing X out of Y" + clear button (no show-all button)', async () => {
    mediaState(element).songs = [
      { songKey: 'a', title: 'Song A', genre: 'Tango' },
      { songKey: 'b', title: 'Song B', genre: 'Waltz' },
      { songKey: 'c', title: 'Song C', genre: 'Foxtrot' },
    ];
    mediaState(element).groups = [];
    element.currentFilter = 'genre';
    element.searchQuery = 'tango';
    await element.updateComplete;

    const allGenres: GenreLike[] = [
      { name: 'Tango', tracks: [] },
      { name: 'Waltz', tracks: [] },
      { name: 'Foxtrot', tracks: [] },
    ];
    expect(filterGenres(allGenres, 'tango')).toHaveLength(1);

    const noResults = getNoResults();
    expect(noResults).toBeTruthy();
    expect(normalizedText(noResults)).toContain('showing 1 out of 3');

    const clear = getClearButton();
    expect(clear).toBeTruthy();
    expect((clear?.textContent ?? '').toLowerCase()).toMatch(/clear|show all/);

    expect(getShowAllButton()).toBeNull();
  });

  it('genres: clicking the unified clear button clears searchQuery', async () => {
    mediaState(element).songs = [
      { songKey: 'a', title: 'Song A', genre: 'Tango' },
      { songKey: 'b', title: 'Song B', genre: 'Waltz' },
      { songKey: 'c', title: 'Song C', genre: 'Foxtrot' },
    ];
    mediaState(element).groups = [];
    element.currentFilter = 'genre';
    element.searchQuery = 'tango';
    await element.updateComplete;

    const clear = getClearButton();
    expect(clear).toBeTruthy();
    clear!.click();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect(element.searchQuery).toBe('');
  });

  // ---- 0-result regression guards (already pass today) ----

  it('tracks: 0 results keep "No tracks match" + clear button still clears search', async () => {
    mediaState(element).songs = [
      { songKey: 'a', title: 'Tango' },
      { songKey: 'b', title: 'Waltz' },
    ];
    mediaState(element).groups = [];
    element.currentFilter = 'tracks';
    element.searchQuery = 'zzz';
    await element.updateComplete;

    expect(filterTracks(mediaState(element).songs, 'zzz')).toHaveLength(0);

    const noResults = getNoResults();
    expect(noResults).toBeTruthy();
    expect(noResults?.querySelector('.no-results-text')?.textContent).toContain(
      'No tracks match "zzz"'
    );

    (getClearButton() as HTMLElement | null)?.click();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect(element.searchQuery).toBe('');
  });

  it('artists: 0 results keep "No artists match" + clear button still clears search', async () => {
    mediaState(element).songs = [
      { songKey: 'a', title: 'Song A', artist: 'Piazzolla' },
      { songKey: 'b', title: 'Song B', artist: 'Gardel' },
    ];
    mediaState(element).groups = [];
    element.currentFilter = 'artists';
    element.searchQuery = 'zzz';
    await element.updateComplete;

    const noResults = getNoResults();
    expect(noResults).toBeTruthy();
    expect(noResults?.querySelector('.no-results-text')?.textContent).toContain(
      'No artists match "zzz"'
    );

    (getClearButton() as HTMLElement | null)?.click();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect(element.searchQuery).toBe('');
  });

  it('genres: 0 results keep "No genres match" + clear button still clears search', async () => {
    mediaState(element).songs = [
      { songKey: 'a', title: 'Song A', genre: 'Tango' },
      { songKey: 'b', title: 'Song B', genre: 'Waltz' },
    ];
    mediaState(element).groups = [];
    element.currentFilter = 'genre';
    element.searchQuery = 'zzz';
    await element.updateComplete;

    const noResults = getNoResults();
    expect(noResults).toBeTruthy();
    expect(noResults?.querySelector('.no-results-text')?.textContent).toContain(
      'No genres match "zzz"'
    );

    (getClearButton() as HTMLElement | null)?.click();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect(element.searchQuery).toBe('');
  });

  it('groups: 0 results keep "No groups match" + clear button still clears search', async () => {
    mediaState(element).songs = [];
    mediaState(element).groups = [{ id: 1, name: 'Dance Group', songs: [] }];
    element.currentFilter = 'groups';
    element.searchQuery = 'zzz';
    await element.updateComplete;

    expect(filterGroups(mediaState(element).groups, 'zzz')).toHaveLength(0);

    const noResults = getNoResults();
    expect(noResults).toBeTruthy();
    expect(noResults?.querySelector('.no-results-text')?.textContent).toContain(
      'No groups match "zzz"'
    );

    (getClearButton() as HTMLElement | null)?.click();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect(element.searchQuery).toBe('');
  });

  // ---- empty / whitespace-only: no `.no-results` div ----

  it('no .no-results div when the search is empty', async () => {
    mediaState(element).songs = [
      { songKey: 'a', title: 'Tango' },
      { songKey: 'b', title: 'Waltz' },
    ];
    mediaState(element).groups = [];
    element.currentFilter = 'tracks';
    element.searchQuery = '';
    await element.updateComplete;

    expect(getNoResults()).toBeNull();
    expect(getShowAllButton()).toBeNull();
  });

  it('no .no-results div when the search is whitespace-only', async () => {
    mediaState(element).songs = [
      { songKey: 'a', title: 'Tango' },
      { songKey: 'b', title: 'Waltz' },
    ];
    mediaState(element).groups = [];
    element.currentFilter = 'tracks';
    element.searchQuery = '   ';
    await element.updateComplete;

    expect(getNoResults()).toBeNull();
    expect(getShowAllButton()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// t-group-list detail: unified `.no-results` div
// ---------------------------------------------------------------------------

describe('t-group-list detail unified search-status', () => {
  let element: GroupList;

  beforeEach(() => {
    element = new GroupList();
    document.body.appendChild(element);
    element.groups = [
      {
        id: 1,
        name: 'Test Group',
        songs: [],
        tracks: [
          { title: 'Tango', songKey: 'a' },
          { title: 'Waltz', songKey: 'b' },
          { title: 'Foxtrot', songKey: 'c' },
        ],
      },
    ];
    element.tracks = [];
    groupDetailState(element)._selectedGroupKey = '1';
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  function getNoResults(): HTMLElement | null {
    return element.shadowRoot?.querySelector('.no-results') as HTMLElement | null;
  }

  function getShowAllButton(): HTMLElement | null {
    return element.shadowRoot?.querySelector('t-butt.show-all-search') as HTMLElement | null;
  }

  it('partial results render .no-results with "showing X out of Y" + clear button (no show-all button)', async () => {
    groupDetailState(element)._groupTrackSearch = 'tango';
    await element.updateComplete;

    const noResults = getNoResults();
    expect(noResults).toBeTruthy();
    expect(normalizedText(noResults)).toContain('showing 1 out of 3');

    const clear = noResults?.querySelector('t-butt.no-results-clear') as HTMLElement | null;
    expect(clear).toBeTruthy();
    expect((clear?.textContent ?? '').toLowerCase()).toMatch(/clear|show all/);

    // The removed button must not exist in the detail view.
    expect(getShowAllButton()).toBeNull();
  });

  it('clicking the unified clear button clears _groupTrackSearch', async () => {
    groupDetailState(element)._groupTrackSearch = 'tango';
    await element.updateComplete;

    const noResults = getNoResults();
    expect(noResults).toBeTruthy();
    (noResults?.querySelector('t-butt.no-results-clear') as HTMLElement | null)?.click();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect(groupDetailState(element)._groupTrackSearch).toBe('');
  });

  it('0 results keep "No songs match" + clear button still clears search', async () => {
    groupDetailState(element)._groupTrackSearch = 'zzz';
    await element.updateComplete;

    const noResults = getNoResults();
    expect(noResults).toBeTruthy();
    expect(noResults?.querySelector('.no-results-text')?.textContent).toContain(
      'No songs match "zzz"'
    );
    expect(noResults?.querySelector('t-butt.no-results-clear')).toBeTruthy();

    (noResults?.querySelector('t-butt.no-results-clear') as HTMLElement | null)?.click();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect(groupDetailState(element)._groupTrackSearch).toBe('');
  });

  it('no .no-results div when the group detail search is empty or whitespace-only', async () => {
    groupDetailState(element)._groupTrackSearch = '';
    await element.updateComplete;
    expect(getNoResults()).toBeNull();
    expect(getShowAllButton()).toBeNull();

    groupDetailState(element)._groupTrackSearch = '   ';
    await element.updateComplete;
    expect(getNoResults()).toBeNull();
    expect(getShowAllButton()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// t-artist-list detail: unified `.no-results` div
// ---------------------------------------------------------------------------

describe('t-artist-list detail unified search-status', () => {
  let element: ArtistList;

  beforeEach(() => {
    element = new ArtistList();
    document.body.appendChild(element);
    element.artists = [
      {
        name: 'Alpha',
        tracks: [
          { title: 'Tango', songKey: 'a' },
          { title: 'Waltz', songKey: 'b' },
          { title: 'Foxtrot', songKey: 'c' },
        ],
      },
    ];
    element.tracks = [];
    element.selectedArtist = 'Alpha';
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  function getNoResults(): HTMLElement | null {
    return element.shadowRoot?.querySelector('.no-results') as HTMLElement | null;
  }

  function getShowAllButton(): HTMLElement | null {
    return element.shadowRoot?.querySelector('t-butt.show-all-search') as HTMLElement | null;
  }

  it('partial results render .no-results with "showing X out of Y" + clear button (no show-all button)', async () => {
    artistDetailState(element)._artistTrackSearch = 'tango';
    await element.updateComplete;

    const noResults = getNoResults();
    expect(noResults).toBeTruthy();
    expect(normalizedText(noResults)).toContain('showing 1 out of 3');

    const clear = noResults?.querySelector('t-butt.no-results-clear') as HTMLElement | null;
    expect(clear).toBeTruthy();
    expect((clear?.textContent ?? '').toLowerCase()).toMatch(/clear|show all/);

    expect(getShowAllButton()).toBeNull();
  });

  it('clicking the unified clear button clears _artistTrackSearch', async () => {
    artistDetailState(element)._artistTrackSearch = 'tango';
    await element.updateComplete;

    const noResults = getNoResults();
    expect(noResults).toBeTruthy();
    (noResults?.querySelector('t-butt.no-results-clear') as HTMLElement | null)?.click();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect(artistDetailState(element)._artistTrackSearch).toBe('');
  });

  it('0 results keep "No tracks match" + clear button still clears search', async () => {
    artistDetailState(element)._artistTrackSearch = 'zzz';
    await element.updateComplete;

    const noResults = getNoResults();
    expect(noResults).toBeTruthy();
    expect(noResults?.querySelector('.no-results-text')?.textContent).toContain(
      'No tracks match "zzz"'
    );
    expect(noResults?.querySelector('t-butt.no-results-clear')).toBeTruthy();

    (noResults?.querySelector('t-butt.no-results-clear') as HTMLElement | null)?.click();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect(artistDetailState(element)._artistTrackSearch).toBe('');
  });

  it('no .no-results div when the artist detail search is empty or whitespace-only', async () => {
    artistDetailState(element)._artistTrackSearch = '';
    await element.updateComplete;
    expect(getNoResults()).toBeNull();
    expect(getShowAllButton()).toBeNull();

    artistDetailState(element)._artistTrackSearch = '   ';
    await element.updateComplete;
    expect(getNoResults()).toBeNull();
    expect(getShowAllButton()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// t-genre-list detail: unified `.no-results` div
// ---------------------------------------------------------------------------

describe('t-genre-list detail unified search-status', () => {
  let element: GenreList;

  beforeEach(() => {
    element = new GenreList();
    document.body.appendChild(element);
    element.genres = [
      {
        name: 'Jazz',
        tracks: [
          { title: 'Tango', songKey: 'a' },
          { title: 'Waltz', songKey: 'b' },
          { title: 'Foxtrot', songKey: 'c' },
        ],
      },
    ];
    element.tracks = [];
    element.selectedGenre = 'Jazz';
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  function getNoResults(): HTMLElement | null {
    return element.shadowRoot?.querySelector('.no-results') as HTMLElement | null;
  }

  function getShowAllButton(): HTMLElement | null {
    return element.shadowRoot?.querySelector('t-butt.show-all-search') as HTMLElement | null;
  }

  it('partial results render .no-results with "showing X out of Y" + clear button (no show-all button)', async () => {
    genreDetailState(element)._genreTrackSearch = 'tango';
    await element.updateComplete;

    const noResults = getNoResults();
    expect(noResults).toBeTruthy();
    expect(normalizedText(noResults)).toContain('showing 1 out of 3');

    const clear = noResults?.querySelector('t-butt.no-results-clear') as HTMLElement | null;
    expect(clear).toBeTruthy();
    expect((clear?.textContent ?? '').toLowerCase()).toMatch(/clear|show all/);

    expect(getShowAllButton()).toBeNull();
  });

  it('clicking the unified clear button clears _genreTrackSearch', async () => {
    genreDetailState(element)._genreTrackSearch = 'tango';
    await element.updateComplete;

    const noResults = getNoResults();
    expect(noResults).toBeTruthy();
    (noResults?.querySelector('t-butt.no-results-clear') as HTMLElement | null)?.click();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect(genreDetailState(element)._genreTrackSearch).toBe('');
  });

  it('0 results keep "No tracks match" + clear button still clears search', async () => {
    genreDetailState(element)._genreTrackSearch = 'zzz';
    await element.updateComplete;

    const noResults = getNoResults();
    expect(noResults).toBeTruthy();
    expect(noResults?.querySelector('.no-results-text')?.textContent).toContain(
      'No tracks match "zzz"'
    );
    expect(noResults?.querySelector('t-butt.no-results-clear')).toBeTruthy();

    (noResults?.querySelector('t-butt.no-results-clear') as HTMLElement | null)?.click();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect(genreDetailState(element)._genreTrackSearch).toBe('');
  });

  it('no .no-results div when the genre detail search is empty or whitespace-only', async () => {
    genreDetailState(element)._genreTrackSearch = '';
    await element.updateComplete;
    expect(getNoResults()).toBeNull();
    expect(getShowAllButton()).toBeNull();

    genreDetailState(element)._genreTrackSearch = '   ';
    await element.updateComplete;
    expect(getNoResults()).toBeNull();
    expect(getShowAllButton()).toBeNull();
  });
});
