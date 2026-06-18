import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock nDB and caches before importing the module under test.
// nDB is statically imported by firebase-sync.ts; vi.mock is hoisted.
// ---------------------------------------------------------------------------

const nDBStore: Record<string, unknown> = {};

const mockCache: Record<string, Response> = {};
const mockCacheInstance = {
  match: vi.fn(async (key: string) => mockCache[key] ?? null),
  put: vi.fn(async (key: string, _response: Response) => {
    mockCache[key] = _response;
  }),
};

vi.mock('../assets/internal/db.js', () => ({
  nDB: {
    get: vi.fn((key: string) => nDBStore[key]),
    set: vi.fn((key: string, value: unknown) => {
      nDBStore[key] = value;
    }),
    setOnSong: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock the global `caches` API (unavailable in Node / happy-dom).
// ---------------------------------------------------------------------------
const cachesMock = {
  open: vi.fn(async (_name: string) => mockCacheInstance),
};
vi.stubGlobal('caches', cachesMock);

// ---------------------------------------------------------------------------
// Mock fetch globally so we control network responses.
// ---------------------------------------------------------------------------
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// ---------------------------------------------------------------------------
// Mock firebaseClient — use vi.hoisted to define shared mock data that's
// available when the mock factory (hoisted to module top) runs.
// Each test re-configures the mocks via beforeEach.
// ---------------------------------------------------------------------------
const mockFirebaseGroupSnapshot = vi.hoisted(() => ({ metadata: { fromCache: false }, docs: [] as any[] }));
const mockFirebaseSongsSnapshot = vi.hoisted(() => ({ docs: [] as any[] }));

const mockInitiateAllFirebaseGroups = vi.fn(async (_email: string) => mockFirebaseGroupSnapshot);
const mockCollection = vi.fn();
const mockGetDocs = vi.fn(async (ref: unknown) => {
  return ref === mockFirebaseGroupSnapshot ? mockFirebaseGroupSnapshot : mockFirebaseSongsSnapshot;
});

vi.mock('../services/firebaseClient.js', () => ({
  initiateAllFirebaseGroups: mockInitiateAllFirebaseGroups,
  db: {},
  collection: mockCollection,
  getDocs: mockGetDocs,
}));

describe('syncFirebaseGroups', () => {
  let syncFirebaseGroups: (firebaseUserEmail: string) => Promise<void>;

  const groupDoc = (id: string, data: Record<string, unknown>) => ({
    id,
    data: () => data,
  });

  const songDoc = (id: string, data: Record<string, unknown>) => ({
    id,
    data: () => data,
  });

  beforeEach(async () => {
    vi.resetModules();
    // Clear storage between tests
    Object.keys(nDBStore).forEach((k) => delete nDBStore[k]);
    Object.keys(mockCache).forEach((k) => delete mockCache[k]);
    fetchMock.mockReset();
    mockCacheInstance.match.mockClear();
    mockCacheInstance.put.mockClear();
    cachesMock.open.mockClear();
    mockInitiateAllFirebaseGroups.mockClear();
    mockCollection.mockClear();
    mockGetDocs.mockClear();

    // Default: empty groups & songs (no-op scenario)
    mockFirebaseGroupSnapshot.metadata = { fromCache: false };
    mockFirebaseGroupSnapshot.docs = [];
    mockFirebaseSongsSnapshot.docs = [];

    const mod = await import('../utils/firebase-sync.js');
    syncFirebaseGroups = mod.syncFirebaseGroups;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Firebase unavailable
  // -----------------------------------------------------------------------
  it('is a no-op when Firebase is unavailable (dynamic import fails)', async () => {
    // The mock for firebaseClient is already set up. We need to test the case
    // where it's NOT mocked. Since vi.mock always applies, the mock is always
    // in effect. However, we can simulate unavailability by having
    // initiateAllFirebaseGroups throw.
    mockInitiateAllFirebaseGroups.mockRejectedValueOnce(new Error('Not available'));

    await expect(syncFirebaseGroups('user@example.com')).resolves.toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Snapshot checks
  // -----------------------------------------------------------------------
  it('is a no-op when snapshot is from cache', async () => {
    mockFirebaseGroupSnapshot.metadata = { fromCache: true };
    mockFirebaseGroupSnapshot.docs = [];

    await expect(syncFirebaseGroups('user@example.com')).resolves.toBeUndefined();
    // Should NOT update aoSongLists
    expect(nDBStore['aoSongLists']).toBeUndefined();
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('is a no-op when initiateAllFirebaseGroups returns undefined', async () => {
    (mockInitiateAllFirebaseGroups as any).mockResolvedValueOnce(undefined);

    await expect(syncFirebaseGroups('user@example.com')).resolves.toBeUndefined();
    expect(nDBStore['aoSongLists']).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Full sync flow
  // -----------------------------------------------------------------------
  it('processes groups and songs correctly', async () => {
    const groupId1 = 'group1';
    const songKey1 = 'test-track.mp3';
    const fileUrl1 = 'https://example.com/test-track.mp3';
    const jsonData1 = JSON.stringify({
      markers: [{ id: 'm1', time: 10 }],
      latestUploadToFirebase: 1000,
    });

    mockFirebaseGroupSnapshot.docs = [
      groupDoc(groupId1, {
        name: 'My Group',
        owners: ['user@example.com'],
        color: '#ff0000',
        icon: 'music',
      }),
    ];

    mockFirebaseSongsSnapshot.docs = [
      songDoc('songDoc1', {
        songKey: songKey1,
        fileUrl: fileUrl1,
        jsonDataInfo: jsonData1,
      }),
    ];

    // Pre-populate the cache: song already exists
    mockCache[songKey1] = new Response('audio data');

    await expect(syncFirebaseGroups('user@example.com')).resolves.toBeUndefined();

    // aoSongLists should be updated
    const songLists = nDBStore['aoSongLists'] as any[];
    expect(songLists).toBeDefined();
    expect(songLists).toHaveLength(1);
    expect(songLists[0].name).toBe('My Group');
    expect(songLists[0].firebaseGroupDocId).toBe(groupId1);
    expect(songLists[0].songs).toHaveLength(1);
    expect(songLists[0].songs[0].fullPath).toBe(songKey1);

    // Song metadata should be saved to nDB
    const savedSongData = nDBStore[songKey1] as any;
    expect(savedSongData).toBeDefined();
    expect(savedSongData.markers).toEqual([{ id: 'm1', time: 10 }]);
  });

  // -----------------------------------------------------------------------
  // Downloads missing songs
  // -----------------------------------------------------------------------
  it('downloads a song file when not in cache', async () => {
    const songKey1 = 'new-track.mp3';
    const fileUrl1 = 'https://example.com/new-track.mp3';

    mockFirebaseGroupSnapshot.docs = [
      groupDoc('group1', { name: 'Test', owners: ['user@example.com'] }),
    ];

    mockFirebaseSongsSnapshot.docs = [
      songDoc('s1', {
        songKey: songKey1,
        fileUrl: fileUrl1,
        jsonDataInfo: JSON.stringify({ markers: [], latestUploadToFirebase: 1 }),
      }),
    ];

    // No cached file — fetch should be called
    fetchMock.mockResolvedValue(new Response('new audio content', { status: 200 }));

    await expect(syncFirebaseGroups('user@example.com')).resolves.toBeUndefined();

    // fetch was called with the fileUrl
    expect(fetchMock).toHaveBeenCalledWith(fileUrl1);
    // The response was stored in cache
    expect(mockCacheInstance.put).toHaveBeenCalledWith(songKey1, expect.any(Response));
  });

  // -----------------------------------------------------------------------
  // Skips existing songs
  // -----------------------------------------------------------------------
  it('does not download song when already in cache', async () => {
    const songKey1 = 'existing-track.mp3';

    mockFirebaseGroupSnapshot.docs = [
      groupDoc('group1', { name: 'Test', owners: ['user@example.com'] }),
    ];

    mockFirebaseSongsSnapshot.docs = [
      songDoc('s1', {
        songKey: songKey1,
        fileUrl: 'https://example.com/track.mp3',
        jsonDataInfo: JSON.stringify({ markers: [], latestUploadToFirebase: 1 }),
      }),
    ];

    // Pre-populate cache
    mockCache[songKey1] = new Response('existing content');

    await expect(syncFirebaseGroups('user@example.com')).resolves.toBeUndefined();

    // fetch should NOT be called since the file is already cached
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Handles download failure gracefully
  // -----------------------------------------------------------------------
  it('skips a song when download fails and continues with other songs', async () => {
    const goodSongKey = 'good-track.mp3';

    mockFirebaseGroupSnapshot.docs = [
      groupDoc('group1', { name: 'Test', owners: ['user@example.com'] }),
    ];

    mockFirebaseSongsSnapshot.docs = [
      songDoc('s1', {
        songKey: 'bad-track.mp3',
        fileUrl: 'https://example.com/bad.mp3',
        jsonDataInfo: JSON.stringify({ markers: [], latestUploadToFirebase: 1 }),
      }),
      songDoc('s2', {
        songKey: goodSongKey,
        fileUrl: 'https://example.com/good.mp3',
        jsonDataInfo: JSON.stringify({ markers: [{ id: 'm1' }], latestUploadToFirebase: 2 }),
      }),
    ];

    // First fetch fails, second succeeds
    fetchMock
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(new Response('good audio', { status: 200 }));

    await expect(syncFirebaseGroups('user@example.com')).resolves.toBeUndefined();

    // Only the good song should be in the group
    const songLists = nDBStore['aoSongLists'] as any[];
    expect(songLists).toHaveLength(1);
    expect(songLists[0].songs).toHaveLength(1);
    expect(songLists[0].songs[0].fullPath).toBe(goodSongKey);
  });

  // -----------------------------------------------------------------------
  // Merges with local groups
  // -----------------------------------------------------------------------
  it('merges Firebase groups with existing local-only groups', async () => {
    // Pre-populate aoSongLists with a local group (no firebaseGroupDocId)
    nDBStore['aoSongLists'] = [
      {
        id: 'local-group',
        name: 'Local Group',
        songs: [{ fullPath: 'local-song.mp3', galleryId: 'local' }],
      },
    ];

    mockFirebaseGroupSnapshot.docs = [
      groupDoc('firebase-group', { name: 'Firebase Group', owners: ['user@example.com'] }),
    ];

    mockFirebaseSongsSnapshot.docs = [
      songDoc('s1', {
        songKey: 'fb-song.mp3',
        fileUrl: 'https://example.com/fb.mp3',
        jsonDataInfo: JSON.stringify({ markers: [], latestUploadToFirebase: 1 }),
      }),
    ];

    // Cache the Firebase song
    mockCache['fb-song.mp3'] = new Response('fb content');

    await expect(syncFirebaseGroups('user@example.com')).resolves.toBeUndefined();

    const songLists = nDBStore['aoSongLists'] as any[];
    // Should have both local group and Firebase group
    expect(songLists).toHaveLength(2);
    const localGroup = songLists.find((g: any) => g.id === 'local-group');
    const fbGroup = songLists.find((g: any) => g.firebaseGroupDocId === 'firebase-group');
    expect(localGroup).toBeDefined();
    expect(fbGroup).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Respects server upload time
  // -----------------------------------------------------------------------
  it('does not overwrite local data when local upload time is newer', async () => {
    const songKey1 = 'conflict-track.mp3';

    // Pre-populate nDB with newer local data
    nDBStore[songKey1] = {
      markers: [{ id: 'local-marker', time: 5 }],
      latestUploadToFirebase: 2000,
    };

    mockFirebaseGroupSnapshot.docs = [
      groupDoc('group1', { name: 'Test', owners: ['user@example.com'] }),
    ];

    mockFirebaseSongsSnapshot.docs = [
      songDoc('s1', {
        songKey: songKey1,
        fileUrl: 'https://example.com/track.mp3',
        // Server data is OLDER (1000 < 2000)
        jsonDataInfo: JSON.stringify({
          markers: [{ id: 'server-marker', time: 10 }],
          latestUploadToFirebase: 1000,
        }),
      }),
    ];

    mockCache[songKey1] = new Response('content');

    await expect(syncFirebaseGroups('user@example.com')).resolves.toBeUndefined();

    // Local data should still have the local marker (not overwritten)
    const savedData = nDBStore[songKey1] as any;
    expect(savedData.markers).toEqual([{ id: 'local-marker', time: 5 }]);
  });

  // -----------------------------------------------------------------------
  // Handles song with missing songKey or fileUrl
  // -----------------------------------------------------------------------
  it('skips song documents with missing songKey or fileUrl', async () => {
    mockFirebaseGroupSnapshot.docs = [
      groupDoc('group1', { name: 'Test', owners: ['user@example.com'] }),
    ];

    // One song is valid, one has no songKey, one has no fileUrl
    mockFirebaseSongsSnapshot.docs = [
      songDoc('s1', {
        songKey: 'valid-song.mp3',
        fileUrl: 'https://example.com/valid.mp3',
        jsonDataInfo: JSON.stringify({ markers: [], latestUploadToFirebase: 1 }),
      }),
      songDoc('s2', {
        // Missing songKey
        fileUrl: 'https://example.com/invalid.mp3',
        jsonDataInfo: JSON.stringify({ markers: [], latestUploadToFirebase: 1 }),
      }),
      songDoc('s3', {
        songKey: 'no-url-song.mp3',
        // Missing fileUrl
        jsonDataInfo: JSON.stringify({ markers: [], latestUploadToFirebase: 1 }),
      }),
    ];

    mockCache['valid-song.mp3'] = new Response('content');

    await expect(syncFirebaseGroups('user@example.com')).resolves.toBeUndefined();

    const songLists = nDBStore['aoSongLists'] as any[];
    expect(songLists).toHaveLength(1);
    // Only 1 valid song should be included
    expect(songLists[0].songs).toHaveLength(1);
    expect(songLists[0].songs[0].fullPath).toBe('valid-song.mp3');
  });
});
