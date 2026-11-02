// Regression / contract tests for the GROUP-aware "online add mode" in
// t-media-parent ("Download songs online" in the header more-menu):
//
// 1. The online-add back bar text depends on the group context:
//      - group context (active group key non-empty):
//          "Look online for new songs to add to this group"
//      - otherwise:
//          "Look online for new songs to add to your library"
// 2. _chooseAddOption('online') records the ACTIVE GROUP KEY in the shared
//    utils/online-group-add module (getActiveOnlineGroupAdd() === 'g1').
// 3. Every path that turns _onlineAddMode OFF also CLEARS the active group:
//      - the "← Back to my songs" button (_exitOnlineAddMode)
//      - a tab switch (_handleFilterChanged)
//      - closing the song-list panel (updated(), visible -> false)
//
// Firebase + nDB are fully mocked (no real services). Follows the exact
// patterns of t-media-parent-add-dropdown.test.ts (in-memory nDBStore map mock,
// hoisted firebaseMocks, deepShadowQuery / deepTextContent / flushAsync helpers,
// _loadSongs + _scrollActiveSongIntoView spies, direct state seeding,
// updateComplete sequencing).
//
// utils/online-group-add is NOT mocked — the real getActiveOnlineGroupAdd is
// imported so the assertions exercise the real module state.
//
// RED pre-implementation: utils/online-group-add.ts does not exist yet, and
// none of the three behaviours above exists in t-media-parent.ts.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaParent } from './t-media-parent.js';
import {
  getActiveOnlineGroupAdd,
  setActiveOnlineGroupAdd,
} from '../../utils/online-group-add.js';

// ---------------------------------------------------------------------------
// Mock nDB (in-memory) — matches t-media-parent-add-dropdown.test.ts exactly so
// getCached / any nDB paths in render / choose do not touch real storage.
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
// Matches t-media-parent-add-dropdown.test.ts
// ---------------------------------------------------------------------------
const firebaseMocks = vi.hoisted(() => ({
  db: {},
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  getDocs: vi.fn(async (_ref: unknown) => ({ docs: [] })),
}));

vi.mock('../../services/firebaseClient.js', () => firebaseMocks);

// ---------------------------------------------------------------------------
// Helpers (exact copy of patterns from t-media-parent-add-dropdown.test.ts)
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

/** Text content across the element and all nested shadow roots. */
function deepTextContent(root: Element | ShadowRoot): string {
  let text = root instanceof Element || root instanceof ShadowRoot ? (root.textContent ?? '') : '';
  for (const child of Array.from(root.querySelectorAll('*'))) {
    if (child.shadowRoot) {
      text += ' ' + deepTextContent(child.shadowRoot);
    }
  }
  return text;
}

