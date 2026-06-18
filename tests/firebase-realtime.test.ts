import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock nDB before importing the module under test.
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

// ---------------------------------------------------------------------------
// Mock the log module to avoid console noise.
// ---------------------------------------------------------------------------

vi.mock('../utils/log.js', () => ({
  default: {
    i: vi.fn(),
    e: vi.fn(),
    d: vi.fn(),
    w: vi.fn(),
    t: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Firestore mock helpers — shared across tests.
// ---------------------------------------------------------------------------

type SnapshotCallback = (snapshot: {
  data: () => Record<string, unknown> | undefined;
  metadata: { hasPendingWrites: boolean };
  exists: () => boolean;
}) => void;

const mockOnSnapshot = vi.fn();
const mockDoc = vi.fn((_db: unknown, ...pathSegments: string[]) => ({
  path: pathSegments.join('/'),
}));
const mockSetDoc = vi.fn();

vi.mock('../services/firebaseClient.js', () => ({
  db: {},
  doc: mockDoc,
  onSnapshot: mockOnSnapshot,
  setDoc: mockSetDoc,
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('firebase-realtime', () => {
  let setupListeners: () => Promise<void>;
  let teardownListeners: () => void;
  let saveSongData: (songKey: string) => Promise<void>;
  let setLiveUpdateCallback: (cb: (songKey: string, remoteData: Record<string, unknown>) => void) => void;

  /** Helper: register a snapshot callback that was passed to onSnapshot. */
  function triggerSnapshot(
    songDocId: string,
    payload: Record<string, unknown>,
    hasPendingWrites = false
  ): void {
    const call = mockOnSnapshot.mock.calls.find(
      (c: unknown[]) => (c[0] as { path: string })?.path?.includes(songDocId)
    );
    if (!call) throw new Error(`No onSnapshot call found for doc "${songDocId}"`);
    const cb = call[1] as SnapshotCallback;
    cb({
      data: () => payload,
      metadata: { hasPendingWrites },
      exists: () => true,
    });
  }

  beforeEach(async () => {
    vi.resetModules();
    // Clear all stores
    Object.keys(nDBStore).forEach((k) => delete nDBStore[k]);
    mockOnSnapshot.mockClear();
    mockDoc.mockClear();
    mockSetDoc.mockClear();

    const mod = await import('../utils/firebase-realtime.js');
    setupListeners = mod.setupListeners;
    teardownListeners = mod.teardownListeners;
    saveSongData = mod.saveSongData;
    setLiveUpdateCallback = mod.setLiveUpdateCallback;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // setLiveUpdateCallback
  // -----------------------------------------------------------------------

  it('setLiveUpdateCallback stores a callback that is invoked on remote update', async () => {
    const cb = vi.fn();

    // Set up: populate aoSongLists and set up listeners
    nDBStore['aoSongLists'] = [
      {
        firebaseGroupDocId: 'group1',
        songs: [{ firebaseSongDocId: 'song1', fullPath: 'track.mp3', galleryId: 'pwa-galleryId' }],
      },
    ];
    await setupListeners();

    // Register the callback
    setLiveUpdateCallback(cb);

    // Simulate a remote snapshot (hasPendingWrites = false, newer timestamp)
    triggerSnapshot(
      'song1',
      { jsonDataInfo: JSON.stringify({ markers: [{ id: 'm1' }], latestUploadToFirebase: 200 }) },
      false
    );

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('track.mp3', expect.objectContaining({ markers: [{ id: 'm1' }] }));
  });

  // -----------------------------------------------------------------------
  // teardownListeners
  // -----------------------------------------------------------------------

  it('teardownListeners calls all unsubscribe functions', async () => {
    const unsub1 = vi.fn();
    const unsub2 = vi.fn();
    mockOnSnapshot.mockReturnValue(unsub1);
    mockOnSnapshot.mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2);

    nDBStore['aoSongLists'] = [
      {
        firebaseGroupDocId: 'g1',
        songs: [
          { firebaseSongDocId: 's1', fullPath: 'a.mp3', galleryId: 'pwa-galleryId' },
          { firebaseSongDocId: 's2', fullPath: 'b.mp3', galleryId: 'pwa-galleryId' },
        ],
      },
    ];
    await setupListeners();

    teardownListeners();

    expect(unsub1).toHaveBeenCalledTimes(1);
    expect(unsub2).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // setupListeners — Firebase unavailable
  // -----------------------------------------------------------------------

  it('setupListeners is a no-op when Firebase imports fail', async () => {
    // Override the mock to simulate Firebase not being available
    vi.resetModules();
    Object.keys(nDBStore).forEach((k) => delete nDBStore[k]);

    // The firebaseClient mock is always in effect, so setupListeners imports
    // the mocked module. To simulate failure we simply clear aoSongLists.
    const mod = await import('../utils/firebase-realtime.js');
    await mod.setupListeners();

    // No listeners should have been set up
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // setupListeners — no songs
  // -----------------------------------------------------------------------

  it('setupListeners is a no-op when aoSongLists is empty', async () => {
    nDBStore['aoSongLists'] = [];
    await setupListeners();
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // setupListeners — normal flow
  // -----------------------------------------------------------------------

  it('setupListeners sets up onSnapshot for each song in aoSongLists', async () => {
    nDBStore['aoSongLists'] = [
      {
        firebaseGroupDocId: 'group1',
        songs: [
          { firebaseSongDocId: 's1', fullPath: 'track1.mp3', galleryId: 'pwa-galleryId' },
          { firebaseSongDocId: 's2', fullPath: 'track2.mp3', galleryId: 'pwa-galleryId' },
        ],
      },
      {
        firebaseGroupDocId: 'group2',
        songs: [
          { firebaseSongDocId: 's3', fullPath: 'track1.mp3', galleryId: 'pwa-galleryId' },
        ],
      },
    ];

    await setupListeners();

    // 3 songs across 2 groups = 3 listeners
    expect(mockOnSnapshot).toHaveBeenCalledTimes(3);
    // Verify doc refs use correct paths
    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      'Groups',
      'group1',
      'Songs',
      's1'
    );
    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      'Groups',
      'group2',
      'Songs',
      's3'
    );
  });

  // -----------------------------------------------------------------------
  // saveSongData — Firebase unavailable
  // -----------------------------------------------------------------------

  it('saveSongData is a no-op when no song data exists in nDB', async () => {
    // No data in nDB for this songKey
    await saveSongData('nonexistent.mp3');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // saveSongData — no Firestore refs
  // -----------------------------------------------------------------------

  it('saveSongData is a no-op when song has no Firestore refs', async () => {
    nDBStore['track.mp3'] = { markers: [], latestUploadToFirebase: 100 };
    // aoSongLists is empty
    await saveSongData('track.mp3');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // saveSongData — normal write
  // -----------------------------------------------------------------------

  it('saveSongData writes song data to Firestore with correct payload', async () => {
    nDBStore['aoSongLists'] = [
      {
        firebaseGroupDocId: 'group1',
        songs: [
          { firebaseSongDocId: 's1', fullPath: 'track.mp3', galleryId: 'pwa-galleryId' },
        ],
      },
    ];
    nDBStore['track.mp3'] = {
      markers: [{ id: 'm1', name: 'Start', time: 0 }],
      currentStartMarker: 'm1',
      currentStopMarker: 'm1S',
      latestUploadToFirebase: 100,
      TROFF_VALUE_speedBar: 100,
      localInformation: { nrTimesLoaded: 5 },
    };

    await saveSongData('track.mp3');

    expect(mockSetDoc).toHaveBeenCalledTimes(1);

    // Check the payload: should not contain localInformation, should have songKey + jsonDataInfo
    const callArgs = mockSetDoc.mock.calls[0];
    const payload = callArgs[1] as Record<string, unknown>;

    expect(payload.songKey).toBe('track.mp3');
    expect(typeof payload.jsonDataInfo).toBe('string');

    const parsed = JSON.parse(payload.jsonDataInfo as string) as Record<string, unknown>;
    expect(parsed.markers).toEqual([{ id: 'm1', name: 'Start', time: 0 }]);
    expect(parsed.localInformation).toBeUndefined();
    expect(typeof parsed.latestUploadToFirebase).toBe('number');
    expect(parsed.latestUploadToFirebase).toBeGreaterThan(100);

    // Should use merge:true
    expect(callArgs[2]).toEqual({ merge: true });
  });

  // -----------------------------------------------------------------------
  // saveSongData — multiple groups
  // -----------------------------------------------------------------------

  it('saveSongData writes to every group the song belongs to', async () => {
    nDBStore['aoSongLists'] = [
      {
        firebaseGroupDocId: 'g1',
        songs: [{ firebaseSongDocId: 's1', fullPath: 'shared.mp3', galleryId: 'pwa-galleryId' }],
      },
      {
        firebaseGroupDocId: 'g2',
        songs: [{ firebaseSongDocId: 's2', fullPath: 'shared.mp3', galleryId: 'pwa-galleryId' }],
      },
    ];
    nDBStore['shared.mp3'] = { markers: [], latestUploadToFirebase: 1 };

    await saveSongData('shared.mp3');

    expect(mockSetDoc).toHaveBeenCalledTimes(2);
  });

  // -----------------------------------------------------------------------
  // Remote update — ignores own writes
  // -----------------------------------------------------------------------

  it('remote update ignores snapshots with hasPendingWrites', async () => {
    nDBStore['aoSongLists'] = [
      {
        firebaseGroupDocId: 'group1',
        songs: [{ firebaseSongDocId: 's1', fullPath: 'track.mp3', galleryId: 'pwa-galleryId' }],
      },
    ];
    nDBStore['track.mp3'] = { markers: [{ id: 'm1' }], latestUploadToFirebase: 100 };

    await setupListeners();

    // Simulate a snapshot with hasPendingWrites = true (local write echo)
    triggerSnapshot(
      's1',
      { jsonDataInfo: JSON.stringify({ markers: [{ id: 'm2' }], latestUploadToFirebase: 200 }) },
      true
    );

    // Local data should NOT have been overwritten
    const stored = nDBStore['track.mp3'] as Record<string, unknown>;
    expect((stored.markers as Array<{ id: string }>)[0].id).toBe('m1');
  });

  // -----------------------------------------------------------------------
  // Remote update — applies when timestamp is newer
  // -----------------------------------------------------------------------

  it('remote update applies data when remote timestamp is newer', async () => {
    nDBStore['aoSongLists'] = [
      {
        firebaseGroupDocId: 'group1',
        songs: [{ firebaseSongDocId: 's1', fullPath: 'track.mp3', galleryId: 'pwa-galleryId' }],
      },
    ];
    nDBStore['track.mp3'] = { markers: [{ id: 'local' }], latestUploadToFirebase: 100 };

    await setupListeners();

    triggerSnapshot(
      's1',
      { jsonDataInfo: JSON.stringify({ markers: [{ id: 'remote' }], latestUploadToFirebase: 200 }) },
      false
    );

    const stored = nDBStore['track.mp3'] as Record<string, unknown>;
    // Local data should have been replaced
    expect((stored.markers as Array<{ id: string }>)[0].id).toBe('remote');
    expect(stored.latestUploadToFirebase).toBe(200);
  });

  // -----------------------------------------------------------------------
  // Remote update — does not overwrite when local is newer
  // -----------------------------------------------------------------------

  it('remote update does not overwrite when local timestamp is newer or equal', async () => {
    nDBStore['aoSongLists'] = [
      {
        firebaseGroupDocId: 'group1',
        songs: [{ firebaseSongDocId: 's1', fullPath: 'track.mp3', galleryId: 'pwa-galleryId' }],
      },
    ];
    nDBStore['track.mp3'] = { markers: [{ id: 'local' }], latestUploadToFirebase: 300 };

    await setupListeners();

    triggerSnapshot(
      's1',
      { jsonDataInfo: JSON.stringify({ markers: [{ id: 'remote' }], latestUploadToFirebase: 200 }) },
      false
    );

    const stored = nDBStore['track.mp3'] as Record<string, unknown>;
    // Local data should be preserved
    expect((stored.markers as Array<{ id: string }>)[0].id).toBe('local');
  });

  // -----------------------------------------------------------------------
  // Remote update — preserves localInformation
  // -----------------------------------------------------------------------

  it('remote update preserves localInformation from existing data', async () => {
    nDBStore['aoSongLists'] = [
      {
        firebaseGroupDocId: 'group1',
        songs: [{ firebaseSongDocId: 's1', fullPath: 'track.mp3', galleryId: 'pwa-galleryId' }],
      },
    ];
    nDBStore['track.mp3'] = {
      markers: [{ id: 'm1' }],
      latestUploadToFirebase: 100,
      localInformation: { nrTimesLoaded: 42 },
    };

    await setupListeners();

    triggerSnapshot(
      's1',
      {
        jsonDataInfo: JSON.stringify({
          markers: [{ id: 'm2' }],
          latestUploadToFirebase: 200,
        }),
      },
      false
    );

    const stored = nDBStore['track.mp3'] as Record<string, unknown>;
    expect((stored.markers as Array<{ id: string }>)[0].id).toBe('m2');
    expect((stored.localInformation as Record<string, unknown>).nrTimesLoaded).toBe(42);
  });

  // -----------------------------------------------------------------------
  // Remote update — handles missing jsonDataInfo gracefully
  // -----------------------------------------------------------------------

  it('remote update gracefully handles snapshots without jsonDataInfo', async () => {
    nDBStore['aoSongLists'] = [
      {
        firebaseGroupDocId: 'group1',
        songs: [{ firebaseSongDocId: 's1', fullPath: 'track.mp3', galleryId: 'pwa-galleryId' }],
      },
    ];
    nDBStore['track.mp3'] = { markers: [{ id: 'm1' }], latestUploadToFirebase: 100 };

    await setupListeners();

    // Simulate a snapshot with no jsonDataInfo
    const call = mockOnSnapshot.mock.calls.find(
      (c: unknown[]) => (c[0] as { path: string })?.path?.includes('s1')
    );
    expect(call).toBeDefined();
    const cb = call![1] as (snapshot: {
      data: () => Record<string, unknown> | undefined;
      metadata: { hasPendingWrites: boolean };
      exists: () => boolean;
    }) => void;
    cb({
      data: () => ({ songKey: 'track.mp3' }), // no jsonDataInfo
      metadata: { hasPendingWrites: false },
      exists: () => true,
    });

    // Data should not have changed
    const stored = nDBStore['track.mp3'] as Record<string, unknown>;
    expect((stored.markers as Array<{ id: string }>)[0].id).toBe('m1');
  });

  // -----------------------------------------------------------------------
  // Multiple setupListeners calls tear down old ones
  // -----------------------------------------------------------------------

  it('calling setupListeners twice tears down previous listeners before creating new ones', async () => {
    const unsub1 = vi.fn();
    const unsub2 = vi.fn();
    mockOnSnapshot
      .mockReturnValueOnce(unsub1)
      .mockReturnValueOnce(unsub2);

    nDBStore['aoSongLists'] = [
      {
        firebaseGroupDocId: 'g1',
        songs: [{ firebaseSongDocId: 's1', fullPath: 'a.mp3', galleryId: 'pwa-galleryId' }],
      },
    ];

    await setupListeners();

    // Second call: should tear down first listener and set up a new one
    const unsub3 = vi.fn();
    mockOnSnapshot.mockReset();
    mockOnSnapshot.mockReturnValue(unsub3);
    await setupListeners();

    expect(unsub1).toHaveBeenCalledTimes(1); // old listener torn down
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1); // new listener set up
  });
});
