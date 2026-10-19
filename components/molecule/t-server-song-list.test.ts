// Component tests for the "Merged local + server song search" feature —
// the "On Troff's server" results section (components/molecule/
// t-server-song-list.ts, NEW) and its "more about version" dialog
// (components/molecule/t-version-info-dialog.ts, NEW).
//
// DOM contract pinned here (documented decisions — the orchestrator
// implements to this contract):
//   <t-server-song-list .songs .query .tab .loading>
//   - renders NOTHING when query is empty/whitespace
//   - .server-song-section
//     - .server-song-section-header (per-tab heading area)
//     - .server-song-row            (one per song: file name, "N versions",
//                                    a chevron t-icon; click expands only —
//                                    never navigates/downloads)
//     - .server-version-card        (one per version, only while expanded:
//                                    .version-display-name, .version-nr-markers,
//                                    .version-uploaded, .version-genre-tags,
//                                    a download link whose href contains
//                                    '#<troffDataId>&<fileNameUri>', and a
//                                    .more-about-version control that
//                                    dispatches 'version-info-requested' with
//                                    detail { troffDataId } (bubbles+composed))
//     - .server-song-empty          (when the filtered list is empty)
//   - loading → a t-loading element or /loading/i text
//   <t-version-info-dialog .fileNameUri .troffDataId .markers>
//   - renders the marker names + time (raw '42' or formatted '0:42')
//   - a download link whose href contains '#<troffDataId>&<fileNameUri>'
//
// Songs passed in already match the query — parent-side filtering is covered
// by tests/server-song-list.test.ts (filterServerSongs).
//
// RED note: neither component module exists yet, so the imports below fail
// ("Failed to resolve module") until the feature is implemented.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ServerSongList } from './t-server-song-list.js';
import { VersionInfoDialog } from './t-version-info-dialog.js';
import type { ServerSong, TroffDataIdObject, TroffMarker } from '../../types/troff.d.js';

// ---------------------------------------------------------------------------
// Mock nDB and Firebase so nothing real is ever reached, whatever the new
// components' import graph ends up containing. Factories only touch these
// values inside call bodies (or via vi.hoisted), so static imports are safe.
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

const firebaseMocks = vi.hoisted(() => ({
  db: {},
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  getDocs: vi.fn(async (_ref: unknown) => ({ docs: [] })),
}));

vi.mock('../../services/firebaseClient.js', () => firebaseMocks);

// ---------------------------------------------------------------------------
// Fixtures (test data only — no product logic is re-implemented)
// ---------------------------------------------------------------------------

const MODERN_MILLIS = 1700000000000;

function makeVersion(
  troffDataId: number,
  overrides: Partial<TroffDataIdObject> = {}
): TroffDataIdObject {
  return {
    displayName: 'Unknown',
    firstTimeLoaded: MODERN_MILLIS,
    genre: '',
    infoBeginning: '',
    nrMarkers: 0,
    tags: '',
    troffDataId,
    ...overrides,
  };
}

function makeServerSong(
  fileNameUri: string,
  troffDataIdObjectList: TroffDataIdObject[],
  overrides: Partial<ServerSong> = {}
): ServerSong {
  return {
    deleted: false,
    fileNameUri,
    size: 1000,
    troffDataIdObjectList,
    type: 'audio/mpeg',
    uploaded: MODERN_MILLIS,
    ...overrides,
  };
}

