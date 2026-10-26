// Data-layer tests for the "Merged local + server song search" feature.
//
// Module under test: utils/server-song-list.ts (NEW — non-legacy; find.ts is
// only referenced as the historical behaviour source and must never be
// imported by the implementation).
//
// Contract pinned here (orchestrator spec):
//   refreshServerSongList(): Promise<ServerSong[]>
//     getDocs(collection(db, 'TroffData')) → keep docs that are
//     troffDataPublic === true OR whose (fileNameUri, id) exists in the local
//     history nDB key TROFF_TROFF_DATA_ID_AND_FILE_NAME (TroffHistoryList[]) →
//     troffDataListToServerSongList(...) → merge the local history (so
//     history-only versions/songs are kept) → nDB.set(
//     'TROFF_SERVER_SONG_LIST_FROM_SERVER', list) → return the list.
//     A module-level session guard means concurrent or later refresh calls
//     do NOT hit Firebase again until resetServerSongListForTests() runs.
//   getCachedServerSongList(): ServerSong[]  ([] when nothing is cached)
//   getCachedVersionInfo(troffDataId): { markers: TroffMarker[]; duration: number } | null
//     (session-memory per-version cache filled during refreshServerSongList
//     for every kept TroffData doc — the parsed markers plus the song
//     duration from markerJsonString → fileData.duration (Number(...) || 0)
//     — null before a refresh and for unknown ids; cleared by
//     resetServerSongListForTests(); never persisted to nDB)
//   troffDataListToServerSongList(troffDataList): ServerSong[]
//     (one ServerSong per fileNameUri, versions grouped in first-appearance
//     order; Firestore docs arrive as TroffData with markerJsonString)
//   troffDataToTroffDataIdObject(troffData): TroffDataIdObject  (pure)
//   mergeServerSongListWithHistory(serverSongs, history): ServerSong[]
//   filterServerSongs(songs, query, tab): ServerSong[]
//     (returns each song with ONLY its matching versions — version-level
//     filtering, same as find.ts; tracks/groups →
//     matchesServerSongSearch(query, fileName, version); artists → a
//     version's artist field; genre → a version's genre field;
//     empty/whitespace query → the SAME array reference, mirroring
//     utils/media-search.ts; never mutates the input)
//   resetServerSongListForTests(): void
//
// Firebase and nDB are mocked — no real services are ever called. The module
// under test is imported dynamically AFTER vi.resetModules() (same convention
// as tests/firebase-sync.test.ts) so its module-level session guard is fresh
// for every test.
//
// RED note: utils/server-song-list.ts does not exist yet, so every test in
// this file fails at import time until the feature is implemented.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TROFF_TROFF_DATA_ID_AND_FILE_NAME } from '../constants/constants.js';
import type {
  ServerSong,
  TroffData,
  TroffDataIdObject,
  TroffFileData,
  TroffHistoryList,
  TroffMarker,
} from '../types/troff.d.js';

// ---------------------------------------------------------------------------
// Mock nDB (in-memory) — the module under test reads/writes the history key
// and the cached server-song list key through nDB.
// ---------------------------------------------------------------------------

const nDBStore = new Map<string, unknown>();

