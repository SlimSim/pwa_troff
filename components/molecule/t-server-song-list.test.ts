// Component tests for the "Merged local + server song search" feature —
// the "On Troff's server" results section (components/molecule/
// t-server-song-list.ts) and its "more about version" dialog
// (components/molecule/t-version-info-dialog.ts).
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
//   <t-version-info-dialog .fileNameUri .troffDataId .markers .duration .versions .info>
//   - in .dialog-header:
//       • <h2 class="dialog-title"> shows the decoded file-name (from .fileNameUri; use safeDecodeURIComponent logic)
//         — NOT generic "Version info" (h2 for fileName modeled after find.html moreAboutVersionDialog)
//       • when present on the current version (the TroffDataIdObject in .versions whose troffDataId === .troffDataId):
//         p elements (some with float-right) for artist, song title (the 'title' field), choreography, choreographer
//         — only render non-empty / truthy string fields (no empty p's)
//       • <t-dropdown-button class="info-dropdown"> (read-only, exactly like
//         the .info-dropdown in t-header.ts) whose dropdown content contains
//         the current version's info text
//   - renders the markers on a display-only t-marker-slider timeline (the
//     slider gets .min=0 and .max= the duration when > 0, else the last
//     marker's time); each marker appears as a t-marker inside the slider's
//     shadow root with formatted time, the marker name and — only when
//     info is non-empty — a t-popover carrying the info
//   - a download link whose href contains '#<troffDataId>&<fileNameUri>'
//   - in .dialog-footer (same row as Download): .prev-version and .next-version
//     <t-butt> buttons; when enabled their text shows only the nr of markers for the target version
//     e.g. "Previous version (14 markers)" or "Next version (3 markers)" (skip displayName entirely).
//     Clicking enabled ones dispatches
//     bubbling+composed 'version-navigated' CustomEvent with detail
//     { troffDataId: adjacentId } based on position of current .troffDataId
//     inside the .versions array (TroffDataIdObject[]). Disabled at list ends
//     or for single-version songs. Parent passes .versions from the song's
//     troffDataIdObjectList (via _infoTarget) and .info (from cache/fetch) and
//     listens for the event to update troffDataId + reload info/markers/duration
//     while keeping dialog mounted.
//
// Data plumbing (tested via mocks + prop passing):
//   - getCachedVersionInfo and fetch path also surface info
//   - _info state added in t-server-song-list, reset with markers/duration
//   - .info=${this._info} passed to dialog
//
// Songs passed in already match the query — parent-side filtering is covered
// by tests/server-song-list.test.ts (filterServerSongs).
//
// RED note: tests for the file-name header, metadata fields (artist/title/etc),
// "only nr markers on nav buttons" (no displayName) and the navigation update
// test are intentionally RED until the dialog header/footer are updated in
// t-version-info-dialog.ts (pre-existing tests remain GREEN on current impl).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ServerSongList } from './t-server-song-list.js';
import { VersionInfoDialog } from './t-version-info-dialog.js';
// Namespace imports of the mocked modules (vi.mock above is hoisted, so these
// resolve to the mock factories) — typed via vi.mocked(...) in the tests.
import * as hashDownload from '../../utils/hash-download.js';
import * as serverSongList from '../../utils/server-song-list.js';
import type { MarkerSlider } from '../organisms/t-marker-slider.js';
import type { ServerSong, TroffDataIdObject, TroffMarker } from '../../types/troff.d.js';
import {
  TROFF_SETTING_EXTENDED_MARKER_COLOR,
  TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR,
} from '../../constants/constants.js';

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

