// Regression / contract tests for standalone server sort in t-media-parent
// when _onlineAddMode is true ("Download songs online" view).
//
// Per spec:
// - t-header-actions (via hideMore + slot="sort") must render a standalone
//   sort t-dropdown-button (icon-only <t-butt> with <t-icon name="sort">)
//   instead of the .header-more-dropdown.
// - The server sort dropdown has Asc/Desc (with ✓ check on active) + divider +
//   By Upload Date / By Size / By Filename.
// - serverSortBy ('uploaded'|'size'|'fileName') + serverSortOrder default
//   'uploaded'+'descending'.
// - t-server-song-list receives
//     sortServerSongs( filterServerSongs(getCachedServerSongList(), query, tab), sortBy, order )
// - Search stays visible.
// - Outside online: normal more dropdown, no server sort slot.
//
// Uses exact mocking + typed-internals (no `any`) from
// t-media-parent-empty-state-online.test.ts (nDBStore, hoisted firebaseMocks,
// flushAsync, deepShadowQuery, prototype cast for spies).
//
// These tests are written to produce RED until the header-actions hideMore+slot,
// the online conditional in t-media-parent, the _renderServerSortDropdown,
// the server state, and the sortServerSongs call site + utils impl exist.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaParent } from './t-media-parent.js';

// Private-member access without `any`: only the members this test needs.
interface MediaParentInternals {
  songs: unknown[];
  groups: unknown[];
  currentFilter: string;
  searchQuery: string;
  _onlineAddMode: boolean;
  serverSortBy: string;
  serverSortOrder: string;
  _chooseAddOption: (option: 'online' | 'device') => void;
  _exitOnlineAddMode: () => void;
  _loadSongs: () => Promise<void>;
  _scrollActiveSongIntoView: () => void;
}

const internals = (element: MediaParent): MediaParentInternals =>
  element as unknown as MediaParentInternals;

type MediaParentLoadMethods = Pick<
  MediaParentInternals,
  '_loadSongs' | '_scrollActiveSongIntoView'
>;

// ---------------------------------------------------------------------------
// Mock nDB (in-memory) — matches empty-state-online.test.ts and add-dropdown
// exactly so getCachedServerSongList + any nDB paths never touch real storage.
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
// Mock firebaseClient (used inside refreshServerSongList via lazy import).
// Matches the style of the referenced tests.
// ---------------------------------------------------------------------------
const firebaseMocks = vi.hoisted(() => ({
  db: {},
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  getDocs: vi.fn(async (_ref: unknown) => ({ docs: [] })),
}));

vi.mock('../../services/firebaseClient.js', () => firebaseMocks);

// ---------------------------------------------------------------------------
// Helpers (exact copy of patterns from t-media-parent-empty-state-online.test.ts)
// ---------------------------------------------------------------------------

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