/** Wait a macrotask so any (unawaited) async refresh work can settle. */
function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('t-media-parent: group-aware online add (back bar text + active group)', () => {
  let element: MediaParent;

  beforeEach(() => {
    nDBStore.clear();
    firebaseMocks.getDocs.mockClear();
    firebaseMocks.collection.mockClear();
    firebaseMocks.getDocs.mockResolvedValue({ docs: [] });

    // Start every test with no active online group add.
    setActiveOnlineGroupAdd(null);

    // Skip real _loadSongs (touches nDB/Cache) and the scroll timer (see main test file).
    vi.spyOn(MediaParent.prototype as any, '_loadSongs').mockResolvedValue(undefined);
    vi.spyOn(MediaParent.prototype as any, '_scrollActiveSongIntoView').mockImplementation(
      () => {}
    );

    element = new MediaParent();
    document.body.appendChild(element);

    // Seed minimal state so tracks tab renders with header actions + local content.
    (element as any).songs = [
      { songKey: 'local1', title: 'Local Tango' },
      { songKey: 'local2', title: 'Local Waltz' },
    ];
    (element as any).groups = [];
    (element as any).currentFilter = 'tracks';
    (element as any).searchQuery = 'initial';
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    setActiveOnlineGroupAdd(null);
    vi.restoreAllMocks();
  });

  /** Seed a group detail context on the component (as openGroup does). */
  function seedGroupContext(): void {
    (element as any)._contextType = 'group';
    (element as any)._contextKey = 'g1';
    (element as any)._currentGroupKey = 'g1';
  }

  /** Enter online add mode through the real _chooseAddOption('online') in group context. */
  async function enterOnlineAddModeInGroup(): Promise<void> {
    await element.updateComplete;
    seedGroupContext();
    (element as any)._chooseAddOption('online');
    await element.updateComplete;
    await flushAsync();
    await element.updateComplete;
  }

  /** The <span> inside the .online-add-back bar (direct shadow child). */
  function getBackBarSpan(): Element | null {
    return deepShadowQuery(element.shadowRoot!, '.online-add-back span');
  }

  it('back bar says "add to this group" when in group context', async () => {
    await element.updateComplete;

    seedGroupContext();
    (element as any)._onlineAddMode = true;
    (element as any).searchQuery = '';
    await element.updateComplete;
    await flushAsync();

    const span = getBackBarSpan();
    expect(span, '.online-add-back span must render in online mode').toBeTruthy();
    const text = deepTextContent(span!);
    expect(text).toContain('Look online for new songs to add to this group');
  });

  it('back bar says "add to your library" when NOT in group context', async () => {
    await element.updateComplete;

    (element as any)._contextType = '';
    (element as any)._contextKey = '';
    (element as any)._currentGroupKey = '';
    (element as any)._onlineAddMode = true;
    (element as any).searchQuery = '';
    await element.updateComplete;
    await flushAsync();

    const span = getBackBarSpan();
    expect(span, '.online-add-back span must render in online mode').toBeTruthy();
    const text = deepTextContent(span!);
    expect(text).toContain('Look online for new songs to add to your library');
    // Not the group wording.
    expect(text).not.toContain('add to this group');
  });

  it('entering online mode in a group stores the active group key', async () => {
    await element.updateComplete;
    expect(getActiveOnlineGroupAdd()).toBeNull(); // starts clear

    seedGroupContext();
    (element as any)._chooseAddOption('online');
    await element.updateComplete;
    await flushAsync();

    expect((element as any)._onlineAddMode).toBe(true);
    expect(getActiveOnlineGroupAdd()).toBe('g1');
  });

  it('clicking the back button exits online mode AND clears the active group', async () => {
    await enterOnlineAddModeInGroup();

    expect((element as any)._onlineAddMode).toBe(true);
    expect(getActiveOnlineGroupAdd()).toBe('g1'); // set — so the clear below is not vacuous

    const backBtn = element.shadowRoot?.querySelector(
      '.online-add-back t-butt'
    ) as HTMLElement | null;
    expect(backBtn, 'back t-butt must render in online mode').toBeTruthy();

    backBtn!.click();
    await element.updateComplete;

    expect((element as any)._onlineAddMode).toBe(false);
    expect(getActiveOnlineGroupAdd()).toBeNull();
  });

  it('switching tab (_handleFilterChanged) exits online mode AND clears the active group', async () => {
    await enterOnlineAddModeInGroup();

    expect((element as any)._onlineAddMode).toBe(true);
    expect(getActiveOnlineGroupAdd()).toBe('g1'); // set — so the clear below is not vacuous

    (element as any)._handleFilterChanged({ detail: { filter: 'artists' } } as any);
    await element.updateComplete;

    expect((element as any)._onlineAddMode).toBe(false);
    expect(getActiveOnlineGroupAdd()).toBeNull();
  });

  it('closing the panel (visible -> false) exits online mode AND clears the active group', async () => {
    await enterOnlineAddModeInGroup();

    expect((element as any)._onlineAddMode).toBe(true);
    expect(getActiveOnlineGroupAdd()).toBe('g1'); // set — so the clear below is not vacuous

    element.visible = true;
    await element.updateComplete;

    element.visible = false;
    await element.updateComplete;

    expect((element as any)._onlineAddMode).toBe(false);
    expect(getActiveOnlineGroupAdd()).toBeNull();
  });
});
