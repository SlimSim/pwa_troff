// Regression / contract tests for the three "online add mode" behaviours in
// t-media-parent ("Download songs online" in the header more-menu):
//
// 1. The header song-count (t-list-header's `count` property) shows the number
//    of currently-shown ONLINE songs —
//    filterServerSongs(getCachedServerSongList(), searchQuery, currentFilter) —
//    while _onlineAddMode is on, NOT the local songs count.
// 2. Pressing a tab (filter-changed on t-media-footer -> _handleFilterChanged)
//    exits _onlineAddMode.
// 3. Closing the song-list panel (visible becomes false in updated()) exits
//    _onlineAddMode.
//
// Firebase + nDB are fully mocked (no real services). Follows the exact
// patterns of t-media-parent-add-dropdown.test.ts (in-memory nDBStore map mock,
// hoisted firebaseMocks, spies on _loadSongs / _scrollActiveSongIntoView, direct
// state seeding incl. _onlineAddMode).
//
// The online cache is seeded through the REAL refreshServerSongList() fed by
// mocked getDocs docs, so getCachedServerSongList() (actual product code)
// yields exactly 2 server songs, while local `songs` holds 3 — the counts
// differ, which is what proves the branch.
//
// These tests are written to be RED on pre-change code: none of the three
// behaviours (count branch, tab exit, panel-close exit) exists yet.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaParent } from './t-media-parent.js';
import {
  filterServerSongs,
  getCachedServerSongList,
  refreshServerSongList,
  resetServerSongListForTests,
} from '../../utils/server-song-list.js';

// ---------------------------------------------------------------------------
// Mock nDB (in-memory) — matches t-media-parent-add-dropdown.test.ts exactly so
// getCached / refresh / any nDB paths in render never touch real storage.
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
// Matches t-media-parent-add-dropdown.test.ts, with getDocs seeded to two
// public TroffData docs so a refresh re-produces the same 2-song cache.
// ---------------------------------------------------------------------------
const firebaseMocks = vi.hoisted(() => ({
  db: {},
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  getDocs: vi.fn(
    async (
      _ref: unknown
    ): Promise<{ docs: Array<{ id: string; data: () => unknown }> }> => ({ docs: [] })
  ),
}));

vi.mock('../../services/firebaseClient.js', () => firebaseMocks);

// ---------------------------------------------------------------------------
// Fixtures (test data only — no product logic is re-implemented here)
// ---------------------------------------------------------------------------
const MODERN_MILLIS = 1700000000000;

/** Firestore-shaped TroffData doc (snapshot wrapper) for the mocked getDocs. */
function serverDoc(id: number, fileName: string): { id: string; data: () => unknown } {
  return {
    id: String(id),
    data: () => ({
      fileName,
      fileSize: 1000,
      fileType: 'audio/mpeg',
      fileUrl: `https://example.com/${fileName}`,
      id,
      markerJsonString: JSON.stringify({
        markers: [{ color: 'None', id: 'm1', info: '', name: 'Intro', time: 10 }],
        info: '',
      }),
      troffDataPublic: true,
      troffDataUploadedMillis: MODERN_MILLIS,
    }),
  };
}

const TWO_SERVER_DOCS = [serverDoc(1, 'minor-swing.mp3'), serverDoc(2, 'blue-waltz.mp3')];

// ---------------------------------------------------------------------------
// Helpers (exact copy of patterns from t-media-parent-add-dropdown.test.ts)
// ---------------------------------------------------------------------------

/** Wait a macrotask so any (unawaited) async refresh work can settle. */
function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('t-media-parent: online add mode (song-count + exit on tab / panel close)', () => {
  let element: MediaParent;

  beforeEach(async () => {
    nDBStore.clear();
    firebaseMocks.getDocs.mockClear();
    firebaseMocks.collection.mockClear();
    firebaseMocks.getDocs.mockResolvedValue({ docs: TWO_SERVER_DOCS });

    // Seed the online cache through the real refresh path (2 server songs) and
    // clear the module-level session guard so every test starts fresh.
    resetServerSongListForTests();
    await refreshServerSongList();

    // Skip real _loadSongs (touches nDB/Cache) and the scroll timer (see main test file).
    vi.spyOn(MediaParent.prototype as any, '_loadSongs').mockResolvedValue(undefined);
    vi.spyOn(MediaParent.prototype as any, '_scrollActiveSongIntoView').mockImplementation(
      () => {}
    );

    element = new MediaParent();
    document.body.appendChild(element);

    // Seed minimal state: 3 LOCAL songs (deliberately different from the 2
    // online songs), tracks tab, no query, panel closed — then leave online
    // mode off so each test enters it explicitly.
    (element as any).songs = [
      { songKey: 'local1', title: 'Local Tango' },
      { songKey: 'local2', title: 'Local Waltz' },
      { songKey: 'local3', title: 'Local Polka' },
    ];
    (element as any).groups = [];
    (element as any).currentFilter = 'tracks';
    (element as any).searchQuery = '';
    (element as any)._onlineAddMode = false;
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  it('song-count shows the ONLINE song count while _onlineAddMode is on (local count otherwise)', async () => {
    await element.updateComplete;

    // Expected count derived from the actual product code, not a guess.
    const onlineCount = filterServerSongs(getCachedServerSongList(), '', 'tracks').length;
    expect(onlineCount).toBe(2); // fixture sanity: 2 online vs 3 local (not vacuous)
    expect((element as any).songs.length).toBe(3);

    const listHeader = element.shadowRoot?.querySelector('t-list-header') as
      | (HTMLElement & { count?: number })
      | null;
    expect(listHeader, 't-list-header must render').toBeTruthy();

    // Control: outside online mode the count is the LOCAL songs count.
    expect((element as any)._onlineAddMode).toBe(false);
    await element.updateComplete;
    expect(listHeader!.count).toBe(3);

    // Enter online mode (as _chooseAddOption('online') does).
    (element as any)._onlineAddMode = true;
    (element as any).searchQuery = '';
    await element.updateComplete;
    await flushAsync();
    await element.updateComplete;

    expect((element as any)._onlineAddMode).toBe(true); // still in the mode
    // RED on pre-change code: falls back to the local count (3) instead of 2.
    expect(listHeader!.count).toBe(onlineCount);
  });

  it('switching tab (filter-changed on t-media-footer) exits online mode', async () => {
    await element.updateComplete;

    (element as any)._onlineAddMode = true;
    await element.updateComplete;
    expect((element as any)._onlineAddMode).toBe(true);

    const footer = element.shadowRoot?.querySelector('t-media-footer');
    expect(footer, 't-media-footer must render').toBeTruthy();

    footer!.dispatchEvent(
      new CustomEvent('filter-changed', { detail: { filter: 'artists' } })
    );
    await element.updateComplete;

    // Existing behaviour still holds...
    expect((element as any).currentFilter).toBe('artists');
    expect((element as any).searchQuery).toBe('');
    // RED on pre-change code: online mode survives the tab switch (true).
    expect((element as any)._onlineAddMode).toBe(false);
  });

  it('closing the song-list panel (visible -> false) exits online mode', async () => {
    element.visible = true;
    await element.updateComplete;
    (element as any)._onlineAddMode = true;
    await element.updateComplete;
    expect((element as any)._onlineAddMode).toBe(true);

    element.visible = false;
    await element.updateComplete;

    // RED on pre-change code: online mode survives the panel close (true).
    expect((element as any)._onlineAddMode).toBe(false);
  });
});
