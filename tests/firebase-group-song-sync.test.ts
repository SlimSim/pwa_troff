import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fileUrlToStorageFileName } from '../utils/utils.js';
import type { TroffFirebaseGroupIdentifyer, TroffFirebaseSongIdentifyer } from '../types/troff.d.js';

// ---------------------------------------------------------------------------
// Mock nDB, log, caches and fetch before importing the module under test.
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

const mockCache: Record<string, Response> = {};
const mockCacheInstance = {
  match: vi.fn(async (key: string) => mockCache[key] ?? null),
  put: vi.fn(async (key: string, _response: Response) => {
    mockCache[key] = _response;
  }),
};
const cachesMock = {
  open: vi.fn(async (_name: string) => mockCacheInstance),
};
vi.stubGlobal('caches', cachesMock);

// ---------------------------------------------------------------------------
// Mock firebaseClient with the exports the new functions need.
// ---------------------------------------------------------------------------

const mockCollection = vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') }));
const mockDoc = vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') }));
const mockAddDoc = vi.fn(async (_ref: unknown, _payload: unknown) => ({ id: 'songDoc123' }));
const mockDeleteDoc = vi.fn(async () => {});
const mockRef = vi.fn((_storage: unknown, path: string) => ({ path }));
const mockDeleteObject = vi.fn(async () => {});
const mockUploadBytesResumable = vi.fn(async () => ({ ref: {} }));
const mockGetDownloadURL = vi.fn(
  async () => 'https://firebasestorage.googleapis.com/v0/b/bucket.appspot.com/o/Groups%2Fg1%2Ftrack.mp3?alt=media'
);

vi.mock('../services/firebaseClient.js', () => ({
  db: {},
  storage: {},
  collection: mockCollection,
  doc: mockDoc,
  addDoc: mockAddDoc,
  deleteDoc: mockDeleteDoc,
  ref: mockRef,
  deleteObject: mockDeleteObject,
  uploadBytesResumable: mockUploadBytesResumable,
  getDownloadURL: mockGetDownloadURL,
}));

