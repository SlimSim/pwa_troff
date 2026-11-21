// Integration tests: local song results inside the GROUPS tab search.
//
// Feature spec (decisions pinned here):
// - On the GROUPS tab (currentFilter === 'groups'), when NOT inside a group
//   detail (_currentGroupKey === '') and when searchQuery.trim() !== '',
//   t-media-parent renders the local songs matching the query in a
//   <t-track-list class="groups-local-songs">.
// - The list sits BETWEEN the groups list (or the "No groups match" block)
//   and <t-server-song-list>.
// - It shows ALL local songs matching the query (using the real filterTracks
//   helper), sorted with the tracks-tab sort (sortBy='playsMonth',
//   sortOrder='descending' by default). Songs that belong to a matching group
//   still appear in this local section.
// - It is rendered even when no group matches the query.
// - It must NOT be rendered for an empty/whitespace query, inside a group
//   detail, or on the tracks/artists/genre tabs.
// - It receives currentSongKey, downloadProgressMap and uploadProgressMap,
//   like the tracks tab does.
//
// Firebase and nDB are mocked (no real services).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaParent } from './t-media-parent.js';
import { filterTracks } from '../../utils/media-search.js';
import type { TrackLike, GroupLike } from '../../utils/media-search.js';

// ---------------------------------------------------------------------------
// Mock nDB (in-memory) — t-media-parent reads/writes nDB. Factory bodies only
// touch nDBStore inside call-time closures, so the static MediaParent import
// above is safe.
// ---------------------------------------------------------------------------

const nDBStore = new Map<string, unknown>();

vi.mock('../../assets/internal/db.js', () => ({
  nDB: {
    get: vi.fn((key: string) => nDBStore.get(key) ?? null),
    set: vi.fn((key: string, value: unknown) => {
      nDBStore.set(key, value);
    }),
    setOnSong: vi.fn(),
    delete: vi.fn((key: string) => {
      nDBStore.delete(key);
    }),
  },
}));

// ---------------------------------------------------------------------------
// Mock firebaseClient (used by utils/server-song-list.ts).
// vi.hoisted so the factory may reference these directly even though the
// static MediaParent import evaluates the module graph first.
// ---------------------------------------------------------------------------

const firebaseMocks = vi.hoisted(() => ({
  db: {},
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  getDocs: vi.fn(async (_ref: unknown) => ({ docs: [] })),
}));

vi.mock('../../services/firebaseClient.js', () => firebaseMocks);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TrackListElement extends HTMLElement {
  tracks?: TrackLike[];
  currentSongKey?: string;
  downloadProgressMap?: Record<string, number>;
  uploadProgressMap?: Record<string, number>;
}

/** Recursively search an element's shadow roots for a selector. */
function deepShadowQuery(root: Element | ShadowRoot, selector: string): Element | null {
  const direct = root.querySelector(selector);
  if (direct) return direct;

  for (const child of Array.from(root.querySelectorAll('*'))) {
    if (child.shadowRoot) {
      const found = deepShadowQuery(child.shadowRoot, selector);
      if (found) return found;
    }
  }
  return null;
}

/** Wait a macrotask so any (unawaited) async refresh work can settle. */
function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// Test-only views onto private component state. Each cast goes through
// `unknown` into a narrow interface, so no `any` is needed.
// ---------------------------------------------------------------------------

interface MediaParentPrivateState {
  songs: TrackLike[];
  groups: GroupLike[];
  currentFilter: string;
  searchQuery: string;
  _currentGroupKey: string;
  currentSongKey: string;
  _downloadProgress: Map<string, number>;
  _uploadProgress: Map<string, number>;
}

function mediaState(el: MediaParent): MediaParentPrivateState {
  return el as unknown as MediaParentPrivateState;
}

/** Private lifecycle hooks on MediaParent, for spying in setup. */
interface MediaParentProtoHooks {
  _loadSongs: () => Promise<void>;
  _scrollActiveSongIntoView: () => void;
}