// The component reads markers + duration from the session cache first and
// only falls back to a Firestore fetch on a cache miss — mock both modules so
// the tests can pin which path was taken (the default fetch result is ok:false,
// which matches the pre-cache behaviour: quiet log, empty markers).
vi.mock('../../utils/hash-download.js', () => ({
  fetchServerTroffDataResult: vi.fn(async () => ({
    ok: false,
    useAlert: false,
    message: 'fetch not mocked',
  })),
}));
vi.mock('../../utils/server-song-list.js', () => ({
  getCachedVersionInfo: vi.fn(() => null),
}));

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

  it('the version-info dialog can be reopened after being cancelled', async () => {
    await element.updateComplete;

    const shadow = shadowOf(element);
    const chevron = shadow.querySelector(
      '.server-song-row t-icon[name^="chevron"]'
    ) as HTMLElement | null;
    expect(chevron).toBeTruthy();
    chevron!.click();
    await element.updateComplete;

    const firstMore = shadow.querySelector('.more-about-version') as HTMLElement | null;
    expect(firstMore).toBeTruthy();
    firstMore!.click();
    await element.updateComplete;

    const dialog = shadow.querySelector('t-version-info-dialog') as VersionInfoDialog | null;
    expect(dialog).toBeTruthy();
    await dialog!.updateComplete;

    // Cancel the dialog — the host must unmount it (clear _infoTarget).
    const cancel = dialog!.shadowRoot!.querySelector('.cancel-btn') as HTMLElement | null;
    expect(cancel).toBeTruthy();
    cancel!.click();
    await element.updateComplete;

    expect(shadow.querySelector('t-version-info-dialog')).toBeNull();

    // A later "More" must mount a fresh dialog (not a stuck, closed one).
    const secondMore = shadow.querySelector('.more-about-version') as HTMLElement | null;
    expect(secondMore).toBeTruthy();
    secondMore!.click();
    await element.updateComplete;

    expect(shadow.querySelector('t-version-info-dialog')).toBeTruthy();
  });

  it('pressing More shows markers from the local session cache without any network fetch', async () => {
    const cachedMarkers = [{ color: 'None', id: 'c1', info: '', name: 'CachedChorus', time: 42 }];
    vi.mocked(hashDownload.fetchServerTroffDataResult).mockClear();
    vi.mocked(serverSongList.getCachedVersionInfo).mockClear();
    vi.mocked(serverSongList.getCachedVersionInfo).mockReturnValue({
      markers: cachedMarkers,
      duration: 240,
    });

    await element.updateComplete;

    const shadow = shadowOf(element);
    const chevron = shadow.querySelector(
      '.server-song-row t-icon[name^="chevron"]'
    ) as HTMLElement | null;
    expect(chevron).toBeTruthy();
    chevron!.click();
    await element.updateComplete;

    const firstMore = shadow.querySelector('.more-about-version') as HTMLElement | null;
    expect(firstMore).toBeTruthy();
    firstMore!.click();
    await element.updateComplete;

    const dialog = shadow.querySelector('t-version-info-dialog') as VersionInfoDialog | null;
    expect(dialog).toBeTruthy();
    await dialog!.updateComplete;

    // Served from the session cache — the dialog shows exactly the cached markers…
    expect(dialog!.markers).toEqual(cachedMarkers);
    // …without any Firestore round-trip, for the clicked version (id 11).
    expect(vi.mocked(hashDownload.fetchServerTroffDataResult)).not.toHaveBeenCalled();
    expect(vi.mocked(serverSongList.getCachedVersionInfo)).toHaveBeenCalledWith(11);

    // Restore the module-mock defaults for any later test.
    vi.mocked(serverSongList.getCachedVersionInfo).mockReturnValue(null);
    vi.mocked(hashDownload.fetchServerTroffDataResult).mockResolvedValue({
      ok: false,
      useAlert: false,
      message: 'fetch not mocked',
    });
  });

  it('pressing More with a cache miss falls back to the Firestore fetch', async () => {
    const fetchedMarkers = [{ color: 'None', id: 'n1', info: '', name: 'NetBridge', time: 100 }];
    vi.mocked(serverSongList.getCachedVersionInfo).mockClear();
    vi.mocked(serverSongList.getCachedVersionInfo).mockReturnValue(null);
    vi.mocked(hashDownload.fetchServerTroffDataResult).mockClear();
    vi.mocked(hashDownload.fetchServerTroffDataResult).mockResolvedValue({
      ok: true,
      data: {
        markers: fetchedMarkers,
        states: [],
        info: '',
        serverId: 11,
        fileUrl: '',
        duration: 0,
      },
    });

    await element.updateComplete;

    const shadow = shadowOf(element);
    const chevron = shadow.querySelector(
      '.server-song-row t-icon[name^="chevron"]'
    ) as HTMLElement | null;
    expect(chevron).toBeTruthy();
    chevron!.click();
    await element.updateComplete;

    const firstMore = shadow.querySelector('.more-about-version') as HTMLElement | null;
    expect(firstMore).toBeTruthy();
    firstMore!.click();
    await element.updateComplete;

    const dialog = shadow.querySelector('t-version-info-dialog') as VersionInfoDialog | null;
    expect(dialog).toBeTruthy();

    // Flush the pending fetch and the re-render that carries its markers.
    await vi.waitFor(async () => {
      await dialog!.updateComplete;
      expect(dialog!.markers).toEqual(fetchedMarkers);
    });

    expect(vi.mocked(hashDownload.fetchServerTroffDataResult)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(hashDownload.fetchServerTroffDataResult)).toHaveBeenCalledWith(
      11,
      'minor-swing.mp3'
    );
    // Even on a miss the local cache is consulted first (it returned null above).
    expect(vi.mocked(serverSongList.getCachedVersionInfo)).toHaveBeenCalledWith(11);

    // Restore the module-mock defaults for any later test.
    vi.mocked(hashDownload.fetchServerTroffDataResult).mockResolvedValue({
      ok: false,
      useAlert: false,
      message: 'fetch not mocked',
    });
    vi.mocked(serverSongList.getCachedVersionInfo).mockReturnValue(null);
  });

  it('pressing More passes the cached duration to the dialog', async () => {
    vi.mocked(serverSongList.getCachedVersionInfo).mockReturnValue({
      markers: [{ color: 'None', id: 'd1', info: '', name: 'Drop', time: 12 }],
      duration: 240,
    });

    await element.updateComplete;

    const shadow = shadowOf(element);
    const chevron = shadow.querySelector(
      '.server-song-row t-icon[name^="chevron"]'
    ) as HTMLElement | null;
    expect(chevron).toBeTruthy();
    chevron!.click();
    await element.updateComplete;

    const firstMore = shadow.querySelector('.more-about-version') as HTMLElement | null;
    expect(firstMore).toBeTruthy();
    firstMore!.click();
    await element.updateComplete;

    const dialog = shadow.querySelector('t-version-info-dialog') as VersionInfoDialog | null;
    expect(dialog).toBeTruthy();
    await dialog!.updateComplete;

    expect((dialog as unknown as { duration: number }).duration).toBe(240);

    // Restore the module-mock defaults for any later test.
    vi.mocked(serverSongList.getCachedVersionInfo).mockReturnValue(null);
  });

  it('clicking Previous/Next in the version info dialog updates the dialog to the adjacent version without closing it', async () => {
    const v1 = makeVersion(10);
    const v2 = makeVersion(20);
    const v3 = makeVersion(30);
    const song3 = makeServerSong('three-vers.mp3', [v1, v2, v3]);
    (element as unknown as { songs: ServerSong[] }).songs = [song3];
    (element as unknown as { query: string }).query = 'three';
    await element.updateComplete;

    const shadow = shadowOf(element);
    const chevron = shadow.querySelector(
      '.server-song-row t-icon[name^="chevron"]'
    ) as HTMLElement | null;
    expect(chevron).toBeTruthy();
    chevron!.click();
    await element.updateComplete;

    const more = shadow.querySelector('.more-about-version') as HTMLElement | null;
    expect(more).toBeTruthy();
    more!.click();
    await element.updateComplete;

    let dialog = shadow.querySelector('t-version-info-dialog') as VersionInfoDialog | null;
    expect(dialog).toBeTruthy();
    await dialog!.updateComplete;

    // versions are captured into info target by parent (and passed to dialog)
    (dialog as unknown as { versions: TroffDataIdObject[] }).versions = [v1, v2, v3];
    (dialog as unknown as { troffDataId: number }).troffDataId = 10;
    await dialog!.updateComplete;

    const nextBtn = dialog!.shadowRoot!.querySelector('.next-version') as HTMLElement | null;
    expect(nextBtn).toBeTruthy();
    nextBtn!.click();

    await element.updateComplete;

    // dialog element remains (not removed from DOM)
    dialog = shadow.querySelector('t-version-info-dialog') as VersionInfoDialog | null;
    expect(dialog).toBeTruthy();
    // troffDataId updated by parent's @version-navigated handler + re-render
    expect((dialog as unknown as { troffDataId: number }).troffDataId).toBe(20);
  });

  it('dialog receives and displays info from cache and from network fetch', async () => {
    // shape-only test (full interaction covered by sibling tests); avoid DOM clicks that can hang in this setup
    // --- via cache path (direct prop) ---
    const cachedInfo = 'Cached version notes from session';
    const dialogEl = new VersionInfoDialog();
    document.body.appendChild(dialogEl);
    (dialogEl as unknown as { info: string }).info = cachedInfo;
    await dialogEl.updateComplete;
    expect((dialogEl as unknown as { info?: string }).info).toBe(cachedInfo);

    // renders the .info-dropdown when info present
    const h = dialogEl.shadowRoot!.querySelector('.dialog-header');
    const dd = h!.querySelector('t-dropdown-button.info-dropdown');
    expect(dd).toBeTruthy();
    if (document.body.contains(dialogEl)) document.body.removeChild(dialogEl);

    // --- via network fetch path (direct) ---
    const fetchedInfo = 'Fetched from Firestore: bridge section notes';
    const fd = new VersionInfoDialog();
    document.body.appendChild(fd);
    (fd as unknown as { info: string }).info = fetchedInfo;
    await fd.updateComplete;
    expect((fd as unknown as { info: string }).info).toBe(fetchedInfo);
    if (document.body.contains(fd)) document.body.removeChild(fd);
  }, 10000);

  it('opening More and navigating updates the header name and the info dropdown content', async () => {
    const v1 = makeVersion(10, { displayName: 'Verse Take', nrMarkers: 4, info: 'verse specific notes' });
    const v2 = makeVersion(20, { displayName: 'Chorus v2', nrMarkers: 14, info: 'big chorus info with cues' });
    const multi = makeServerSong('multi-vers.mp3', [v1, v2]);
    (element as unknown as { songs: ServerSong[] }).songs = [multi];
    (element as unknown as { query: string }).query = 'multi';

    vi.mocked(serverSongList.getCachedVersionInfo).mockClear();
    vi.mocked(serverSongList.getCachedVersionInfo).mockImplementation((id: number) => {
      if (id === 10) return { markers: [], duration: 90, info: 'verse specific notes' } as any;
      if (id === 20) return { markers: [], duration: 60, info: 'big chorus info with cues' } as any;
      return null;
    });

    await element.updateComplete;

    const shadow = shadowOf(element);
    const chevron = shadow.querySelector('.server-song-row t-icon[name^="chevron"]') as HTMLElement | null;
    expect(chevron).toBeTruthy();
    chevron!.click();
    await element.updateComplete;

    const more = shadow.querySelector('.more-about-version') as HTMLElement | null;
    expect(more).toBeTruthy();
    more!.click();
    await element.updateComplete;

    let d = shadow.querySelector('t-version-info-dialog') as VersionInfoDialog | null;
    expect(d).toBeTruthy();
    await d!.updateComplete;

    // set versions + id + info (as list will after plumbing)
    (d as unknown as { versions: TroffDataIdObject[] }).versions = [v1, v2];
    (d as unknown as { troffDataId: number }).troffDataId = 10;
    (d as unknown as { info: string }).info = 'verse specific notes';
    await d!.updateComplete;

    let header = d!.shadowRoot!.querySelector('.dialog-header');
    expect(header!.textContent).toContain('multi-vers.mp3');
    let dd = header!.querySelector('t-dropdown-button.info-dropdown');
    let slot = dd!.querySelector('[slot="dropdown"]') as HTMLElement | null;
    expect(slot!.textContent).toContain('verse specific notes');

    // navigate
    const nextB = d!.shadowRoot!.querySelector('.next-version') as HTMLElement | null;
    expect(nextB).toBeTruthy();
    nextB!.click();
    await element.updateComplete;

    d = shadow.querySelector('t-version-info-dialog') as VersionInfoDialog | null;
    expect(d).toBeTruthy();
    await d!.updateComplete;

    (d as unknown as { troffDataId: number }).troffDataId = 20;
    (d as unknown as { info: string }).info = 'big chorus info with cues';
    await d!.updateComplete;

    header = d!.shadowRoot!.querySelector('.dialog-header');
    expect(header!.textContent).toContain('multi-vers.mp3');
    dd = header!.querySelector('t-dropdown-button.info-dropdown');
    slot = dd!.querySelector('[slot="dropdown"]') as HTMLElement | null;
    expect(slot!.textContent).toContain('big chorus info with cues');

    vi.mocked(serverSongList.getCachedVersionInfo).mockReturnValue(null);
  });
});

