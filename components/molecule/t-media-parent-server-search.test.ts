// Integration tests: merged local + server song search inside
// t-media-parent (see tests/server-song-list.test.ts for the data layer and
// components/molecule/t-server-song-list.test.ts for the section itself).
//
// Feature spec (decisions pinned here):
// - The server song list is fetched LAZILY: not at mount, but on the first
//   non-empty search query — and only once per session (session guard).
// - While a query is active, t-media-parent renders <t-server-song-list>
//   (with .query, .tab and .songs) on ALL FOUR tabs: tracks, groups,
//   artists and genre.
// - No section is rendered for an empty/whitespace query.
// - The section includes a "Not finding it? Add song from device" row
//   (.add-song-from-device-row with a note-plus t-icon) that runs the
//   EXISTING add-from-device flow (opens the hidden #fileInput).
// - The welcome empty state must NOT be shown while a query is active —
//   the search results (.no-results) and the server section take over.
//
// Firebase and nDB are mocked (no real services). The find.html header
// button removal is pinned in t-media-parent.test.ts.
//
// RED note: t-media-parent.ts does not render t-server-song-list or the
// add-from-device row yet, and nothing triggers the server fetch yet — so
// these tests fail until the feature is implemented.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaParent } from './t-media-parent.js';

// ---------------------------------------------------------------------------
// Mock nDB (in-memory) — t-media-parent and the upcoming server-song-list
// data layer both read/write nDB. Factory bodies only touch nDBStore inside
// call-time closures, so the static MediaParent import above is safe.
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
// Mock firebaseClient (used by the upcoming utils/server-song-list.ts).
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
  let text = root instanceof Element || root instanceof ShadowRoot ? root.textContent ?? '' : '';
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

describe('t-media-parent: merged local + server song search', () => {
  let element: MediaParent;

  beforeEach(() => {
    nDBStore.clear();
    firebaseMocks.getDocs.mockClear();
    firebaseMocks.collection.mockClear();
    firebaseMocks.getDocs.mockResolvedValue({ docs: [] });

    // Skip the async _loadSongs() from connectedCallback and neutralize the
    // fire-and-forget scroll timer (same hygiene as t-media-parent.test.ts).
    vi.spyOn(MediaParent.prototype as any, '_loadSongs').mockResolvedValue(undefined);
    vi.spyOn(MediaParent.prototype as any, '_scrollActiveSongIntoView').mockImplementation(
      () => {}
    );

    element = new MediaParent();
    document.body.appendChild(element);

    (element as any).songs = [];
    (element as any).groups = [];
    (element as any).currentFilter = 'tracks';
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  /**
   * Type into the real search input (tracks tab header) so both the
   * search-input handler and any searchQuery-driven lifecycle hook run.
   */
  async function typeQuery(value: string): Promise<void> {
    await element.updateComplete;

    const listHeader = element.shadowRoot?.querySelector('t-list-header');
    const headerActions = listHeader?.querySelector('t-header-actions') as
      | (HTMLElement & { updateComplete: Promise<void> })
      | null;
    if (!headerActions) {
      throw new Error('Expected t-header-actions in the tracks list header');
    }
    await headerActions.updateComplete;

    const tInput = headerActions.shadowRoot?.querySelector('t-input.search-input') as
      | (HTMLElement & { updateComplete: Promise<void> })
      | null;
    if (!tInput) {
      throw new Error('Expected t-input.search-input in t-header-actions shadow root');
    }
    await tInput.updateComplete;

    const nativeInput = tInput.shadowRoot?.querySelector('input') as HTMLInputElement | null;
    if (!nativeInput) {
      throw new Error('Expected native input inside t-input shadow root');
    }

    nativeInput.value = value;
    nativeInput.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));

    await element.updateComplete;
    await element.updateComplete;
  }

  it('does not fetch the server song list at mount (it is lazy — only on search)', async () => {
    await element.updateComplete;
    await flushAsync();

    expect(firebaseMocks.getDocs).not.toHaveBeenCalled();
  });

  it('the first non-empty query fetches the TroffData collection exactly once', async () => {
    expect(firebaseMocks.getDocs).not.toHaveBeenCalled();

    await typeQuery('swing');
    await flushAsync();

    expect(firebaseMocks.collection).toHaveBeenCalledWith(expect.anything(), 'TroffData');
    expect(firebaseMocks.getDocs).toHaveBeenCalledTimes(1);
  });

  it('renders t-server-song-list with the query and tab on all four tabs', async () => {
    for (const tab of ['tracks', 'groups', 'artists', 'genre'] as const) {
      (element as any).currentFilter = tab;
      (element as any).searchQuery = 'swing';
      await element.updateComplete;
      await element.updateComplete;

      const serverList = deepShadowQuery(element.shadowRoot!, 't-server-song-list') as
        | (HTMLElement & {
            query?: string;
            tab?: string;
            songs?: unknown;
            updateComplete?: Promise<void>;
          })
        | null;

      expect(serverList, `t-server-song-list missing on the ${tab} tab`).toBeTruthy();
      expect(serverList!.tab).toBe(tab);
      expect(serverList!.query).toBe('swing');
      expect(Array.isArray(serverList!.songs)).toBe(true);
    }
  });

  it('does not render the server song section for an empty or whitespace query', async () => {
    for (const query of ['', '   ']) {
      (element as any).searchQuery = query;
      await element.updateComplete;
      await element.updateComplete;

      expect(deepShadowQuery(element.shadowRoot!, 't-server-song-list')).toBeNull();
    }
  });

  it('the server section includes an "Add song from device" row that opens the file picker', async () => {
    (element as any).searchQuery = 'swing';
    await element.updateComplete;
    await element.updateComplete;
    await flushAsync();

    const row = deepShadowQuery(element.shadowRoot!, '.add-song-from-device-row');
    expect(row).toBeTruthy();
    expect(deepTextContent(row!).toLowerCase()).toContain('add song');
    expect(deepShadowQuery(row!, 't-icon[name="note-plus"]')).toBeTruthy();

    const fileInput = element.shadowRoot?.getElementById('fileInput') as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();
    const clickSpy = vi.spyOn(fileInput!, 'click');

    // Click the innermost icon: the click bubbles to whatever carries the
    // @click handler (row container or wrapping t-butt), like a real tap.
    const icon = deepShadowQuery(row!, 't-icon[name="note-plus"]') as HTMLElement;
    icon.click();

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('does not show the welcome empty state while a query is active', async () => {
    (element as any).songs = [];
    (element as any).groups = [];
    (element as any).searchQuery = 'swing';
    await element.updateComplete;
    await element.updateComplete;
    await flushAsync();

    expect(element.shadowRoot?.querySelector('.empty-state')).toBeNull();
    // The local no-results block and the server section take over instead.
    expect(element.shadowRoot?.querySelector('.no-results')).toBeTruthy();
    expect(deepShadowQuery(element.shadowRoot!, 't-server-song-list')).toBeTruthy();
  });
});