function mediaProto(): MediaParentProtoHooks {
  return MediaParent.prototype as unknown as MediaParentProtoHooks;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * local1 matches "swing" and belongs to a matching group.
 * local2 matches "swing" and belongs to no group.
 * local3 does not match "swing".
 *
 * playsMonth gives a deterministic default sort (descending): local2, local1.
 */
const SONGS: TrackLike[] = [
  { songKey: 'local1', title: 'Swing Time', artist: 'Alice', playsMonth: 10, downloaded: true },
  { songKey: 'local2', title: 'Swing Low', artist: 'Bob', playsMonth: 20, downloaded: true },
  { songKey: 'local3', title: 'Waltz Night', artist: 'Cara', playsMonth: 30, downloaded: true },
];

const GROUPS: GroupLike[] = [
  { name: 'Swing Group', firebaseGroupDocId: 'g-swing', songs: [{ fullPath: 'local1' }] },
  { name: 'Waltz Group', firebaseGroupDocId: 'g-waltz', songs: [{ fullPath: 'local3' }] },
];

const songKeys = (tracks: TrackLike[] | undefined): string[] =>
  (tracks ?? []).map((track) => String(track.songKey));

describe('t-media-parent: local song results on the groups tab', () => {
  let element: MediaParent;

  beforeEach(() => {
    nDBStore.clear();
    firebaseMocks.getDocs.mockClear();
    firebaseMocks.collection.mockClear();
    firebaseMocks.getDocs.mockResolvedValue({ docs: [] });

    // Skip the async _loadSongs() from connectedCallback and neutralize the
    // fire-and-forget scroll timer (same hygiene as t-media-parent.test.ts).
    vi.spyOn(mediaProto(), '_loadSongs').mockResolvedValue(undefined);
    vi.spyOn(mediaProto(), '_scrollActiveSongIntoView').mockImplementation(() => {});

    element = new MediaParent();
    document.body.appendChild(element);

    mediaState(element).songs = [];
    mediaState(element).groups = [];
    mediaState(element).currentFilter = 'tracks';
    mediaState(element).searchQuery = '';
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  /** Seed state and let the component (and its sub-lists) render. */
  async function renderWith(state: {
    songs?: TrackLike[];
    groups?: GroupLike[];
    filter?: string;
    query?: string;
    groupKey?: string;
  }): Promise<void> {
    mediaState(element).songs = state.songs ?? SONGS;
    mediaState(element).groups = state.groups ?? GROUPS;
    mediaState(element).currentFilter = state.filter ?? 'groups';
    mediaState(element)._currentGroupKey = state.groupKey ?? '';
    mediaState(element).searchQuery = state.query ?? 'swing';

    await element.updateComplete;
    await element.updateComplete;
    await flushAsync();
  }

  function getLocalTrackList(): TrackListElement | null {
    return deepShadowQuery(
      element.shadowRoot!,
      't-track-list.groups-local-songs'
    ) as TrackListElement | null;
  }

  it('renders a local t-track-list between the groups list and the server list', async () => {
    await renderWith({});

    const localList = getLocalTrackList();
    expect(
      localList,
      'expected <t-track-list class="groups-local-songs"> on the groups tab with a query'
    ).toBeTruthy();
    if (!localList) return;

    // Expected songs come from the REAL filterTracks helper — the test never
    // re-implements the matching logic.
    const expectedKeys = songKeys(filterTracks(SONGS, 'swing'));
    const actualKeys = songKeys(localList.tracks);

    expect(actualKeys).toHaveLength(expectedKeys.length);
    expect(new Set(actualKeys)).toEqual(new Set(expectedKeys));
    // ALL local songs matching, including the one that belongs to a matching
    // group and the one that belongs to no group.
    expect(actualKeys).toContain('local1');
    expect(actualKeys).toContain('local2');
    // Default sort: playsMonth descending → local2 (20) before local1 (10).
    expect(actualKeys[0]).toBe('local2');

    // DOM order: groups list → local t-track-list → server song list.
    const order = Array.from(
      element.shadowRoot!.querySelectorAll(
        't-group-list, t-track-list.groups-local-songs, t-server-song-list'
      )
    ).map((el) => (el.classList.contains('groups-local-songs') ? 'local-track-list' : el.tagName.toLowerCase()));

    expect(order).toEqual(['t-group-list', 'local-track-list', 't-server-song-list']);
  });

  it('renders the local songs even when no group matches the query', async () => {
    await renderWith({
      // Neither group matches "swing", but two local songs do.
      groups: [
        { name: 'Tango Group', firebaseGroupDocId: 'g-tango', songs: [{ fullPath: 'local3' }] },
      ],
    });

    const noGroupsBlock = element.shadowRoot!.querySelector('.no-results');
    expect(noGroupsBlock, 'expected the "No groups match" block').toBeTruthy();
    expect(noGroupsBlock!.textContent ?? '').toContain('No groups match');
    expect(element.shadowRoot!.querySelector('t-group-list')).toBeNull();

    const localList = getLocalTrackList();
    expect(
      localList,
      'local songs must render even when no group matches'
    ).toBeTruthy();
    if (!localList) return;

    expect(new Set(songKeys(localList.tracks))).toEqual(
      new Set(songKeys(filterTracks(SONGS, 'swing')))
    );

    // DOM order: "No groups match" → local t-track-list → server song list.
    const order = Array.from(
      element.shadowRoot!.querySelectorAll(
        '.no-results, t-track-list.groups-local-songs, t-server-song-list'
      )
    ).map((el) => {
      if (el.classList.contains('groups-local-songs')) return 'local-track-list';
      return el.tagName.toLowerCase() === 't-server-song-list' ? 'server-song-list' : 'no-results';
    });

    expect(order).toEqual(['no-results', 'local-track-list', 'server-song-list']);
  });

  it('does not render the local list for an empty or whitespace-only query', async () => {
    for (const query of ['', '   ']) {
      await renderWith({ query });

      expect(
        getLocalTrackList(),
        `no local track list expected for query ${JSON.stringify(query)}`
      ).toBeNull();
    }
  });

  it('does not render the local list inside a group detail view', async () => {
    await renderWith({ groupKey: 'g-swing' });

    expect(getLocalTrackList()).toBeNull();
  });

  it('does not render the local list on the tracks, artists or genre tabs', async () => {
    for (const tab of ['tracks', 'artists', 'genre']) {
      await renderWith({ filter: tab, query: 'swing' });

      expect(
        element.shadowRoot!.querySelector('.groups-local-songs'),
        `groups-local-songs must not exist on the ${tab} tab`
      ).toBeNull();
    }

    // Sanity check: the same state on the groups tab DOES render the section.
    await renderWith({ filter: 'groups', query: 'swing' });
    expect(getLocalTrackList()).toBeTruthy();
  });

  it('passes currentSongKey and the progress maps to the local list', async () => {
    mediaState(element).currentSongKey = 'local1';
    mediaState(element)._downloadProgress = new Map<string, number>([['local1', 42]]);
    mediaState(element)._uploadProgress = new Map<string, number>([['local2', 7]]);

    await renderWith({});

    const localList = getLocalTrackList();
    expect(localList).toBeTruthy();
    if (!localList) return;

    expect(localList.currentSongKey).toBe('local1');
    expect(typeof localList.downloadProgressMap).toBe('object');
    expect(localList.downloadProgressMap).not.toBeNull();
    expect(localList.downloadProgressMap).toEqual({ local1: 42 });
    expect(typeof localList.uploadProgressMap).toBe('object');
    expect(localList.uploadProgressMap).not.toBeNull();
    expect(localList.uploadProgressMap).toEqual({ local2: 7 });
  });
});