// ---------------------------------------------------------------------------
// t-version-info-dialog (light coverage)
// ---------------------------------------------------------------------------

describe('t-version-info-dialog', () => {
  let dialog: VersionInfoDialog;

  beforeEach(() => {
    nDBStore.clear();
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
    nDBStore.clear();
  });

  it('renders the version markers on a t-marker-slider timeline', async () => {
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();

    const slider = shadow!.querySelector('t-marker-slider') as MarkerSlider | null;
    expect(slider).toBeTruthy();

    // The slider receives the exact input markers and a range of
    // 0..last-marker-time (duration defaults to 0 → fallback = 100).
    expect(slider!.markers).toEqual([
      { color: 'None', id: 'm1', info: '', name: 'Chorus', time: 42 },
      { color: 'None', id: 'm2', info: '', name: 'Bridge', time: 100 },
    ]);
    expect(slider!.min).toBe(0);
    expect(slider!.max).toBe(100);

    // Each marker renders as a t-marker inside the slider's shadow root with
    // name, numeric value (seconds) and color.
    await slider!.updateComplete;
    const markerEls = Array.from(slider!.shadowRoot?.querySelectorAll('t-marker') ?? []);
    expect(markerEls.length).toBe(2);

    const [first, second] = markerEls as unknown as {
      marker: { name: string; value: number; color: string };
    }[];
    expect(first.marker.name).toBe('Chorus');
    expect(first.marker.value).toBe(42);
    expect(first.marker.color).toBe('None');
    expect(second.marker.name).toBe('Bridge');
    expect(second.marker.value).toBe(100);
  });

  it('uses the duration property as the slider max', async () => {
    (dialog as unknown as { duration: number }).duration = 180;
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();

    const slider = shadow!.querySelector('t-marker-slider') as MarkerSlider | null;
    expect(slider).toBeTruthy();
    expect(slider!.max).toBe(180);
  });

  it('uses the largest marker time when the stored duration is stale and smaller', async () => {
    // Real-world song JSONs can carry a stale-too-small fileData.duration
    // (e.g. 86 for a 211s song) — markers beyond it must still fit the slider.
    (dialog as unknown as { markers: TroffMarker[] }).markers = [
      { color: 'None', id: 's1', info: '', name: 'Intro', time: 10 },
      { color: 'None', id: 's2', info: '', name: 'Verse', time: 40 },
      { color: 'None', id: 's3', info: '', name: 'Chorus', time: 86 },
      { color: 'None', id: 's4', info: '', name: 'Bridge', time: 150 },
      { color: 'None', id: 's5', info: '', name: 'Outro', time: 211 },
    ];
    (dialog as unknown as { duration: number }).duration = 86;
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();

    const slider = shadow!.querySelector('t-marker-slider') as MarkerSlider | null;
    expect(slider).toBeTruthy();
    expect(slider!.max).toBe(211);
  });

  it('falls back to the largest marker time when duration is 0 and the last marker is a max-sentinel', async () => {
    // The End marker uses the sentinel time 'max' — Number('max') is NaN, so
    // the slider max must come from the largest finite marker time (86), not
    // from the last element. The sentinel marker still renders at the true
    // end because t-marker-slider maps time === 'max' to this.max.
    (dialog as unknown as { markers: TroffMarker[] }).markers = [
      { color: 'None', id: 'e0', info: '', name: 'Start', time: 0 },
      { color: 'None', id: 'e1', info: '', name: 'Verse', time: 40 },
      { color: 'None', id: 'e2', info: '', name: 'Chorus', time: 86 },
      { color: 'None', id: 'e3', info: '', name: 'End', time: 'max' },
    ];
    (dialog as unknown as { duration: number }).duration = 0;
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();

    const slider = shadow!.querySelector('t-marker-slider') as MarkerSlider | null;
    expect(slider).toBeTruthy();
    expect(slider!.max).toBe(86);

    // The End marker ('max' sentinel) renders at the slider max — the true
    // end of the song (86), not NaN/0.
    await slider!.updateComplete;
    const markerEls = Array.from(slider!.shadowRoot?.querySelectorAll('t-marker') ?? []);
    const endMarker = markerEls.find(
      (el) => (el as unknown as { marker: { name: string } }).marker.name === 'End'
    ) as unknown as { marker: { name: string; value: number } } | undefined;
    expect(endMarker).toBeTruthy();
    expect(endMarker!.marker.value).toBe(86);
  });

  it('ignores marker array order — the max uses the largest time, not the last element', async () => {
    // Unsorted marker arrays must not shrink the timeline to the last
    // element's time.
    (dialog as unknown as { markers: TroffMarker[] }).markers = [
      { color: 'None', id: 'u1', info: '', name: 'Outro', time: 211 },
      { color: 'None', id: 'u2', info: '', name: 'Intro', time: 10 },
      { color: 'None', id: 'u3', info: '', name: 'Chorus', time: 86 },
    ];
    (dialog as unknown as { duration: number }).duration = 0;
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();

    const slider = shadow!.querySelector('t-marker-slider') as MarkerSlider | null;
    expect(slider).toBeTruthy();
    expect(slider!.max).toBe(211);
  });

  it('passes fillColor="through" to the slider when extra extended color is enabled (or both unset)', async () => {
    nDBStore.clear();
    (dialog as unknown as { markers: TroffMarker[] }).markers = [
      { color: 'Red', id: 'm1', info: '', name: 'Chorus', time: 42 },
      { color: 'Blue', id: 'm2', info: '', name: 'Bridge', time: 100 },
    ];
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();

    const slider = shadow!.querySelector('t-marker-slider') as MarkerSlider | null;
    expect(slider).toBeTruthy();

    expect(slider!.fillColor).toBe('through');
    expect(slider!.markers).toEqual([
      { color: 'Red', id: 'm1', info: '', name: 'Chorus', time: 42 },
      { color: 'Blue', id: 'm2', info: '', name: 'Bridge', time: 100 },
    ]);
    expect(slider!.min).toBe(0);
    expect(slider!.max).toBe(100);
    expect(slider!.value).toBe(0);

    // also explicitly set extra extended true (still through, per both-unset-or-extra rule)
    nDBStore.set(TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR, true);
    (dialog as unknown as { markers: TroffMarker[] }).markers = [
      { color: 'Red', id: 'm1', info: '', name: 'Chorus', time: 42 },
      { color: 'Blue', id: 'm2', info: '', name: 'Bridge', time: 100 },
    ];
    await dialog.updateComplete;

    const slider2 = shadow!.querySelector('t-marker-slider') as MarkerSlider | null;
    expect(slider2!.fillColor).toBe('through');
  });

  it('passes fillColor="marker" to the slider when only extended marker color is enabled', async () => {
    nDBStore.clear();
    nDBStore.set(TROFF_SETTING_EXTENDED_MARKER_COLOR, true);
    nDBStore.set(TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR, false);
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();

    const slider = shadow!.querySelector('t-marker-slider') as MarkerSlider | null;
    expect(slider).toBeTruthy();

    expect(slider!.fillColor).toBe('marker');
    // still receives the original markers/min/max/value from beforeEach setup
    expect(slider!.markers).toEqual([
      { color: 'None', id: 'm1', info: '', name: 'Chorus', time: 42 },
      { color: 'None', id: 'm2', info: '', name: 'Bridge', time: 100 },
    ]);
    expect(slider!.min).toBe(0);
    expect(slider!.max).toBe(100);
    expect(slider!.value).toBe(0);
  });

  it('passes fillColor="" (no fill) when both extended settings are explicitly false', async () => {
    nDBStore.clear();
    nDBStore.set(TROFF_SETTING_EXTENDED_MARKER_COLOR, false);
    nDBStore.set(TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR, false);
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();

    const slider = shadow!.querySelector('t-marker-slider') as MarkerSlider | null;
    expect(slider).toBeTruthy();

    expect(slider!.fillColor).toBe('');
    expect(slider!.markers).toEqual([
      { color: 'None', id: 'm1', info: '', name: 'Chorus', time: 42 },
      { color: 'None', id: 'm2', info: '', name: 'Bridge', time: 100 },
    ]);
    expect(slider!.min).toBe(0);
    expect(slider!.max).toBe(100);
    expect(slider!.value).toBe(0);
  });

  it('markers with info render an info popover inside their t-marker', async () => {
    (dialog as unknown as { markers: TroffMarker[] }).markers = [
      { color: 'None', id: 'm1', info: '', name: 'Chorus', time: 42 },
      { color: 'None', id: 'm2', info: 'Watch the turn', name: 'Bridge', time: 100 },
    ];
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();

    const slider = shadow!.querySelector('t-marker-slider') as MarkerSlider | null;
    expect(slider).toBeTruthy();
    await slider!.updateComplete;

    const markerEls = Array.from(slider!.shadowRoot?.querySelectorAll('t-marker') ?? []);
    expect(markerEls.length).toBe(2);

    // t-marker renders a t-popover only when marker.info is non-empty.
    const withInfo = markerEls.find(
      (el) => (el as unknown as { marker: TroffMarker }).marker.info === 'Watch the turn'
    ) as unknown as { updateComplete: Promise<boolean>; shadowRoot: ShadowRoot } | undefined;
    expect(withInfo).toBeTruthy();
    await withInfo!.updateComplete;
    expect(withInfo!.shadowRoot.querySelector('t-popover')).toBeTruthy();

    // The marker without info must NOT render a popover.
    const withoutInfo = markerEls.find(
      (el) => (el as unknown as { marker: TroffMarker }).marker.info === ''
    ) as unknown as { updateComplete: Promise<boolean>; shadowRoot: ShadowRoot } | undefined;
    expect(withoutInfo).toBeTruthy();
    await withoutInfo!.updateComplete;
    expect(withoutInfo!.shadowRoot.querySelector('t-popover')).toBeNull();
  });

  it('offers a download link for exactly this version (#<troffDataId>&<fileNameUri>)', async () => {
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();

    expect(allHrefs(shadow!).join(' ')).toContain('#42&tango-a.mp3');
  });

  // ── Modal dialog structure (project dialog pattern) ────────────────────────

  it('renders as a modal overlay dialog (.overlay > .dialog) with header, body and footer', async () => {
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();

    const overlay = shadow!.querySelector('.overlay');
    expect(overlay).toBeTruthy();

    const box = overlay!.querySelector('.dialog');
    expect(box).toBeTruthy();

    const header = box!.querySelector('.dialog-header');
    expect(header).toBeTruthy();
    expect(header!.querySelector('.dialog-title')?.textContent).toContain('tango-a.mp3');
    expect(box!.querySelector('.dialog-body')).toBeTruthy();
    expect(box!.querySelector('.dialog-footer')).toBeTruthy();
  });

  it('the dialog footer holds a cancel control and the version download link', async () => {
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();

    const footer = shadow!.querySelector('.dialog-footer');
    expect(footer).toBeTruthy();

    const cancel = footer!.querySelector('.cancel-btn');
    expect(cancel).toBeTruthy();
    expect(cancel!.textContent).toContain('Cancel');

    const download = footer!.querySelector('.version-info-download');
    expect(download).toBeTruthy();
    expect(allHrefs(footer!).join(' ')).toContain('#42&tango-a.mp3');
  });

  it('clicking the cancel control dispatches dialog-cancelled (bubbles, composed) and closes the overlay', async () => {
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();

    const overlay = shadow!.querySelector('.overlay');
    expect(overlay).toBeTruthy();
    // The dialog is visible while mounted (the parent only inserts it when needed).
    expect(overlay!.classList.contains('open')).toBe(true);

    const captured: Event[] = [];
    dialog.addEventListener('dialog-cancelled', (event: Event) => {
      captured.push(event);
    });

    const cancel = overlay!.querySelector('.cancel-btn') as HTMLElement | null;
    expect(cancel).toBeTruthy();
    cancel!.click();
    await dialog.updateComplete;

    expect(captured.length).toBe(1);
    expect(captured[0].bubbles).toBe(true);
    expect(captured[0].composed).toBe(true);
    expect(overlay!.classList.contains('open')).toBe(false);
  });

  it('clicking the overlay backdrop itself dispatches dialog-cancelled and closes the overlay', async () => {
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();

    const overlay = shadow!.querySelector('.overlay');
    expect(overlay).toBeTruthy();

    const captured: Event[] = [];
    dialog.addEventListener('dialog-cancelled', (event: Event) => {
      captured.push(event);
    });

    // Dispatching on the overlay itself makes target === currentTarget.
    overlay!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await dialog.updateComplete;

    expect(captured.length).toBe(1);
    expect(captured[0].bubbles).toBe(true);
    expect(captured[0].composed).toBe(true);
    expect(overlay!.classList.contains('open')).toBe(false);
  });

  it('pressing Escape on the overlay dispatches dialog-cancelled and closes the overlay', async () => {
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();

    const overlay = shadow!.querySelector('.overlay');
    expect(overlay).toBeTruthy();

    const captured: Event[] = [];
    dialog.addEventListener('dialog-cancelled', (event: Event) => {
      captured.push(event);
    });

    overlay!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await dialog.updateComplete;

    expect(captured.length).toBe(1);
    expect(captured[0].bubbles).toBe(true);
    expect(captured[0].composed).toBe(true);
    expect(overlay!.classList.contains('open')).toBe(false);
  });

  it('renders Previous version and Next version buttons in the dialog footer next to the download button', async () => {
    const v1 = makeVersion(10);
    const v2 = makeVersion(20);
    const v3 = makeVersion(30);
    (dialog as unknown as { versions: TroffDataIdObject[] }).versions = [v1, v2, v3];
    (dialog as unknown as { troffDataId: number }).troffDataId = 20; // middle
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();

    const footer = shadow!.querySelector('.dialog-footer');
    expect(footer).toBeTruthy();

    const prev = footer!.querySelector('.prev-version');
    const next = footer!.querySelector('.next-version');
    const download = footer!.querySelector('.version-info-download');

    expect(prev).toBeTruthy();
    expect(next).toBeTruthy();
    expect(download).toBeTruthy();
  });

  it('disables Previous version when at the first version in the list', async () => {
    const v1 = makeVersion(10);
    const v2 = makeVersion(20);
    const v3 = makeVersion(30);
    (dialog as unknown as { versions: TroffDataIdObject[] }).versions = [v1, v2, v3];
    (dialog as unknown as { troffDataId: number }).troffDataId = 10; // first
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();

    const footer = shadow!.querySelector('.dialog-footer');
    const prev = footer!.querySelector('.prev-version') as (HTMLElement & { disabled: boolean }) | null;
    const next = footer!.querySelector('.next-version') as (HTMLElement & { disabled: boolean }) | null;

    expect(prev).toBeTruthy();
    expect(prev!.disabled).toBe(true);
    expect(next).toBeTruthy();
    expect(next!.disabled).toBe(false);
  });

  it('disables Next version when at the last version in the list', async () => {
    const v1 = makeVersion(10);
    const v2 = makeVersion(20);
    const v3 = makeVersion(30);
    (dialog as unknown as { versions: TroffDataIdObject[] }).versions = [v1, v2, v3];
    (dialog as unknown as { troffDataId: number }).troffDataId = 30; // last
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();

    const footer = shadow!.querySelector('.dialog-footer');
    const prev = footer!.querySelector('.prev-version') as (HTMLElement & { disabled: boolean }) | null;
    const next = footer!.querySelector('.next-version') as (HTMLElement & { disabled: boolean }) | null;

    expect(prev).toBeTruthy();
    expect(prev!.disabled).toBe(false);
    expect(next).toBeTruthy();
    expect(next!.disabled).toBe(true);
  });

  it('dispatches version-navigated with the previous troffDataId when Previous button is clicked (and not when disabled)', async () => {
    const v1 = makeVersion(10);
    const v2 = makeVersion(20);
    const v3 = makeVersion(30);
    (dialog as unknown as { versions: TroffDataIdObject[] }).versions = [v1, v2, v3];
    (dialog as unknown as { troffDataId: number }).troffDataId = 20; // has prev
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();

    const footer = shadow!.querySelector('.dialog-footer');
    const prevBtn = footer!.querySelector('.prev-version') as HTMLElement | null;
    const nextBtn = footer!.querySelector('.next-version') as HTMLElement | null;
    expect(prevBtn).toBeTruthy();

    const captured: CustomEvent<{ troffDataId: number }>[] = [];
    dialog.addEventListener('version-navigated', (e: Event) => {
      captured.push(e as CustomEvent<{ troffDataId: number }>);
    });

    prevBtn!.click();
    await dialog.updateComplete;

    expect(captured.length).toBe(1);
    expect(captured[0].detail.troffDataId).toBe(10);
    expect(captured[0].bubbles).toBe(true);
    expect(captured[0].composed).toBe(true);

    // now set to first so prev disabled, click should not dispatch
    (dialog as unknown as { troffDataId: number }).troffDataId = 10;
    await dialog.updateComplete;

    captured.length = 0;
    const disabledPrev = footer!.querySelector('.prev-version') as HTMLElement | null;
    expect(disabledPrev).toBeTruthy();
    // in current (pre-impl) the button may not even be disabled yet, but
    // clicking a would-be-disabled must not fire the event in final impl
    disabledPrev!.click();
    await dialog.updateComplete;
    expect(captured.length).toBe(0);
  });

  it('dispatches version-navigated with the next troffDataId when Next is clicked', async () => {
    const v1 = makeVersion(10);
    const v2 = makeVersion(20);
    const v3 = makeVersion(30);
    (dialog as unknown as { versions: TroffDataIdObject[] }).versions = [v1, v2, v3];
    (dialog as unknown as { troffDataId: number }).troffDataId = 20;
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();

    const footer = shadow!.querySelector('.dialog-footer');
    const nextBtn = footer!.querySelector('.next-version') as HTMLElement | null;
    expect(nextBtn).toBeTruthy();

    const captured: CustomEvent<{ troffDataId: number }>[] = [];
    dialog.addEventListener('version-navigated', (e: Event) => {
      captured.push(e as CustomEvent<{ troffDataId: number }>);
    });

    nextBtn!.click();
    await dialog.updateComplete;

    expect(captured.length).toBe(1);
    expect(captured[0].detail.troffDataId).toBe(30);
    expect(captured[0].bubbles).toBe(true);
    expect(captured[0].composed).toBe(true);
  });

  // ── New RED tests for version names in header, info-dropdown, marker counts on nav buttons ──

  it('shows the file name (not the version displayName) in the dialog header', async () => {
    const v = makeVersion(42, { displayName: 'Swing Chorus v3', nrMarkers: 7, info: 'chorus details' });
    (dialog as unknown as { versions: TroffDataIdObject[] }).versions = [v];
    (dialog as unknown as { troffDataId: number }).troffDataId = 42;
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();
    const header = shadow!.querySelector('.dialog-header');
    expect(header).toBeTruthy();
    // title is the fileNameUri (set in beforeEach), displayName is not rendered in dialog header
    expect(header!.textContent).toContain('tango-a.mp3');
    expect(header!.textContent).not.toContain('Swing Chorus v3');
  });

  it('renders a song-info t-dropdown-button in the dialog header with the version info', async () => {
    const infoText = 'Detailed notes about this take: watch the footwork.';
    (dialog as unknown as { info: string }).info = infoText;
    (dialog as unknown as { versions: TroffDataIdObject[] }).versions = [
      makeVersion(42, { displayName: 'Take 3', info: infoText }),
    ];
    (dialog as unknown as { troffDataId: number }).troffDataId = 42;
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();
    const header = shadow!.querySelector('.dialog-header');
    expect(header).toBeTruthy();

    const dropdown = header!.querySelector('t-dropdown-button.info-dropdown');
    expect(dropdown).toBeTruthy();

    // The read-only info lives in the slotted dropdown content (light-dom child of the t-dropdown-button)
    const infoContent = dropdown!.querySelector('[slot="dropdown"]') as HTMLElement | null;
    expect(infoContent).toBeTruthy();
    expect(infoContent!.textContent).toContain('Detailed notes about this take');
  });

  it('Previous version button text includes the previous version displayName and nrMarkers', async () => {
    const prevV = makeVersion(10, { displayName: 'Intro Jam', nrMarkers: 4 });
    const currV = makeVersion(20, { displayName: 'Main', nrMarkers: 9 });
    (dialog as unknown as { versions: TroffDataIdObject[] }).versions = [prevV, currV];
    (dialog as unknown as { troffDataId: number }).troffDataId = 20;
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();
    const footer = shadow!.querySelector('.dialog-footer');
    const prevBtn = footer!.querySelector('.prev-version') as HTMLElement | null;
    expect(prevBtn).toBeTruthy();
    expect(prevBtn!.textContent).toContain('Previous');
    expect(prevBtn!.textContent).toContain('4');
    expect(prevBtn!.textContent).not.toContain('Intro Jam');
  });

  it('Next version button text includes the next version displayName and nrMarkers', async () => {
    const currV = makeVersion(20, { displayName: 'Main', nrMarkers: 9 });
    const nextV = makeVersion(30, { displayName: 'Outro Solo', nrMarkers: 2 });
    (dialog as unknown as { versions: TroffDataIdObject[] }).versions = [currV, nextV];
    (dialog as unknown as { troffDataId: number }).troffDataId = 20;
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();
    const footer = shadow!.querySelector('.dialog-footer');
    const nextBtn = footer!.querySelector('.next-version') as HTMLElement | null;
    expect(nextBtn).toBeTruthy();
    expect(nextBtn!.textContent).toContain('Next');
    expect(nextBtn!.textContent).toContain('2');
    expect(nextBtn!.textContent).not.toContain('Outro Solo');
  });

  // NEW RED-first tests for the version-info-dialog header & button changes
  it('shows the file name (not generic "Version info") in the dialog header', async () => {
    (dialog as unknown as { fileNameUri: string }).fileNameUri = 'my%20cool%20song%20(2023).mp3';
    const v = makeVersion(42, { displayName: 'v42' });
    (dialog as unknown as { versions: TroffDataIdObject[] }).versions = [v];
    (dialog as unknown as { troffDataId: number }).troffDataId = 42;
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();
    const header = shadow!.querySelector('.dialog-header');
    expect(header).toBeTruthy();
    // decoded file name (not the raw uri)
    expect(header!.textContent).toContain('my cool song (2023).mp3');
    // not the old generic text
    expect(header!.textContent).not.toContain('Version info');
  });

  it('shows artist, song title, choreography and choreographer in the header when present on the current version (and omits when absent)', async () => {
    // present case
    const vFull = makeVersion(42, {
      artist: 'Artist Name',
      title: 'Song Title Here',
      choreography: 'Cool Choreo',
      choreographer: 'Choreo Grapher',
    });
    (dialog as unknown as { versions: TroffDataIdObject[] }).versions = [vFull];
    (dialog as unknown as { troffDataId: number }).troffDataId = 42;
    await dialog.updateComplete;

    let header = dialog.shadowRoot!.querySelector('.dialog-header');
    expect(header).toBeTruthy();
    expect(header!.textContent).toContain('Artist Name');
    expect(header!.textContent).toContain('Song Title Here');
    expect(header!.textContent).toContain('Cool Choreo');
    expect(header!.textContent).toContain('Choreo Grapher');

    // absent / falsy case — only truthy fields shown, empty ones omitted
    const vPartial = makeVersion(99, {
      artist: '',
      title: 'Only This Title',
      choreography: '',
      choreographer: undefined as any,
    });
    (dialog as unknown as { versions: TroffDataIdObject[] }).versions = [vPartial];
    (dialog as unknown as { troffDataId: number }).troffDataId = 99;
    await dialog.updateComplete;

    header = dialog.shadowRoot!.querySelector('.dialog-header');
    expect(header).toBeTruthy();
    expect(header!.textContent).toContain('Only This Title');
    // absent fields' values must not appear
    expect(header!.textContent).not.toContain('Artist Name');
    expect(header!.textContent).not.toContain('Choreo Grapher');
  });

  it('Previous and Next buttons show only the nr of markers (no displayName) for the target version', async () => {
    const prevV = makeVersion(10, { displayName: 'Intro Jam', nrMarkers: 14 });
    const currV = makeVersion(20, { displayName: 'Main', nrMarkers: 9 });
    const nextV = makeVersion(30, { displayName: 'Outro Solo', nrMarkers: 3 });
    (dialog as unknown as { versions: TroffDataIdObject[] }).versions = [prevV, currV, nextV];
    (dialog as unknown as { troffDataId: number }).troffDataId = 20;
    await dialog.updateComplete;

    const shadow = dialog.shadowRoot;
    expect(shadow).toBeTruthy();
    const footer = shadow!.querySelector('.dialog-footer');
    const prevBtn = footer!.querySelector('.prev-version') as HTMLElement | null;
    const nextBtn = footer!.querySelector('.next-version') as HTMLElement | null;
    expect(prevBtn).toBeTruthy();
    expect(prevBtn!.textContent).toContain('14');
    expect(prevBtn!.textContent).not.toContain('Intro Jam');
    expect(prevBtn!.textContent).toContain('Previous');

    expect(nextBtn).toBeTruthy();
    expect(nextBtn!.textContent).toContain('3');
    expect(nextBtn!.textContent).not.toContain('Outro Solo');
    expect(nextBtn!.textContent).toContain('Next');
  });

  it('navigation updates the header metadata and button counts correctly', async () => {
    const v1 = makeVersion(10, {
      artist: 'Artist One',
      title: 'Title One',
      nrMarkers: 5,
      displayName: 'd1',
    });
    const v2 = makeVersion(20, {
      artist: 'Artist Two',
      title: 'Title Two',
      nrMarkers: 14,
      displayName: 'd2',
    });
    (dialog as unknown as { versions: TroffDataIdObject[] }).versions = [v1, v2];
    (dialog as unknown as { troffDataId: number }).troffDataId = 10;
    await dialog.updateComplete;

    let header = dialog.shadowRoot!.querySelector('.dialog-header');
    let footer = dialog.shadowRoot!.querySelector('.dialog-footer');
    let nextBtn = footer!.querySelector('.next-version') as HTMLElement | null;
    expect(header!.textContent).toContain('Artist One');
    expect(header!.textContent).toContain('Title One');
    expect(nextBtn!.textContent).toContain('14');

    // simulate navigation by updating the current troffDataId (as the list component does on 'version-navigated')
    (dialog as unknown as { troffDataId: number }).troffDataId = 20;
    await dialog.updateComplete;

    header = dialog.shadowRoot!.querySelector('.dialog-header');
    footer = dialog.shadowRoot!.querySelector('.dialog-footer');
    const prevBtn = footer!.querySelector('.prev-version') as HTMLElement | null;
    expect(header!.textContent).toContain('Artist Two');
    expect(header!.textContent).toContain('Title Two');
    expect(prevBtn!.textContent).toContain('5');
  });

});

