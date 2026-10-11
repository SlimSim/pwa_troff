import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  TroffFirebaseGroupIdentifyer,
} from '../types/troff.d.js';

/**
 * Regression tests: per-group song `status` ('prio' | 'active' | 'standard' |
 * 'archived') must survive a reload.
 *
 * BUG: `utils/firebase-sync.ts` `syncFirebaseGroups` rebuilt `group.songs`
 * from the Firestore Songs docs copying only
 * `{firebaseSongDocId, fullPath, galleryId, fileUrl}` — never `status` — and
 * then replaced the whole local group object, dropping the local status.
 * Latent same bug in `utils/firebase-realtime.ts` `handleGroupSongsSnapshot`
 * (server mapping + new-song append).
 *
 * EXPECTED FIX: at both sites map
 * `status: normalizeGroupSongStatus(doc.status)`.
 * `status` lives at the TOP LEVEL of the Songs doc (see the v2Script
 * `setDoc(..., { status }, { merge: true })` write and the
 * `shareSongToFirebaseGroup` payload), and `songData`/`data` in both modules
 * is the whole doc data.
 *
 * Backwards compat: docs without `status` → entry gets 'standard';
 * a doc WITH `status` wins.
 */

// ---------------------------------------------------------------------------
// Mock nDB, log and album-art before importing the modules under test.
// ---------------------------------------------------------------------------

const nDBStore: Record<string, unknown> = {};

vi.mock('../assets/internal/db.js', () => ({
  nDB: {
    get: vi.fn((key: string) => nDBStore[key]),
    set: vi.fn((key: string, value: unknown) => {
      nDBStore[key] = value;
    }),
    setOnSong: vi.fn(),
  },
}));

vi.mock('../utils/log.js', () => ({
  default: {
    i: vi.fn(),
    e: vi.fn(),
    d: vi.fn(),
    w: vi.fn(),
    t: vi.fn(),
  },
}));

vi.mock('../utils/album-art.js', () => ({
  extractAlbumArt: vi.fn(async (_songKey: string) => undefined),
}));

// ---------------------------------------------------------------------------
// Global caches + fetch stubs (needed by both modules).
// ---------------------------------------------------------------------------

const mockCache: Record<string, Response> = {};
const mockCacheInstance = {
  match: vi.fn(async (key: string) => mockCache[key] ?? null),
  put: vi.fn(async (key: string, response: Response) => {
    mockCache[key] = response;
  }),
};
const cachesMock = {
  open: vi.fn(async (_name: string) => mockCacheInstance),
};
vi.stubGlobal('caches', cachesMock);

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// ---------------------------------------------------------------------------
// firebaseClient mock — covers firebase-sync (initiateAllFirebaseGroups /
// getDocs / collection) and firebase-realtime (onSnapshot / doc / setDoc).
// ---------------------------------------------------------------------------

type DocLike = { id: string; data: () => Record<string, unknown> };

const mockFirebaseGroupSnapshot = {
  metadata: { fromCache: false },
  docs: [] as DocLike[],
};
const mockFirebaseSongsSnapshot = {
  docs: [] as DocLike[],
};

const mockInitiateAllFirebaseGroups = vi.fn(async (_email: string) => mockFirebaseGroupSnapshot);
const mockCollection = vi.fn((_db: unknown, ...segments: string[]) => ({
  path: segments.join('/'),
}));
const mockGetDocs = vi.fn(async (_ref: unknown) => mockFirebaseSongsSnapshot);
const mockDoc = vi.fn((_db: unknown, ...segments: string[]) => ({
  path: segments.join('/'),
}));
const mockOnSnapshot = vi.fn();
const mockSetDoc = vi.fn();