describe('shareSongToFirebaseGroup', () => {
  let shareSongToFirebaseGroup: (
    group: TroffFirebaseGroupIdentifyer,
    songKey: string
  ) => Promise<string | undefined>;

  beforeEach(async () => {
    vi.resetModules();
    Object.keys(nDBStore).forEach((k) => delete nDBStore[k]);
    Object.keys(mockCache).forEach((k) => delete mockCache[k]);
    mockCollection.mockClear();
    mockDoc.mockClear();
    mockAddDoc.mockClear();
    mockDeleteDoc.mockClear();
    mockRef.mockClear();
    mockDeleteObject.mockClear();
    mockUploadBytesResumable.mockClear();
    mockGetDownloadURL.mockClear();
    cachesMock.open.mockClear();
    mockCacheInstance.match.mockClear();

    // Default: online
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });

    const mod = await import('../utils/firebase-group-sync.js');
    shareSongToFirebaseGroup = mod.shareSongToFirebaseGroup;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // No-op scenarios
  // -----------------------------------------------------------------------

  it('is a no-op when the group has no firebaseGroupDocId', async () => {
    const group = { id: 1, name: 'Local Group', songs: [] };
    const result = await shareSongToFirebaseGroup(group, 'track.mp3');

    expect(result).toBeUndefined();
    expect(mockUploadBytesResumable).not.toHaveBeenCalled();
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('is a no-op when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    const group = { firebaseGroupDocId: 'g1', name: 'G1', songs: [] };
    nDBStore['track.mp3'] = { markers: [], latestUploadToFirebase: 100 };
    mockCache['track.mp3'] = new Response('audio');

    const result = await shareSongToFirebaseGroup(group, 'track.mp3');

    expect(result).toBeUndefined();
    expect(mockUploadBytesResumable).not.toHaveBeenCalled();
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('is a no-op when no local song data exists in nDB', async () => {
    const group = { firebaseGroupDocId: 'g1', name: 'G1', songs: [] };
    mockCache['track.mp3'] = new Response('audio');

    const result = await shareSongToFirebaseGroup(group, 'track.mp3');

    expect(result).toBeUndefined();
    expect(mockUploadBytesResumable).not.toHaveBeenCalled();
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('is a no-op when the audio file is not in the cache', async () => {
    const group = { firebaseGroupDocId: 'g1', name: 'G1', songs: [] };
    nDBStore['track.mp3'] = { markers: [], latestUploadToFirebase: 100 };

    const result = await shareSongToFirebaseGroup(group, 'track.mp3');

    expect(result).toBeUndefined();
    expect(mockUploadBytesResumable).not.toHaveBeenCalled();
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Success path
  // -----------------------------------------------------------------------

  it('uploads the file, creates a Songs subcollection doc and updates aoSongLists', async () => {
    const group = {
      firebaseGroupDocId: 'g1',
      name: 'G1',
      songs: [{ fullPath: 'track.mp3', galleryId: 'pwa-galleryId' }],
    };
    nDBStore['aoSongLists'] = [group];
    nDBStore['track.mp3'] = {
      markers: [{ id: 'm1', time: 10 }],
      latestUploadToFirebase: 100,
      localInformation: { nrTimesLoaded: 3 },
    };
    mockCache['track.mp3'] = new Response('audio data');

    const result = await shareSongToFirebaseGroup(group, 'font/track.mp3');

    // Returns the new doc id
    expect(result).toBe('songDoc123');

    // File uploaded to the correct storage path
    expect(mockRef).toHaveBeenCalledWith(expect.anything(), 'Groups/g1/track.mp3');
    expect(mockUploadBytesResumable).toHaveBeenCalledTimes(1);
    expect(mockGetDownloadURL).toHaveBeenCalledTimes(1);

    // Doc created in the Songs subcollection with the right payload
    expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'Groups', 'g1', 'Songs');
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const payload = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.songKey).toBe('track.mp3');
    expect(payload.fileUrl).toContain('Groups%2Fg1%2Ftrack.mp3');

    const parsed = JSON.parse(payload.jsonDataInfo as string) as Record<string, unknown>;
    expect(parsed.markers).toEqual([{ id: 'm1', time: 10 }]);
    expect(parsed.localInformation).toBeUndefined();
    expect(typeof parsed.latestUploadToFirebase).toBe('number');

    // Local aoSongLists entry updated with firebaseSongDocId + fileUrl
    const updatedGroup = (nDBStore['aoSongLists'] as Array<{ songs: Array<Record<string, unknown>> }>)[0];
    expect(updatedGroup.songs[0].firebaseSongDocId).toBe('songDoc123');
    expect(updatedGroup.songs[0].fileUrl).toContain('Groups%2Fg1%2Ftrack.mp3');
  });

  it('never rejects — returns undefined when Firebase throws', async () => {
    const group = {
      firebaseGroupDocId: 'g1',
      name: 'G1',
      songs: [{ fullPath: 'track.mp3', galleryId: 'pwa-galleryId' }],
    };
    nDBStore['aoSongLists'] = [group];
    nDBStore['track.mp3'] = { markers: [], latestUploadToFirebase: 100 };
    mockCache['track.mp3'] = new Response('audio');

    mockUploadBytesResumable.mockRejectedValueOnce(new Error('Upload failed'));

    const result = await shareSongToFirebaseGroup(group, 'track.mp3');
    expect(result).toBeUndefined();
  });
});

describe('removeSongFromFirebaseGroup', () => {
  let removeSongFromFirebaseGroup: (
    groupId: string,
    songEntry: TroffFirebaseSongIdentifyer
  ) => Promise<void>;

  beforeEach(async () => {
    vi.resetModules();
    Object.keys(nDBStore).forEach((k) => delete nDBStore[k]);
    mockCollection.mockClear();
    mockDoc.mockClear();
    mockDeleteDoc.mockClear();
    mockRef.mockClear();
    mockDeleteObject.mockClear();

    const mod = await import('../utils/firebase-group-sync.js');
    removeSongFromFirebaseGroup = mod.removeSongFromFirebaseGroup;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is a no-op when the song entry has no firebaseSongDocId', async () => {
    await removeSongFromFirebaseGroup('g1', { fullPath: 'track.mp3', galleryId: 'pwa-galleryId' });

    expect(mockDeleteDoc).not.toHaveBeenCalled();
    expect(mockDeleteObject).not.toHaveBeenCalled();
  });

  it('deletes the song document and the storage file when fileUrl is present', async () => {
    const songEntry = {
      firebaseSongDocId: 's1',
      fullPath: 'track.mp3',
      galleryId: 'pwa-galleryId',
      fileUrl:
        'https://firebasestorage.googleapis.com/v0/b/bucket.appspot.com/o/Groups%2Fg1%2Ftrack.mp3?alt=media',
    };

    await removeSongFromFirebaseGroup('g1', songEntry);

    // Doc deleted at the right path
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'Groups', 'g1', 'Songs', 's1');
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);

    // Storage file deleted at the right path (via real fileUrlToStorageFileName)
    const storageFileName = fileUrlToStorageFileName(
      'https://firebasestorage.googleapis.com/v0/b/bucket.appspot.com/o/Groups%2Fg1%2Ftrack.mp3?alt=media'
    );
    expect(storageFileName).toBe('track.mp3');
    expect(mockRef).toHaveBeenCalledWith(expect.anything(), 'Groups/g1/track.mp3');
    expect(mockDeleteObject).toHaveBeenCalledTimes(1);
  });

  it('deletes the doc but NOT the storage file when fileUrl is missing', async () => {
    const songEntry = {
      firebaseSongDocId: 's1',
      fullPath: 'track.mp3',
      galleryId: 'pwa-galleryId',
    };

    await removeSongFromFirebaseGroup('g1', songEntry);

    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockDeleteObject).not.toHaveBeenCalled();
  });
});
