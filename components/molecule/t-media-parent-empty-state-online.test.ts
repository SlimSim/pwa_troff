// Contract tests for the "Download songs online" button in the empty state of
// t-media-parent (song list, tracks tab, no songs and no groups).
//
// The empty state must offer four actions in this exact order:
//   1. Download the demo song
//   2. Add songs from device
//   3. Download songs online   <-- new: identical behaviour to the header
//                                  "More actions" dropdown's online item
//   4. Sign in (only when signed out)
//
// Clicking #3 must enter the online add branch: _onlineAddMode = true,
// searchQuery reset to '', t-server-song-list rendered, and
// .local-songs-content hidden via .hidden-in-online-mode.
//
// Firebase + nDB are fully mocked (no real services). Follows the exact
// patterns from t-media-parent-add-dropdown.test.ts (deepShadowQuery,
// flushAsync, nDBStore + firebaseMocks hoisted, _loadSongs + _scroll spies).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaParent } from './t-media-parent.js';

// Private-member access without `any`: only the members this test needs.
interface MediaParentInternals {
  songs: unknown[];
  groups: unknown[];
  currentFilter: string;
  signedIn: boolean;
  _onlineAddMode: boolean;
  _chooseAddOption: (option: 'online' | 'device') => void;
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
// Mock nDB (in-memory) — as in t-media-parent-add-dropdown.test.ts.
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

describe('t-media-parent: empty state "Download songs online" button', () => {
  let element: MediaParent;

  beforeEach(() => {
    nDBStore.clear();
    firebaseMocks.getDocs.mockClear();
    firebaseMocks.collection.mockClear();
    firebaseMocks.getDocs.mockResolvedValue({ docs: [] });

    // Skip real _loadSongs (touches nDB/Cache) and the scroll timer.
    const prototypeInternals = MediaParent.prototype as unknown as MediaParentLoadMethods;
    vi.spyOn(prototypeInternals, '_loadSongs').mockResolvedValue(undefined);
    vi.spyOn(prototypeInternals, '_scrollActiveSongIntoView').mockImplementation(() => {});

    element = new MediaParent();
    document.body.appendChild(element);

    // Empty library, signed out: the full 4-button empty state must render.
    internals(element).songs = [];
    internals(element).groups = [];
    internals(element).currentFilter = 'tracks';
    internals(element).signedIn = false;
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  function getEmptyActionButtons(): HTMLElement[] {
    return Array.from(
      element.shadowRoot?.querySelectorAll('.empty-action-btn') as NodeListOf<HTMLElement>
    );
  }

  it('renders 4 empty-state actions in order: demo, device, online, sign in', async () => {
    await element.updateComplete;

    const buttons = getEmptyActionButtons();
    expect(buttons.length).toBe(4);

    const texts = buttons.map((b) => (b.textContent || '').trim());
    expect(texts[0]).toContain('Download the demo song');
    expect(texts[1]).toContain('Add songs from device');
    expect(texts[2]).toContain('Download songs online');
    expect(texts[3]).toContain('Sign in');
  });

  it('places "Download songs online" immediately after "Add songs from device" with the note-search icon', async () => {
    await element.updateComplete;

    const buttons = getEmptyActionButtons();
    expect(buttons.length).toBe(4);

    const deviceBtn = buttons.find((b) => (b.textContent || '').includes('Add songs from device'));
    const onlineBtn = buttons.find((b) => (b.textContent || '').includes('Download songs online'));
    expect(deviceBtn, 'device button must exist').toBeTruthy();
    expect(onlineBtn, 'online button must exist').toBeTruthy();

    // Immediately after (adjacent siblings in .empty-state-actions).
    expect(onlineBtn!.previousElementSibling).toBe(deviceBtn);
    expect(buttons.indexOf(onlineBtn!)).toBe(buttons.indexOf(deviceBtn!) + 1);

    const onlineIcon = onlineBtn!.querySelector('t-icon');
    expect(onlineIcon).toBeTruthy();
    expect(onlineIcon?.getAttribute('name')).toBe('note-search');
  });

  it('clicking it enters online add mode exactly like the header dropdown item', async () => {
    await element.updateComplete;

    const chooseSpy = vi.spyOn(internals(element), '_chooseAddOption');

    const onlineBtn = getEmptyActionButtons().find((b) =>
      (b.textContent || '').includes('Download songs online')
    );
    expect(onlineBtn, 'online button must exist').toBeTruthy();

    onlineBtn!.click();
    await element.updateComplete;
    await flushAsync();

    expect(chooseSpy).toHaveBeenCalledWith('online');
    expect(internals(element)._onlineAddMode).toBe(true);
    expect(element.searchQuery).toBe(''); // reset so all online songs are shown

    // Online branch renders the server song list.
    const serverList = deepShadowQuery(element.shadowRoot!, 't-server-song-list') as
      | (HTMLElement & { query?: string; tab?: string; songs?: unknown })
      | null;
    expect(serverList).toBeTruthy();
    expect(serverList!.query).toBe('');
    expect(serverList!.tab).toBe('tracks');
    expect(Array.isArray(serverList!.songs)).toBe(true);

    // Local content hidden via the class, and actually hidden by CSS.
    const localContent = element.shadowRoot?.querySelector(
      '.local-songs-content'
    ) as HTMLElement | null;
    expect(localContent).toBeTruthy();
    expect(localContent!.classList.contains('hidden-in-online-mode')).toBe(true);
    expect(getComputedStyle(localContent!).display).toBe('none');
  });
});