vi.mock('../assets/internal/db.js', () => ({
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
// Mock firebaseClient. The module under test is imported dynamically in
// beforeEach (after this module body has run), so the factory below may read
// these consts directly — same pattern as tests/firebase-sync.test.ts.
// ---------------------------------------------------------------------------

const mockGetDocs = vi.fn();
const mockCollection = vi.fn((_db: unknown, name: string) => ({ name }));

vi.mock('../services/firebaseClient.js', () => ({
  db: {},
  collection: mockCollection,
  getDocs: mockGetDocs,
}));

// ---------------------------------------------------------------------------
// API surface of utils/server-song-list.ts (documented contract — these
// signatures are what the implementation must export).
// ---------------------------------------------------------------------------

interface ServerSongListApi {
  refreshServerSongList(): Promise<ServerSong[]>;
  getCachedServerSongList(): ServerSong[];
  getCachedVersionInfo(troffDataId: number): { markers: TroffMarker[]; duration: number } | null;
  troffDataListToServerSongList(troffDataList: TroffData[]): ServerSong[];
  troffDataToTroffDataIdObject(troffData: TroffData): TroffDataIdObject;
  mergeServerSongListWithHistory(
    serverSongs: ServerSong[],
    history: TroffHistoryList[]
  ): ServerSong[];
  filterServerSongs(
    songs: ServerSong[],
    query: string,
    tab: 'tracks' | 'groups' | 'artists' | 'genre'
  ): ServerSong[];
  resetServerSongListForTests(): void;
}

let mod: ServerSongListApi;

// ---------------------------------------------------------------------------
// Fixtures (test data only — no product logic is re-implemented here)
// ---------------------------------------------------------------------------

const MODERN_MILLIS = 1700000000000;

function makeMarker(id: string, time: number, name: string): TroffMarker {
  return { color: 'None', id, info: '', name, time };
}

function makeFileData(overrides: Partial<TroffFileData> = {}): TroffFileData {
  return {
    album: '',
    artist: '',
    choreographer: '',
    choreography: '',
    customName: '',
    duration: 180,
    genre: '',
    tags: '',
    title: '',
    ...overrides,
  };
}

/** The JSON blob stored in a Firestore TroffData doc (markerJsonString). */
function makeSongJson(
  overrides: {
    markers?: TroffMarker[];
    info?: string;
    aStates?: string[];
    fileData?: TroffFileData;
  } = {}
): string {
  return JSON.stringify({
    markers: overrides.markers ?? [makeMarker('m1', 10, 'Intro')],
    info: overrides.info ?? '',
    ...(overrides.aStates ? { aStates: overrides.aStates } : {}),
    ...(overrides.fileData ? { fileData: overrides.fileData } : {}),
  });
}

/** A Firestore-shaped TroffData doc payload (markerJsonString form). */
function makeTroffData(
  id: number,
  fileName: string,
  songJson: string,
  overrides: Partial<TroffData> = {}
): TroffData {
  return {
    fileName,
    fileSize: 1000,
    fileType: 'audio/mpeg',
    fileUrl: `https://example.com/${fileName}`,
    id,
    markerJsonString: songJson,
    troffDataPublic: true,
    troffDataUploadedMillis: MODERN_MILLIS,
    ...overrides,
  };
}

/** Firestore snapshot wrapper: both the doc id and the data id are set. */
function doc(troffData: TroffData): { id: string; data: () => TroffData } {
  return { id: String(troffData.id), data: () => troffData };
}

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

function makeHistory(
  fileNameUri: string,
  troffDataIdObjectList: TroffDataIdObject[]
): TroffHistoryList {
  return { fileNameUri, troffDataIdObjectList };
}

function idsOf(song: ServerSong): number[] {
  return song.troffDataIdObjectList.map((version) => version.troffDataId);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  vi.resetModules();
  nDBStore.clear();

  mockGetDocs.mockReset();
  mockGetDocs.mockResolvedValue({ docs: [] });
  mockCollection.mockReset();
  mockCollection.mockImplementation((_db: unknown, name: string) => ({ name }));

  mod = await import('../utils/server-song-list.js');
});

// ---------------------------------------------------------------------------
// refreshServerSongList — fetch, filter, save
// ---------------------------------------------------------------------------

describe('refreshServerSongList', () => {
  it('fetches the TroffData collection, saves the list to nDB and returns it', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        doc(makeTroffData(11, 'minor-swing.mp3', makeSongJson())),
        doc(makeTroffData(12, 'minor-swing.mp3', makeSongJson())),
        doc(makeTroffData(21, 'blue-waltz.mp3', makeSongJson())),
      ],
    });

    const list = await mod.refreshServerSongList();

    expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'TroffData');
    expect(mockGetDocs).toHaveBeenCalledTimes(1);

    // Two files → two ServerSongs; the two minor-swing versions are grouped.
    expect(list).toHaveLength(2);
    expect(list[0].fileNameUri).toBe('minor-swing.mp3');
    expect(idsOf(list[0])).toEqual([11, 12]);
    expect(list[1].fileNameUri).toBe('blue-waltz.mp3');

    // The (merged) list is persisted for getCachedServerSongList().
    expect(nDBStore.get('TROFF_SERVER_SONG_LIST_FROM_SERVER')).toEqual(list);
    expect(mod.getCachedServerSongList()).toEqual(list);
  });

  it('keeps public docs and non-public docs whose id is in the local download history only', async () => {
    nDBStore.set(TROFF_TROFF_DATA_ID_AND_FILE_NAME, [
      makeHistory('secret-song.mp3', [makeVersion(77)]),
    ]);

    mockGetDocs.mockResolvedValue({
      docs: [
        // In local history, not public → kept
        doc(
          makeTroffData(77, 'secret-song.mp3', makeSongJson(), {
            troffDataPublic: false,
          })
        ),
        // Same file, id NOT in history, not public → dropped
        doc(
          makeTroffData(78, 'secret-song.mp3', makeSongJson(), {
            troffDataPublic: false,
          })
        ),
        // File not in history at all, not public → dropped
        doc(
          makeTroffData(79, 'other-song.mp3', makeSongJson(), {
            troffDataPublic: false,
          })
        ),
        // Public → kept regardless of history
        doc(makeTroffData(80, 'public-song.mp3', makeSongJson())),
      ],
    });

    const list = await mod.refreshServerSongList();

    expect(list.map((song) => song.fileNameUri)).toEqual([
      'secret-song.mp3',
      'public-song.mp3',
    ]);
    expect(idsOf(list[0])).toEqual([77]);
  });

  it('keeps history-only versions and history-only songs when merging the local history', async () => {
    nDBStore.set(TROFF_TROFF_DATA_ID_AND_FILE_NAME, [
      makeHistory('minor-swing.mp3', [makeVersion(5), makeVersion(11)]),
      makeHistory('gone-from-server.mp3', [makeVersion(90)]),
    ]);

    mockGetDocs.mockResolvedValue({
      docs: [doc(makeTroffData(11, 'minor-swing.mp3', makeSongJson()))],
    });

    const list = await mod.refreshServerSongList();

    // The version downloaded earlier (id 5) is no longer on the server but
    // must survive the merge, and id 11 must not be duplicated.
    const swing = list.find((song) => song.fileNameUri === 'minor-swing.mp3');
    expect(swing).toBeDefined();
    expect(swing!.troffDataIdObjectList).toHaveLength(2);
    expect(idsOf(swing!).slice().sort((a, b) => a - b)).toEqual([5, 11]);

    // A history song the server no longer knows about is kept as well.
    expect(list).toHaveLength(2);
    expect(list.map((song) => song.fileNameUri)).toEqual(
      expect.arrayContaining(['minor-swing.mp3', 'gone-from-server.mp3'])
    );
  });

  it('concurrent refresh calls hit Firebase only once (session guard)', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [doc(makeTroffData(11, 'minor-swing.mp3', makeSongJson()))],
    });

    const [first, second] = await Promise.all([
      mod.refreshServerSongList(),
      mod.refreshServerSongList(),
    ]);

    expect(mockGetDocs).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first).toHaveLength(1);
  });

  it('a later refresh in the same session reuses the fetched list without refetching', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [doc(makeTroffData(11, 'minor-swing.mp3', makeSongJson()))],
    });

    const first = await mod.refreshServerSongList();
    const second = await mod.refreshServerSongList();

    expect(mockGetDocs).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('resetServerSongListForTests clears the session guard so refresh fetches again', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [doc(makeTroffData(11, 'minor-swing.mp3', makeSongJson()))],
    });

    await mod.refreshServerSongList();
    expect(mockGetDocs).toHaveBeenCalledTimes(1);

    mod.resetServerSongListForTests();

    await mod.refreshServerSongList();
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// getCachedServerSongList
// ---------------------------------------------------------------------------

