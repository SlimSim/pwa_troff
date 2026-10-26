// Regression / contract tests for the tracks-tab header "+" in t-media-parent.
// The + no longer directly opens the file picker. It renders a t-dropdown-button
// whose menu offers two choices. Device choice keeps the old direct _handleAddSong
// (file input click) behaviour. Online choice ("Look for...") enters _onlineAddMode (showing
// t-server-song-list via filterServerSongs + getCached (all songs, empty query ok),
// hiding local content, resetting searchQuery).
//
// "Back to my songs" exits the mode.
//
// Firebase + nDB are fully mocked (no real services). Follows exact patterns from
// t-media-parent-server-search.test.ts and t-media-parent-add-from-device.test.ts
// (deepShadowQuery, flushAsync, nDBStore + firebaseMocks hoisted, _loadSongs +
// _scroll spies, direct state seeding, updateComplete sequencing).
//
// These tests are written to be RED on pre-change code (pre-dropdown + pre-_onlineAddMode
// rendering + pre-back button). On current code they may be GREEN; see run output.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaParent } from './t-media-parent.js';

// ---------------------------------------------------------------------------
// Mock nDB (in-memory) — matches server-search.test.ts exactly so getCached
// and any nDB paths in render / choose do not touch real storage.
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
// Matches server-search.test.ts and t-server-song-list.test.ts
// ---------------------------------------------------------------------------
const firebaseMocks = vi.hoisted(() => ({
  db: {},
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  getDocs: vi.fn(async (_ref: unknown) => ({ docs: [] })),
}));

vi.mock('../../services/firebaseClient.js', () => firebaseMocks);

// ---------------------------------------------------------------------------
// Helpers (exact copy of patterns from t-media-parent-server-search.test.ts)
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

describe('t-media-parent: tracks tab header add dropdown (online vs device)', () => {
  let element: MediaParent;

  beforeEach(() => {
    nDBStore.clear();
    firebaseMocks.getDocs.mockClear();
    firebaseMocks.collection.mockClear();
    firebaseMocks.getDocs.mockResolvedValue({ docs: [] });

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
    vi.restoreAllMocks();
  });

  function getTracksHeaderMoreDropdown(): HTMLElement | null {
    const listHeader = element.shadowRoot?.querySelector('t-list-header');
    if (!listHeader) return null;
    const headerActions = listHeader.querySelector('t-header-actions');
    if (!headerActions) return null;
    // the more dropdown is the t-dropdown-button inside the header-actions
    return headerActions.querySelector('t-dropdown-button') as HTMLElement | null;
  }

  it('renders a more-vertical dropdown (in t-header-actions) with add choices for tracks', async () => {
    await element.updateComplete;
    await element.updateComplete;

    // find any more menu content for tracks
    const moreContent = element.shadowRoot?.querySelector('t-header-actions div[slot="more"]');
    expect(moreContent).toBeTruthy();

    // Choices are in the more menu (as t-butt)
    const choiceItems = Array.from(
      element.shadowRoot!.querySelectorAll(
        't-header-actions div[slot="more"] t-butt'
      ) as NodeListOf<HTMLElement>
    );
    // at least the two add choices (plus sort items)
    const texts = choiceItems.map((i) => (i.textContent || '').trim());
    expect(texts).toContain('Download songs online');
    expect(texts).toContain('Add song from device');
  });

  it('clicking "Add song from device" choice still triggers the file input (via _handleAddSong)', async () => {
    await element.updateComplete;

    const fileInput = element.shadowRoot?.getElementById('fileInput') as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();
    const clickSpy = vi.spyOn(fileInput!, 'click');

    const chooseSpy = vi.spyOn(element as any, '_chooseAddOption');

    await element.updateComplete;
    const moreContent = element.shadowRoot?.querySelector('t-header-actions div[slot="more"]');
    const deviceItem = Array.from(
      moreContent!.querySelectorAll('t-butt') as NodeListOf<HTMLElement>
    ).find((el) => (el.textContent || '').includes('device')) as HTMLElement | undefined;
    expect(deviceItem, 'device choice item must exist').toBeTruthy();

    deviceItem!.click();
    await element.updateComplete;

    expect(chooseSpy).toHaveBeenCalledWith('device');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('clicking "Download songs online" enters _onlineAddMode, shows t-server-song-list, hides local content, resets searchQuery', async () => {
    await element.updateComplete;

    const chooseSpy = vi.spyOn(element as any, '_chooseAddOption');

    await element.updateComplete;
    const moreContent = element.shadowRoot?.querySelector('t-header-actions div[slot="more"]');
    const onlineItem = Array.from(
      moreContent!.querySelectorAll('t-butt') as NodeListOf<HTMLElement>
    ).find((el) => (el.textContent || '').includes('online')) as HTMLElement | undefined;
    expect(onlineItem, 'online choice item must exist').toBeTruthy();

    onlineItem!.click();
    await element.updateComplete;
    await flushAsync();

    expect(chooseSpy).toHaveBeenCalledWith('online');
    expect((element as any)._onlineAddMode).toBe(true);
    expect(element.searchQuery).toBe(''); // reset to show all

    // Server list is rendered in the online branch, using filter+getCached contract.
    const serverList = deepShadowQuery(element.shadowRoot!, 't-server-song-list') as
      | (HTMLElement & { query?: string; tab?: string; songs?: unknown })
      | null;
    expect(serverList).toBeTruthy();
    expect(serverList!.query).toBe('');
    expect(serverList!.tab).toBe('tracks');
    expect(Array.isArray(serverList!.songs)).toBe(true);

    // Local content is hidden via the class (all tracks/artists/genres/groups lists).
    const localContent = element.shadowRoot?.querySelector(
      '.local-songs-content'
    ) as HTMLElement | null;
    expect(localContent).toBeTruthy();
    expect(localContent!.classList.contains('hidden-in-online-mode')).toBe(true);
    // Stronger: computed style must actually hide it.
    expect(getComputedStyle(localContent!).display).toBe('none');
  });

  it('Back to my songs button exists in online mode and exits the mode (shows local again)', async () => {
    await element.updateComplete;

    // Enter online mode directly (simulates choice; keeps test focused and avoids dropdown open timing).
    (element as any)._onlineAddMode = true;
    (element as any).searchQuery = '';
    await element.updateComplete;
    await flushAsync();

    // The back control per spec ("Back to my songs" or ← Back).
    const backContainer = element.shadowRoot?.querySelector('.online-add-back');
    expect(backContainer).toBeTruthy();
    const backBtn = backContainer?.querySelector('t-butt') as HTMLElement | null;
    expect(backBtn).toBeTruthy();
    const backText = deepTextContent(backBtn!).trim();
    expect(backText).toMatch(/← Back to my songs|Back to my songs/i);

    // Click exits.
    backBtn!.click();
    await element.updateComplete;

    expect((element as any)._onlineAddMode).toBe(false);

    // Server list from the online branch is gone.
    expect(deepShadowQuery(element.shadowRoot!, '.online-add-back')).toBeNull();
    // Local content no longer hidden.
    const localContent = element.shadowRoot?.querySelector(
      '.local-songs-content'
    ) as HTMLElement | null;
    expect(localContent).toBeTruthy();
    expect(localContent!.classList.contains('hidden-in-online-mode')).toBe(false);
    expect(getComputedStyle(localContent!).display).not.toBe('none');

    // Local tracks list should be back in the (visible) tree.
    const trackList = element.shadowRoot?.querySelector('t-track-list');
    expect(trackList).toBeTruthy();
  });
});