describe('t-media-parent: online mode server sort dropdown and sorted server list', () => {
  let element: MediaParent;

  // Pre-seed via nDB so getCachedServerSongList() (product path) yields these
  // with distinct uploaded/size/filename for verifying sort order.
  // (input order deliberately not matching any target sort order)
  const serverFixtures = [
    {
      deleted: false,
      fileNameUri: 'my%20song%20file.mp3',
      size: 200,
      troffDataIdObjectList: [{ troffDataId: 10, displayName: 'My Song File' }],
      type: 'audio/mpeg',
      uploaded: 1000,
    },
    {
      deleted: false,
      fileNameUri: 'a-first.mp3',
      size: 300,
      troffDataIdObjectList: [{ troffDataId: 20, displayName: 'A First' }],
      type: 'audio/mpeg',
      uploaded: 2000,
    },
    {
      deleted: false,
      fileNameUri: 'z-last.mp3',
      size: 100,
      troffDataIdObjectList: [{ troffDataId: 30, displayName: 'Z Last' }],
      type: 'audio/mpeg',
      uploaded: 3000,
    },
  ];

  beforeEach(() => {
    nDBStore.clear();
    nDBStore.set('TROFF_SERVER_SONG_LIST_FROM_SERVER', serverFixtures);

    firebaseMocks.getDocs.mockClear();
    firebaseMocks.collection.mockClear();
    firebaseMocks.getDocs.mockResolvedValue({ docs: [] });

    // Skip real _loadSongs (touches nDB/Cache) and the scroll timer.
    const prototypeInternals = MediaParent.prototype as unknown as MediaParentLoadMethods;
    vi.spyOn(prototypeInternals, '_loadSongs').mockResolvedValue(undefined);
    vi.spyOn(prototypeInternals, '_scrollActiveSongIntoView').mockImplementation(() => {});

    element = new MediaParent();
    document.body.appendChild(element);

    internals(element).songs = [];
    internals(element).groups = [];
    internals(element).currentFilter = 'tracks';
    // Set non-empty first so we can set '' without immediately triggering refresh
    // while still !online.
    internals(element).searchQuery = 'initial';
    internals(element)._onlineAddMode = false;
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  function getHeaderActions(): Element | null {
    const listHeader = element.shadowRoot?.querySelector('t-list-header');
    if (!listHeader) return null;
    return listHeader.querySelector('t-header-actions');
  }

  it('in online mode: header-actions has slot="sort" t-dropdown-button with sort icon, NO .header-more-dropdown', async () => {
    // Set query='' while !online (avoids maybeRefresh path).
    internals(element).searchQuery = '';
    await element.updateComplete;

    internals(element)._onlineAddMode = true;
    await element.updateComplete;
    await flushAsync();

    expect(internals(element)._onlineAddMode).toBe(true);

    const ha = getHeaderActions();
    expect(ha).toBeTruthy();

    // The standalone sort must be provided via the new slot (light child of host).
    const sortSlot = ha!.querySelector('t-dropdown-button[slot="sort"]');
    expect(sortSlot, 'standalone sort t-dropdown-button (slot="sort") must exist in online mode').toBeTruthy();

    const sortIcon = sortSlot!.querySelector('t-icon[name="sort"]');
    expect(sortIcon).toBeTruthy();
    // icon-only (no text node next to icon like the "Sort" label in local more)
    const triggerText = (sortSlot!.textContent || '').trim();
    expect(triggerText).not.toContain('Sort');

    // No more content passed and no more dropdown rendered (hideMore=true case).
    const moreContent = element.shadowRoot?.querySelector('t-header-actions div[slot="more"]');
    expect(moreContent).toBeNull();

    const moreDd = deepShadowQuery(element.shadowRoot!, '.header-more-dropdown');
    expect(moreDd).toBeNull();
  });

  it('default order on t-server-song-list is uploaded descending', async () => {
    internals(element).searchQuery = '';
    await element.updateComplete;

    internals(element)._onlineAddMode = true;
    await element.updateComplete;
    await flushAsync();

    expect(internals(element).serverSortBy).toBe('uploaded');
    expect(internals(element).serverSortOrder).toBe('descending');

    const serverList = deepShadowQuery(element.shadowRoot!, 't-server-song-list') as
      | (HTMLElement & { songs?: Array<{ fileNameUri: string }> })
      | null;
    expect(serverList).toBeTruthy();
    expect(Array.isArray(serverList!.songs)).toBe(true);

    const songUris = (serverList!.songs ?? []).map((s) => s.fileNameUri);
    // uploaded desc (newest first): 3000 z-last, 2000 a-first, 1000 my%20
    expect(songUris).toEqual(['z-last.mp3', 'a-first.mp3', 'my%20song%20file.mp3']);
  });

  it('clicking changes sortBy/order and the .songs prop on the server list reflects the new order (use distinct fixtures, focus on tracks)', async () => {
    internals(element).searchQuery = '';
    await element.updateComplete;

    internals(element)._onlineAddMode = true;
    await element.updateComplete;
    await flushAsync();

    // Locate a sort trigger (represents the standalone one once rendered).
    const ha = getHeaderActions()!;
    const trigger = deepShadowQuery(element.shadowRoot!, 't-butt[title="Sort options"]') as HTMLElement | null;
    if (trigger) {
      trigger.click();
      await element.updateComplete;
      await flushAsync();
    }

    // Locate a "By Filename" style option in the (future) standalone server sort.
    // (Will not be present until _renderServerSortDropdown + slot usage in online branch.)
    function findSortOptionByText(needle: string): HTMLElement | undefined {
      const candidates = Array.from(
        element.shadowRoot?.querySelectorAll('.sort-option-item') ?? []
      ) as HTMLElement[];
      let match = candidates.find((el) => (el.textContent || '').includes(needle));
      if (match) return match;

      const deepMatch = deepShadowQuery(element.shadowRoot!, '.sort-option-item');
      if (deepMatch && (deepMatch.textContent || '').includes(needle)) {
        return deepMatch as HTMLElement;
      }
      return undefined;
    }

    const byFileNameItem = findSortOptionByText('Filename') || findSortOptionByText('fileName');
    expect(byFileNameItem, 'By Filename option must exist in the server sort dropdown').toBeTruthy();

    byFileNameItem!.click();
    await element.updateComplete;
    await flushAsync();

    // The click (via the server sort handlers) must have updated the state.
    expect(internals(element).serverSortBy).toBe('fileName');
    // order defaults to ascending when not specified by click, or explicit in real
    // (test accepts the resulting order after change)
    const serverList = deepShadowQuery(element.shadowRoot!, 't-server-song-list') as
      | (HTMLElement & { songs?: Array<{ fileNameUri: string }> })
      | null;
    expect(serverList).toBeTruthy();

    const songUris = (serverList!.songs ?? []).map((s) => s.fileNameUri);
    // After change to fileName the order must be filename asc (distinct fixtures)
    // a-first, my%20song%20file, z-last
    expect(songUris).toEqual(['a-first.mp3', 'my%20song%20file.mp3', 'z-last.mp3']);
  });

  it('when not entering online mode, the more dropdown is back and no server-sort slot', async () => {
    await element.updateComplete;
    await flushAsync();

    expect(internals(element)._onlineAddMode).toBe(false);

    const ha = getHeaderActions();
    const sortSlot = ha?.querySelector('t-dropdown-button[slot="sort"]');
    expect(sortSlot).toBeNull();

    const moreContent = element.shadowRoot?.querySelector('t-header-actions div[slot="more"]');
    expect(moreContent).toBeTruthy();

    const moreDd = deepShadowQuery(element.shadowRoot!, '.header-more-dropdown');
    expect(moreDd).toBeTruthy();
  });

  it('exiting online mode restores the more dropdown and removes the server-sort slot', async () => {
    internals(element).searchQuery = '';
    await element.updateComplete;
    internals(element)._onlineAddMode = true;
    await element.updateComplete;
    await flushAsync();

    let ha = getHeaderActions()!;
    expect(ha.querySelector('t-dropdown-button[slot="sort"]')).toBeTruthy();

    internals(element)._exitOnlineAddMode();
    await element.updateComplete;

    expect(internals(element)._onlineAddMode).toBe(false);

    ha = getHeaderActions()!;
    expect(ha.querySelector('t-dropdown-button[slot="sort"]')).toBeNull();

    const moreContent = element.shadowRoot?.querySelector('t-header-actions div[slot="more"]');
    expect(moreContent).toBeTruthy();
  });
});
