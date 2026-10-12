import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (same pattern as tests/firebase-realtime.test.ts).
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

const mockOnSnapshot = vi.fn();
const mockDoc = vi.fn((_db: unknown, ...pathSegments: string[]) => ({
  path: pathSegments.join('/'),
}));
const mockSetDoc = vi.fn();
const mockCollection = vi.fn((_db: unknown, ...pathSegments: string[]) => ({
  path: pathSegments.join('/'),
}));

vi.mock('../services/firebaseClient.js', () => ({
  db: {},
  doc: mockDoc,
  onSnapshot: mockOnSnapshot,
  setDoc: mockSetDoc,
  collection: mockCollection,
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

const extractAlbumArtSpy = vi.hoisted(() => vi.fn(async (_songKey: string) => {}));
vi.mock('../utils/album-art.js', () => ({
  extractAlbumArt: extractAlbumArtSpy,
}));

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
// Suite: live status sync for EXISTING group songs.
// ---------------------------------------------------------------------------

describe('group song status live sync (existing songs)', () => {
  let setupGroupSongListeners: () => Promise<void>;
  let setGroupUpdateCallback: (cb: (groupId: string) => void) => void;
  let teardownListeners: () => void;

  function triggerGroupSnapshot(
    groupId: string,
    docs: Array<{ id: string; data: () => Record<string, unknown> }>,
    hasPendingWrites = false
  ): void {
    const call = mockOnSnapshot.mock.calls.find(
      (c: unknown[]) => (c[0] as { path: string })?.path === `Groups/${groupId}/Songs`
    );
    if (!call) throw new Error(`No onSnapshot call found for collection "Groups/${groupId}/Songs"`);
    const cb = call[1] as (snapshot: {
      docs: Array<{ id: string; data: () => Record<string, unknown> }>;
      metadata: { hasPendingWrites: boolean };
    }) => void;
    cb({ docs, metadata: { hasPendingWrites } });
  }

  const songDoc = (id: string, data: Record<string, unknown>) => ({ id, data: () => data });

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  type SongEntry = {
    firebaseSongDocId?: string;
    fullPath: string;
    galleryId: string;
    fileUrl?: string;
    status?: string;
  };
  type GroupEntry = { firebaseGroupDocId?: string; songs: SongEntry[] };

  function seedExistingSong(initialStatus: string): void {
    nDBStore['aoSongLists'] = [
      {
        firebaseGroupDocId: 'g1',
        songs: [
          {
            firebaseSongDocId: 's1',
            fullPath: 'track.mp3',
            galleryId: 'pwa-galleryId',
            fileUrl: 'https://example.com/track.mp3',
            status: initialStatus,
          },
        ],
      } as GroupEntry,
    ];
    // Audio already cached so no download is needed.
    mockCache['track.mp3'] = new Response('already cached');
  }

  function remoteDocWithStatus(status: unknown): Array<{ id: string; data: () => Record<string, unknown> }> {
    const data: Record<string, unknown> = {
      songKey: 'track.mp3',
      fileUrl: 'https://example.com/track.mp3',
    };
    if (status !== undefined) data.status = status;
    return [songDoc('s1', data)];
  }

  function localSong(): SongEntry {
    const groups = nDBStore['aoSongLists'] as GroupEntry[];
    return groups[0].songs[0];
  }

  beforeEach(async () => {
    vi.resetModules();
    Object.keys(nDBStore).forEach((k) => delete nDBStore[k]);
    Object.keys(mockCache).forEach((k) => delete mockCache[k]);
    mockOnSnapshot.mockClear();
    mockDoc.mockClear();
    mockSetDoc.mockClear();
    mockCollection.mockClear();
    fetchMock.mockReset();
    mockCacheInstance.match.mockClear();
    mockCacheInstance.put.mockClear();
    cachesMock.open.mockClear();
    extractAlbumArtSpy.mockClear();

    const mod = await import('../utils/firebase-realtime.js');
    setupGroupSongListeners = mod.setupGroupSongListeners;
    setGroupUpdateCallback = mod.setGroupUpdateCallback;
    teardownListeners = mod.teardownListeners;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates status of an existing song from standard to prio, persists, and invokes groupUpdateCallback', async () => {
    seedExistingSong('standard');
    fetchMock.mockResolvedValue(new Response('audio data', { status: 200 }));

    await setupGroupSongListeners();
    const cb = vi.fn();
    setGroupUpdateCallback(cb);
    const { nDB } = await import('../assets/internal/db.js');
    vi.mocked(nDB.set).mockClear();

    triggerGroupSnapshot('g1', remoteDocWithStatus('prio'));
    await flush();

    // Local entry updated.
    expect(localSong().status).toBe('prio');
    // Persisted.
    expect(vi.mocked(nDB.set)).toHaveBeenCalledWith('aoSongLists', expect.anything());
    expect((nDBStore['aoSongLists'] as GroupEntry[])[0].songs[0].status).toBe('prio');
    // Callback invoked with the group id.
    expect(cb).toHaveBeenCalledWith('g1');
    // No duplicate entries and no re-download (already cached).
    expect((nDBStore['aoSongLists'] as GroupEntry[])[0].songs).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([['active'], ['archived'], ['prio']] as Array<[string]>)('updates existing song status to %s', async (target) => {
    seedExistingSong('standard');
    fetchMock.mockResolvedValue(new Response('audio data', { status: 200 }));

    await setupGroupSongListeners();
    const cb = vi.fn();
    setGroupUpdateCallback(cb);

    triggerGroupSnapshot('g1', remoteDocWithStatus(target));
    await flush();

    expect(localSong().status).toBe(target);
    expect(cb).toHaveBeenCalledWith('g1');
    expect((nDBStore['aoSongLists'] as GroupEntry[])[0].songs).toHaveLength(1);
  });

  it.each([[undefined], ['bogus'], [null], [123]] as Array<[unknown]>)('normalizes missing/invalid status %s to standard', async (badStatus) => {
    seedExistingSong('prio');
    fetchMock.mockResolvedValue(new Response('audio data', { status: 200 }));

    await setupGroupSongListeners();
    const cb = vi.fn();
    setGroupUpdateCallback(cb);

    triggerGroupSnapshot('g1', remoteDocWithStatus(badStatus));
    await flush();

    expect(localSong().status).toBe('standard');
    expect(cb).toHaveBeenCalledWith('g1');
  });

  it('does not rewrite or callback when status is unchanged', async () => {
    seedExistingSong('standard');

    await setupGroupSongListeners();
    const cb = vi.fn();
    setGroupUpdateCallback(cb);
    const { nDB } = await import('../assets/internal/db.js');
    vi.mocked(nDB.set).mockClear();

    triggerGroupSnapshot('g1', remoteDocWithStatus('standard'));
    await flush();

    expect(localSong().status).toBe('standard');
    expect(vi.mocked(nDB.set)).not.toHaveBeenCalledWith('aoSongLists', expect.anything());
    expect(cb).not.toHaveBeenCalled();
    expect((nDBStore['aoSongLists'] as GroupEntry[])[0].songs).toHaveLength(1);
  });

  it('ignores snapshots with hasPendingWrites', async () => {
    seedExistingSong('standard');

    await setupGroupSongListeners();
    const cb = vi.fn();
    setGroupUpdateCallback(cb);
    const { nDB } = await import('../assets/internal/db.js');
    vi.mocked(nDB.set).mockClear();

    triggerGroupSnapshot('g1', remoteDocWithStatus('prio'), true);
    await flush();

    expect(localSong().status).toBe('standard');
    expect(vi.mocked(nDB.set)).not.toHaveBeenCalledWith('aoSongLists', expect.anything());
    expect(cb).not.toHaveBeenCalled();
  });

  it('teardownListeners stops group status updates', async () => {
    const unsub = vi.fn();
    mockOnSnapshot.mockReturnValue(unsub);
    seedExistingSong('standard');

    await setupGroupSongListeners();
    const cb = vi.fn();
    setGroupUpdateCallback(cb);
    teardownListeners();
    mockOnSnapshot.mockClear();

    // No listener remains; nothing to trigger. Callback must not fire.
    expect(mockOnSnapshot).not.toHaveBeenCalled();
    expect(cb).not.toHaveBeenCalled();
    expect(localSong().status).toBe('standard');
  });
});