describe('getCachedServerSongList', () => {
  it('returns an empty list when nothing has been fetched yet', () => {
    expect(mod.getCachedServerSongList()).toEqual([]);
  });

  it('returns the list saved by refreshServerSongList', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [doc(makeTroffData(11, 'minor-swing.mp3', makeSongJson()))],
    });

    const refreshed = await mod.refreshServerSongList();

    expect(mod.getCachedServerSongList()).toEqual(refreshed);
  });
});

// ---------------------------------------------------------------------------
// getCachedVersionInfo — the session-memory marker + duration cache that
// serves the "More about version" dialog without a per-click Firestore fetch
// ---------------------------------------------------------------------------

describe('getCachedVersionInfo', () => {
  it('returns null before any refresh and for an unknown id after a refresh', async () => {
    expect(mod.getCachedVersionInfo(11)).toBeNull();

    mockGetDocs.mockResolvedValue({
      docs: [doc(makeTroffData(11, 'minor-swing.mp3', makeSongJson()))],
    });
    await mod.refreshServerSongList();

    expect(mod.getCachedVersionInfo(999)).toBeNull();
  });

  it('after a refresh, returns the parsed markers and duration of a fetched public version', async () => {
    const markers = [makeMarker('m1', 10, 'Intro'), makeMarker('m2', 42.5, 'Chorus')];
    mockGetDocs.mockResolvedValue({
      docs: [
        doc(
          makeTroffData(
            11,
            'minor-swing.mp3',
            makeSongJson({ markers, fileData: makeFileData({ duration: 180 }) })
          )
        ),
      ],
    });

    await mod.refreshServerSongList();

    const cached = mod.getCachedVersionInfo(11);
    expect(cached).not.toBeNull();
    expect(cached).toEqual({ markers, duration: 180, info: '' });
    expect(cached!.markers.map((marker) => marker.name)).toEqual(['Intro', 'Chorus']);
    expect(cached!.markers.map((marker) => marker.time)).toEqual([10, 42.5]);
  });

  it('falls back to duration 0 when the song JSON has no fileData', async () => {
    // makeSongJson() default: no fileData key at all → Number(undefined) || 0.
    mockGetDocs.mockResolvedValue({
      docs: [doc(makeTroffData(11, 'minor-swing.mp3', makeSongJson()))],
    });

    await mod.refreshServerSongList();

    const cached = mod.getCachedVersionInfo(11);
    expect(cached).not.toBeNull();
    expect(cached).toEqual({
      markers: [makeMarker('m1', 10, 'Intro')],
      duration: 0,
      info: '',
    });
  });

  it('does not populate the cache for non-public docs that are not in the local history', async () => {
    nDBStore.set(TROFF_TROFF_DATA_ID_AND_FILE_NAME, [
      makeHistory('secret-song.mp3', [makeVersion(77)]),
    ]);

    mockGetDocs.mockResolvedValue({
      docs: [
        // In local history, not public → kept (and therefore cached)
        doc(
          makeTroffData(77, 'secret-song.mp3', makeSongJson(), {
            troffDataPublic: false,
          })
        ),
        // Same file, id NOT in history, not public → dropped (no cache entry)
        doc(
          makeTroffData(78, 'secret-song.mp3', makeSongJson(), {
            troffDataPublic: false,
          })
        ),
        // File not in history at all, not public → dropped (no cache entry)
        doc(
          makeTroffData(79, 'other-song.mp3', makeSongJson(), {
            troffDataPublic: false,
          })
        ),
        // Public → kept (and therefore cached)
        doc(makeTroffData(80, 'public-song.mp3', makeSongJson())),
      ],
    });

    await mod.refreshServerSongList();

    expect(mod.getCachedVersionInfo(78)).toBeNull();
    expect(mod.getCachedVersionInfo(79)).toBeNull();
    expect(mod.getCachedVersionInfo(77)).not.toBeNull();
    expect(mod.getCachedVersionInfo(80)).not.toBeNull();
  });

  it('resetServerSongListForTests clears the cached version info', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [doc(makeTroffData(11, 'minor-swing.mp3', makeSongJson()))],
    });
    await mod.refreshServerSongList();
    expect(mod.getCachedVersionInfo(11)).not.toBeNull();

    mod.resetServerSongListForTests();

    expect(mod.getCachedVersionInfo(11)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// troffDataListToServerSongList
// ---------------------------------------------------------------------------

describe('troffDataListToServerSongList', () => {
  it('groups versions of the same file into one ServerSong in first-appearance order', () => {
    const list = mod.troffDataListToServerSongList([
      makeTroffData(11, 'minor-swing.mp3', makeSongJson()),
      makeTroffData(12, 'minor-swing.mp3', makeSongJson()),
      makeTroffData(21, 'blue-waltz.mp3', makeSongJson()),
    ]);

    expect(list).toHaveLength(2);
    expect(list[0].fileNameUri).toBe('minor-swing.mp3');
    expect(idsOf(list[0])).toEqual([11, 12]);
    expect(list[1].fileNameUri).toBe('blue-waltz.mp3');
    expect(idsOf(list[1])).toEqual([21]);
  });

  it('maps file metadata (size, type, uploaded, deleted)', () => {
    const [song] = mod.troffDataListToServerSongList([
      makeTroffData(11, 'minor-swing.mp3', makeSongJson(), {
        fileSize: 4242,
        fileType: 'audio/ogg',
        troffDataUploadedMillis: 1650000000000,
      }),
    ]);

    expect(song.size).toBe(4242);
    expect(song.type).toBe('audio/ogg');
    expect(song.uploaded).toBe(1650000000000);
    expect(song.deleted).toBe(false);
  });

  it('marks the song deleted when the troffData doc is deleted', () => {
    const [song] = mod.troffDataListToServerSongList([
      makeTroffData(11, 'minor-swing.mp3', makeSongJson(), { deleted: true }),
    ]);

    expect(song.deleted).toBe(true);
  });

  it('URI-encodes the fileName into fileNameUri (spaces become %20)', () => {
    const [song] = mod.troffDataListToServerSongList([
      makeTroffData(31, 'my song.mp3', makeSongJson()),
    ]);

    expect(song.fileNameUri).toBe('my%20song.mp3');
  });
});

// ---------------------------------------------------------------------------
// troffDataToTroffDataIdObject
// ---------------------------------------------------------------------------

describe('troffDataToTroffDataIdObject', () => {
  it('parses markerJsonString and maps the version fields', () => {
    const longInfo = 'i'.repeat(150);
    const troffData = makeTroffData(
      11,
      'minor-swing.mp3',
      makeSongJson({
        markers: [makeMarker('m1', 10, 'Intro'), makeMarker('m2', 20, 'Chorus')],
        info: longInfo,
        aStates: ['{"name":"one"}', '{"name":"two"}'],
        fileData: makeFileData({ genre: 'Jazz', tags: 'gypsy swing' }),
      })
    );

    const version = mod.troffDataToTroffDataIdObject(troffData);

    expect(version.troffDataId).toBe(11);
    expect(version.nrMarkers).toBe(2);
    expect(version.nrStates).toBe(2);
    expect(version.genre).toBe('Jazz');
    expect(version.tags).toBe('gypsy swing');
    expect(version.info).toBe(longInfo);
    expect(version.infoBeginning).toBe(longInfo.substring(0, 99));
    expect(version.firstTimeLoaded).toBe(MODERN_MILLIS);
  });

  it('display name priority: customName, then choreography, then title, else "Unknown"', () => {
    const withCustom = mod.troffDataToTroffDataIdObject(
      makeTroffData(
        1,
        'minor-swing.mp3',
        makeSongJson({
          fileData: makeFileData({
            customName: 'My Custom Name',
            choreography: 'Choreo',
            title: 'Title',
          }),
        })
      )
    );
    expect(withCustom.displayName).toBe('My Custom Name');

    const withChoreography = mod.troffDataToTroffDataIdObject(
      makeTroffData(
        2,
        'minor-swing.mp3',
        makeSongJson({
          fileData: makeFileData({ choreography: 'Choreo', title: 'Title' }),
        })
      )
    );
    expect(withChoreography.displayName).toBe('Choreo');

    const withTitle = mod.troffDataToTroffDataIdObject(
      makeTroffData(
        3,
        'minor-swing.mp3',
        makeSongJson({ fileData: makeFileData({ title: 'Title' }) })
      )
    );
    expect(withTitle.displayName).toBe('Title');

    const withNothing = mod.troffDataToTroffDataIdObject(
      makeTroffData(4, 'minor-swing.mp3', makeSongJson({ fileData: makeFileData() }))
    );
    expect(withNothing.displayName).toBe('Unknown');
  });

  it('song without fileData: empty genre/tags, no states, "Unknown" display name', () => {
    const version = mod.troffDataToTroffDataIdObject(
      makeTroffData(1, 'minor-swing.mp3', makeSongJson())
    );

    expect(version.genre).toBe('');
    expect(version.tags).toBe('');
    expect(version.nrStates).toBe(0);
    expect(version.displayName).toBe('Unknown');
  });

  it('firstTimeLoaded falls back to fileData.lastModified when the upload millis is missing or legacy', () => {
    const withLegacyUpload = mod.troffDataToTroffDataIdObject(
      makeTroffData(
        1,
        'minor-swing.mp3',
        makeSongJson({ fileData: makeFileData({ lastModified: 1650000000000 }) }),
        { troffDataUploadedMillis: 100000000 }
      )
    );
    expect(withLegacyUpload.firstTimeLoaded).toBe(1650000000000);

    const withoutUpload = mod.troffDataToTroffDataIdObject(
      makeTroffData(
        2,
        'minor-swing.mp3',
        makeSongJson({ fileData: makeFileData({ lastModified: 1650000000000 }) }),
        { troffDataUploadedMillis: 0 }
      )
    );
    expect(withoutUpload.firstTimeLoaded).toBe(1650000000000);
  });

  it('firstTimeLoaded is 0 when neither an upload time nor a lastModified exists', () => {
    const version = mod.troffDataToTroffDataIdObject(
      makeTroffData(1, 'minor-swing.mp3', makeSongJson(), {
        troffDataUploadedMillis: 0,
      })
    );

    expect(version.firstTimeLoaded).toBe(0);
  });

  it('does not mutate the input TroffData (markerJsonString is left in place)', () => {
    const troffData = makeTroffData(
      11,
      'minor-swing.mp3',
      makeSongJson({ fileData: makeFileData({ customName: 'Custom' }) })
    );
    const snapshot = JSON.parse(JSON.stringify(troffData));

    mod.troffDataToTroffDataIdObject(troffData);

    expect(troffData).toEqual(snapshot);
    expect(troffData.markerJsonString).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// mergeServerSongListWithHistory
// ---------------------------------------------------------------------------

describe('mergeServerSongListWithHistory', () => {
  it('adds history-only versions to a server song and keeps versions deduped', () => {
    const serverSongs = [
      makeServerSong('minor-swing.mp3', [makeVersion(11), makeVersion(12)]),
    ];
    const history = [
      makeHistory('minor-swing.mp3', [makeVersion(5), makeVersion(11)]),
    ];

    const merged = mod.mergeServerSongListWithHistory(serverSongs, history);

    expect(merged).toHaveLength(1);
    expect(merged[0].troffDataIdObjectList).toHaveLength(3);
    expect(idsOf(merged[0]).slice().sort((a, b) => a - b)).toEqual([5, 11, 12]);
  });

  it('keeps songs that exist only in the local history', () => {
    const merged = mod.mergeServerSongListWithHistory(
      [makeServerSong('public.mp3', [makeVersion(1)])],
      [makeHistory('gone.mp3', [makeVersion(90)])]
    );

    expect(merged).toHaveLength(2);
    expect(merged.map((song) => song.fileNameUri)).toEqual(
      expect.arrayContaining(['public.mp3', 'gone.mp3'])
    );
  });

  it('adds server songs that are not in the history', () => {
    const merged = mod.mergeServerSongListWithHistory(
      [makeServerSong('public.mp3', [makeVersion(1)])],
      []
    );

    expect(merged.map((song) => song.fileNameUri)).toEqual(['public.mp3']);
    expect(idsOf(merged[0])).toEqual([1]);
  });
});

// ---------------------------------------------------------------------------
// filterServerSongs
// ---------------------------------------------------------------------------

describe('filterServerSongs', () => {
  // File names deliberately contain no spaces so fileNameUri and the decoded
  // file name are identical (no encoded/decoded ambiguity in these tests).
  const swing = makeServerSong('minor-swing.mp3', [
    makeVersion(11, { artist: 'Django Reinhardt', genre: 'Jazz' }),
  ]);
  const piazzolla = makeServerSong('piazzolla-live.mp3', [
    makeVersion(21, { artist: 'Someone Else', genre: 'Nuevo', title: 'Libertango' }),
  ]);
  const waltz = makeServerSong('blue-waltz.mp3', [
    makeVersion(31, { artist: 'Johann Strauss', genre: 'Waltz' }),
  ]);
  const all = [swing, piazzolla, waltz];

  const tabs = ['tracks', 'groups', 'artists', 'genre'] as const;

  it('returns the input array unchanged (same reference) for an empty query', () => {
    for (const tab of tabs) {
      const input = [...all];
      expect(mod.filterServerSongs(input, '', tab)).toBe(input);
    }
  });

  it('returns the input array unchanged (same reference) for a whitespace-only query', () => {
    for (const tab of tabs) {
      const input = [...all];
      expect(mod.filterServerSongs(input, '  \t ', tab)).toBe(input);
    }
  });

  it('tracks tab: matches the file name case-insensitively', () => {
    const result = mod.filterServerSongs(all, 'SWING', 'tracks');

    expect(result.map((song) => song.fileNameUri)).toEqual(['minor-swing.mp3']);
  });

  it('tracks tab: matches a version field (artist) even when the file name does not match', () => {
    const result = mod.filterServerSongs(all, 'django', 'tracks');

    expect(result.map((song) => song.fileNameUri)).toEqual(['minor-swing.mp3']);
  });

  it('tracks tab: matches a version title field', () => {
    const result = mod.filterServerSongs(all, 'libertango', 'tracks');

    expect(result.map((song) => song.fileNameUri)).toEqual(['piazzolla-live.mp3']);
  });

  it('tracks tab: keeps only the matching versions of a song', () => {
    const multiVersion = makeServerSong('multi.mp3', [
      makeVersion(1, { title: 'Something Blue' }),
      makeVersion(2, { title: 'Waltz for You' }),
    ]);

    const result = mod.filterServerSongs([multiVersion], 'waltz', 'tracks');

    // Version-level filtering: the non-matching version is excluded.
    expect(result).toHaveLength(1);
    expect(idsOf(result[0])).toEqual([2]);
    expect(result[0].troffDataIdObjectList[0].title).toBe('Waltz for You');

    // The input song is not mutated — it still has both versions.
    expect(idsOf(multiVersion)).toEqual([1, 2]);
  });

  it('groups tab: matches like the tracks tab (file name and version fields)', () => {
    const byFileName = mod.filterServerSongs(all, 'swing', 'groups');
    expect(byFileName.map((song) => song.fileNameUri)).toEqual(['minor-swing.mp3']);

    const byVersionField = mod.filterServerSongs(all, 'STRAUSS', 'groups');
    expect(byVersionField.map((song) => song.fileNameUri)).toEqual(['blue-waltz.mp3']);
  });

  it('artists tab: matches the artist field only — a file-name hit does not count', () => {
    const byArtist = mod.filterServerSongs(all, 'piazzolla', 'artists');
    expect(byArtist).toEqual([]);

    const byArtistField = mod.filterServerSongs(all, 'someone else', 'artists');
    expect(byArtistField.map((song) => song.fileNameUri)).toEqual(['piazzolla-live.mp3']);
  });

  it('artists tab: keeps only the versions whose artist field matches', () => {
    const multiVersion = makeServerSong('multi.mp3', [
      makeVersion(1, { artist: 'Django Reinhardt' }),
      makeVersion(2, { artist: 'Johann Strauss' }),
    ]);

    const result = mod.filterServerSongs([multiVersion], 'strauss', 'artists');

    expect(result).toHaveLength(1);
    expect(idsOf(result[0])).toEqual([2]);
  });

  it('genre tab: matches the genre field only — a file-name hit does not count', () => {
    const byFileName = mod.filterServerSongs(all, 'swing', 'genre');
    expect(byFileName).toEqual([]);

    const byGenreField = mod.filterServerSongs(all, 'WALTZ', 'genre');
    expect(byGenreField.map((song) => song.fileNameUri)).toEqual(['blue-waltz.mp3']);
  });

  it('genre tab: keeps only the versions whose genre field matches', () => {
    const multiVersion = makeServerSong('multi.mp3', [
      makeVersion(1, { genre: 'Jazz' }),
      makeVersion(2, { genre: 'Waltz' }),
    ]);

    const result = mod.filterServerSongs([multiVersion], 'waltz', 'genre');

    expect(result).toHaveLength(1);
    expect(idsOf(result[0])).toEqual([2]);
  });

  it('returns an empty array when nothing matches', () => {
    const result = mod.filterServerSongs(all, 'samba', 'tracks');

    expect(result).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const input = [...all];
    const snapshot = input.map((song) => ({
      ...song,
      troffDataIdObjectList: [...song.troffDataIdObjectList],
    }));

    mod.filterServerSongs(input, 'swing', 'tracks');

    expect(input).toEqual(snapshot);
  });

  it('trims surrounding whitespace from the query before matching', () => {
    const result = mod.filterServerSongs(all, '   swing   ', 'tracks');

    expect(result.map((song) => song.fileNameUri)).toEqual(['minor-swing.mp3']);
  });
});