const swing = makeServerSong('minor-swing.mp3', [
  makeVersion(11, { genre: 'Jazz', nrMarkers: 3 }),
  makeVersion(12, {
    displayName: 'Minor Swing (alt)',
    genre: 'Swing',
    nrMarkers: 5,
    firstTimeLoaded: 1700000111000,
  }),
]);
const waltz = makeServerSong('blue-waltz.mp3', [
  makeVersion(21, { genre: 'Waltz', nrMarkers: 2 }),
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Query an element or selector inside the component's shadow DOM. */
function shadowOf(element: ServerSongList): ShadowRoot {
  const shadow = element.shadowRoot;
  if (!shadow) {
    throw new Error('Expected t-server-song-list to have a shadow root');
  }
  return shadow;
}

/** Every href (attribute or reflected property) below the given root. */
function allHrefs(root: Element | ShadowRoot): string[] {
  const nodes: (Element | ShadowRoot)[] = [root, ...Array.from(root.querySelectorAll('*'))];
  const hrefs: string[] = [];
  for (const node of nodes) {
    if (!(node instanceof Element)) continue;
    const attr = node.getAttribute('href');
    if (typeof attr === 'string') {
      hrefs.push(attr);
      continue;
    }
    const prop = (node as unknown as { href?: unknown }).href;
    if (typeof prop === 'string') {
      hrefs.push(prop);
    }
  }
  return hrefs;
}

// ---------------------------------------------------------------------------
// t-server-song-list
// ---------------------------------------------------------------------------

describe('t-server-song-list', () => {
  let element: ServerSongList;

  beforeEach(() => {
    nDBStore.clear();

    element = new ServerSongList();
    document.body.appendChild(element);

    (element as unknown as { songs: ServerSong[] }).songs = [swing, waltz];
    (element as unknown as { query: string }).query = 'swing';
    (element as unknown as { tab: 'tracks' | 'groups' | 'artists' | 'genre' }).tab = 'tracks';
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  it('renders a section with a header and one row per song', async () => {
    await element.updateComplete;

    const shadow = shadowOf(element);
    expect(shadow.querySelector('.server-song-section')).toBeTruthy();
    expect(shadow.querySelector('.server-song-section-header')).toBeTruthy();

    const rows = shadow.querySelectorAll('.server-song-row');
    expect(rows.length).toBe(2);
  });

  it('each row shows the file name, the version count and a chevron icon', async () => {
    await element.updateComplete;

    const rows = Array.from(shadowOf(element).querySelectorAll('.server-song-row'));
    expect(rows.length).toBe(2);

    // 2 versions
    expect(rows[0].textContent).toContain('minor-swing.mp3');
    expect(rows[0].textContent).toMatch(/\b2\s+versions?\b/i);
    expect(rows[0].querySelector('t-icon[name^="chevron"]')).toBeTruthy();

    // 1 version
    expect(rows[1].textContent).toContain('blue-waltz.mp3');
    expect(rows[1].textContent).toMatch(/\b1\s+version\b/i);
    expect(rows[1].querySelector('t-icon[name^="chevron"]')).toBeTruthy();
  });

  it('renders nothing (no section) when the query is empty', async () => {
    (element as unknown as { query: string }).query = '';
    await element.updateComplete;

    expect(shadowOf(element).querySelector('.server-song-section')).toBeNull();
  });

  it('shows a loading indicator while loading is true', async () => {
    (element as unknown as { loading: boolean }).loading = true;
    await element.updateComplete;

    const shadow = shadowOf(element);
    const loadingEl = shadow.querySelector('t-loading');
    const text = shadow.textContent ?? '';
    expect(loadingEl !== null || /loading/i.test(text)).toBe(true);
  });

  it('clicking a row expands its versions without navigating or downloading', async () => {
    await element.updateComplete;

    const shadow = shadowOf(element);
    const row = shadow.querySelector('.server-song-row');
    expect(row).toBeTruthy();

    // Rows are not links — tapping one must never change the location hash.
    expect(row!.getAttribute('href')).toBeNull();
    expect((row as unknown as { href?: unknown }).href ?? '').toBe('');
    const hashBefore = window.location.hash;

    // Collapsed initially: no version cards in the DOM.
    expect(shadow.querySelectorAll('.server-version-card').length).toBe(0);

    const chevron = row!.querySelector('t-icon[name^="chevron"]') as HTMLElement | null;
    expect(chevron).toBeTruthy();
    chevron!.click();
    await element.updateComplete;

    expect(shadow.querySelectorAll('.server-version-card').length).toBe(2);
    expect(window.location.hash).toBe(hashBefore);

    // Clicking again collapses the accordion.
    chevron!.click();
    await element.updateComplete;

    expect(shadow.querySelectorAll('.server-version-card').length).toBe(0);
  });

  it('each expanded version offers a download link #<troffDataId>&<fileNameUri> and shows its metadata', async () => {
    await element.updateComplete;

    const shadow = shadowOf(element);
    const chevron = shadow.querySelector(
      '.server-song-row t-icon[name^="chevron"]'
    ) as HTMLElement | null;
    expect(chevron).toBeTruthy();
    chevron!.click();
    await element.updateComplete;

    const cards = Array.from(shadow.querySelectorAll('.server-version-card'));
    expect(cards.length).toBe(2);

    // Version 11 (no custom display name → falls back to something present)
    expect(allHrefs(cards[0]).join(' ')).toContain('#11&minor-swing.mp3');
    expect(cards[0].textContent).toContain('3');

    // Version 12
    expect(allHrefs(cards[1]).join(' ')).toContain('#12&minor-swing.mp3');
    expect(cards[1].querySelector('.version-display-name')?.textContent).toContain(
      'Minor Swing (alt)'
    );
    expect(cards[1].querySelector('.version-nr-markers')?.textContent).toContain('5');
  });

  it('the "more about version" control dispatches version-info-requested with the troffDataId', async () => {
    await element.updateComplete;

    const shadow = shadowOf(element);
    const chevron = shadow.querySelector(
      '.server-song-row t-icon[name^="chevron"]'
    ) as HTMLElement | null;
    expect(chevron).toBeTruthy();
    chevron!.click();
    await element.updateComplete;

    const controls = shadow.querySelectorAll('.more-about-version');
    expect(controls.length).toBe(2);

    const captured: CustomEvent<{ troffDataId: number }>[] = [];
    element.addEventListener('version-info-requested', (event: Event) => {
      captured.push(event as CustomEvent<{ troffDataId: number }>);
    });

    (controls[0] as HTMLElement).click();

    expect(captured.length).toBe(1);
    expect(captured[0].detail.troffDataId).toBe(11);
    expect(captured[0].bubbles).toBe(true);
    expect(captured[0].composed).toBe(true);
  });

  it('shows the empty state when there are no matching server songs', async () => {
    (element as unknown as { songs: ServerSong[] }).songs = [];
    (element as unknown as { query: string }).query = 'zzz-no-match';
    await element.updateComplete;

    const shadow = shadowOf(element);
    expect(shadow.querySelector('.server-song-empty')).toBeTruthy();
    expect(shadow.querySelectorAll('.server-song-row').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// t-version-info-dialog (light coverage)
// ---------------------------------------------------------------------------

describe('t-version-info-dialog', () => {
  let dialog: VersionInfoDialog;

  beforeEach(() => {
    dialog = new VersionInfoDialog();
    document.body.appendChild(dialog);

    (dialog as unknown as { fileNameUri: string }).fileNameUri = 'tango-a.mp3';
    (dialog as unknown as { troffDataId: number }).troffDataId = 42;
    (dialog as unknown as { markers: TroffMarker[] }).markers = [
      { color: 'None', id: 'm1', info: '', name: 'Chorus', time: 42 },
      { color: 'None', id: 'm2', info: '', name: 'Bridge', time: 100 },
    ];
  });

  afterEach(() => {
    if (document.body.contains(dialog)) {
      document.body.removeChild(dialog);
    }
  });

  it('renders the version markers (names and the marker time)', async () => {
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();

    const text = shadow?.textContent ?? '';
    expect(text).toContain('Chorus');
    expect(text).toContain('Bridge');
    // time = 42 renders either raw ('42') or formatted ('0:42') — both OK
    expect(text).toContain('42');
  });

  it('offers a download link for exactly this version (#<troffDataId>&<fileNameUri>)', async () => {
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();

    expect(allHrefs(shadow!).join(' ')).toContain('#42&tango-a.mp3');
  });
});