vi.mock('../services/firebaseClient.js', () => ({
  db: {},
  collection: mockCollection,
  getDocs: mockGetDocs,
  initiateAllFirebaseGroups: mockInitiateAllFirebaseGroups,
  doc: mockDoc,
  onSnapshot: mockOnSnapshot,
  setDoc: mockSetDoc,
  query: vi.fn(),
  where: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const groupDoc = (id: string, data: Record<string, unknown>): DocLike => ({
  id,
  data: () => data,
});

const songDoc = (id: string, data: Record<string, unknown>): DocLike => ({
  id,
  data: () => data,
});

function getGroup(groupId: string): TroffFirebaseGroupIdentifyer {
  const lists = nDBStore['aoSongLists'] as TroffFirebaseGroupIdentifyer[] | undefined;
  const group = lists?.find((g) => g.firebaseGroupDocId === groupId);
  if (!group) throw new Error(`group "${groupId}" not found in aoSongLists`);
  return group;
}

// ===========================================================================
// (a) syncFirebaseGroups — the reported bug
// ===========================================================================

describe('syncFirebaseGroups — group song status survives reload', () => {
  let syncFirebaseGroups: (firebaseUserEmail: string) => Promise<void>;

  beforeEach(async () => {
    vi.resetModules();
    Object.keys(nDBStore).forEach((k) => delete nDBStore[k]);
    Object.keys(mockCache).forEach((k) => delete mockCache[k]);
    fetchMock.mockReset();
    mockCacheInstance.match.mockClear();
    mockCacheInstance.put.mockClear();
    cachesMock.open.mockClear();
    mockInitiateAllFirebaseGroups.mockClear();
    mockCollection.mockClear();
    mockGetDocs.mockClear();

    mockFirebaseGroupSnapshot.metadata = { fromCache: false };
    mockFirebaseGroupSnapshot.docs = [];
    mockFirebaseSongsSnapshot.docs = [];

    const mod = await import('../utils/firebase-sync.js');
    syncFirebaseGroups = mod.syncFirebaseGroups;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Arrange one Firebase group + one Firestore Songs doc for the sync. */
  function arrange(groupId: string, songDocData: Record<string, unknown>): void {
    mockFirebaseGroupSnapshot.docs = [
      groupDoc(groupId, { name: 'Band', owners: ['user@example.com'] }),
    ];
    mockFirebaseSongsSnapshot.docs = [songDoc('s1', songDocData)];
    mockCache['track.mp3'] = new Response('audio data');
  }

  it('keeps the local status when the Firestore doc already carries it (prio)', async () => {
    nDBStore['aoSongLists'] = [
      {
        firebaseGroupDocId: 'g1',
        name: 'Band',
        songs: [
          {
            firebaseSongDocId: 's1',
            fullPath: 'track.mp3',
            galleryId: 'pwa-galleryId',
            fileUrl: 'https://example.com/track.mp3',
            status: 'prio',
          },
        ],
      },
    ];

    arrange('g1', {
      songKey: 'track.mp3',
      fileUrl: 'https://example.com/track.mp3',
      jsonDataInfo: JSON.stringify({ markers: [], latestUploadToFirebase: 1000 }),
      status: 'prio',
    });

    await expect(syncFirebaseGroups('user@example.com')).resolves.toBeUndefined();

    const group = getGroup('g1');
    expect(group.songs).toHaveLength(1);
    expect(group.songs[0].status).toBe('prio');
  });

  it('flows the server status into the local entry when the local entry had none', async () => {
    nDBStore['aoSongLists'] = [
      {
        firebaseGroupDocId: 'g1',
        name: 'Band',
        songs: [
          {
            firebaseSongDocId: 's1',
            fullPath: 'track.mp3',
            galleryId: 'pwa-galleryId',
            fileUrl: 'https://example.com/track.mp3',
          },
        ],
      },
    ];

    arrange('g1', {
      songKey: 'track.mp3',
      fileUrl: 'https://example.com/track.mp3',
      jsonDataInfo: JSON.stringify({ markers: [], latestUploadToFirebase: 1000 }),
      status: 'archived',
    });

    await expect(syncFirebaseGroups('user@example.com')).resolves.toBeUndefined();

    const group = getGroup('g1');
    expect(group.songs).toHaveLength(1);
    expect(group.songs[0].status).toBe('archived');
  });

  it('normalizes docs without status to "standard" (backwards compat)', async () => {
    nDBStore['aoSongLists'] = [
      {
        firebaseGroupDocId: 'g1',
        name: 'Band',
        songs: [
          {
            firebaseSongDocId: 's1',
            fullPath: 'track.mp3',
            galleryId: 'pwa-galleryId',
            fileUrl: 'https://example.com/track.mp3',
          },
        ],
      },
    ];

    arrange('g1', {
      songKey: 'track.mp3',
      fileUrl: 'https://example.com/track.mp3',
      jsonDataInfo: JSON.stringify({ markers: [], latestUploadToFirebase: 1000 }),
      // no `status` field — legacy doc
    });

    await expect(syncFirebaseGroups('user@example.com')).resolves.toBeUndefined();

    const group = getGroup('g1');
    expect(group.songs).toHaveLength(1);
    expect(group.songs[0].status).toBe('standard');
  });

  it('normalizes an unrecognized status value to "standard"', async () => {
    nDBStore['aoSongLists'] = [
      {
        firebaseGroupDocId: 'g1',
        name: 'Band',
        songs: [
          {
            firebaseSongDocId: 's1',
            fullPath: 'track.mp3',
            galleryId: 'pwa-galleryId',
            fileUrl: 'https://example.com/track.mp3',
          },
        ],
      },
    ];

    arrange('g1', {
      songKey: 'track.mp3',
      fileUrl: 'https://example.com/track.mp3',
      jsonDataInfo: JSON.stringify({ markers: [], latestUploadToFirebase: 1000 }),
      status: 'bogus',
    });

    await expect(syncFirebaseGroups('user@example.com')).resolves.toBeUndefined();

    const group = getGroup('g1');
    expect(group.songs).toHaveLength(1);
    expect(group.songs[0].status).toBe('standard');
  });
});

// ===========================================================================
// (b) handleGroupSongsSnapshot (latent same bug) — via setupGroupSongListeners
// ===========================================================================

describe('handleGroupSongsSnapshot — group song status on remote additions', () => {
  let setupGroupSongListeners: () => Promise<void>;

  /** Register the collection snapshot callback passed to onSnapshot. */
  function triggerGroupSnapshot(
    groupId: string,
    docs: DocLike[],
    hasPendingWrites = false
  ): void {
    const call = mockOnSnapshot.mock.calls.find(
      (c: unknown[]) => (c[0] as { path: string })?.path === `Groups/${groupId}/Songs`
    );
    if (!call) throw new Error(`No onSnapshot call found for collection "Groups/${groupId}/Songs"`);
    const cb = call[1] as (snapshot: {
      docs: DocLike[];
      metadata: { hasPendingWrites: boolean };
    }) => void;
    cb({ docs, metadata: { hasPendingWrites } });
  }

  beforeEach(async () => {
    vi.resetModules();
    Object.keys(nDBStore).forEach((k) => delete nDBStore[k]);
    Object.keys(mockCache).forEach((k) => delete mockCache[k]);
    fetchMock.mockReset();
    mockCacheInstance.match.mockClear();
    mockCacheInstance.put.mockClear();
    cachesMock.open.mockClear();
    mockOnSnapshot.mockClear();
    mockCollection.mockClear();
    mockDoc.mockClear();
    mockSetDoc.mockClear();

    const mod = await import('../utils/firebase-realtime.js');
    setupGroupSongListeners = mod.setupGroupSongListeners;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('appends a new remote song with its normalized status (archived)', async () => {
    nDBStore['aoSongLists'] = [{ firebaseGroupDocId: 'g1', songs: [] }];
    fetchMock.mockResolvedValue(new Response('audio data', { status: 200 }));

    await setupGroupSongListeners();

    triggerGroupSnapshot('g1', [
      songDoc('s1', {
        songKey: 'new-track.mp3',
        fileUrl: 'https://example.com/new-track.mp3',
        jsonDataInfo: JSON.stringify({ markers: [], latestUploadToFirebase: 100 }),
        status: 'archived',
      }),
    ]);

    // The audio download runs inside the snapshot handler — flush microtasks
    await new Promise((resolve) => setTimeout(resolve, 0));

    const group = getGroup('g1');
    expect(group.songs).toHaveLength(1);
    expect(group.songs[0].status).toBe('archived');
  });

  it('appends a new remote song without status as "standard" (backwards compat)', async () => {
    nDBStore['aoSongLists'] = [{ firebaseGroupDocId: 'g1', songs: [] }];
    fetchMock.mockResolvedValue(new Response('audio data', { status: 200 }));

    await setupGroupSongListeners();

    triggerGroupSnapshot('g1', [
      songDoc('s1', {
        songKey: 'new-track.mp3',
        fileUrl: 'https://example.com/new-track.mp3',
        jsonDataInfo: JSON.stringify({ markers: [], latestUploadToFirebase: 100 }),
        // no `status` field — legacy doc
      }),
    ]);

    await new Promise((resolve) => setTimeout(resolve, 0));

    const group = getGroup('g1');
    expect(group.songs).toHaveLength(1);
    expect(group.songs[0].status).toBe('standard');
  });

  it('appends a new remote song with a doc-level status of "prio"', async () => {
    nDBStore['aoSongLists'] = [{ firebaseGroupDocId: 'g1', songs: [] }];
    fetchMock.mockResolvedValue(new Response('audio data', { status: 200 }));

    await setupGroupSongListeners();

    triggerGroupSnapshot('g1', [
      songDoc('s1', {
        songKey: 'new-track.mp3',
        fileUrl: 'https://example.com/new-track.mp3',
        jsonDataInfo: JSON.stringify({ markers: [], latestUploadToFirebase: 100 }),
        status: 'prio',
      }),
    ]);

    await new Promise((resolve) => setTimeout(resolve, 0));

    const group = getGroup('g1');
    expect(group.songs).toHaveLength(1);
    expect(group.songs[0].status).toBe('prio');
  });
});
