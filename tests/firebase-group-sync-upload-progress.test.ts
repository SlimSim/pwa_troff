import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TroffFirebaseGroupIdentifyer } from '../types/troff.d.js';

// ---------------------------------------------------------------------------
// Mock nDB, log, caches and firebaseClient before importing the module under
// test (mirrors tests/firebase-group-song-sync.test.ts), but with a resumable
// upload task that exposes .on so the progress plumbing can be observed
// (mirrors tests/upload-song.test.ts).
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

type UploadSnapshot = { bytesTransferred: number; totalBytes: number };
type FakeUploadTask = { ref: object; on: ReturnType<typeof vi.fn> };

const mockCollection = vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') }));
const mockDoc = vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') }));
const mockAddDoc = vi.fn(async (_ref: unknown, _payload: unknown) => ({ id: 'songDoc123' }));
const mockSetDoc = vi.fn(async () => {});
const mockDeleteDoc = vi.fn(async () => {});
const mockRef = vi.fn((_storage: unknown, path: string) => ({ path }));
const mockDeleteObject = vi.fn(async () => {});
const mockUploadBytesResumable = vi.fn();
const mockGetDownloadURL = vi.fn(
  async () => 'https://firebasestorage.googleapis.com/v0/b/bucket.appspot.com/o/Groups%2Fg1%2Ftrack.mp3?alt=media'
);

vi.mock('../services/firebaseClient.js', () => ({
  db: {},
  storage: {},
  collection: mockCollection,
  doc: mockDoc,
  addDoc: mockAddDoc,
  setDoc: mockSetDoc,
  deleteDoc: mockDeleteDoc,
  ref: mockRef,
  deleteObject: mockDeleteObject,
  uploadBytesResumable: mockUploadBytesResumable,
  getDownloadURL: mockGetDownloadURL,
}));

describe('shareSongToFirebaseGroup onProgress (upload progress)', () => {
  // The feature spec adds an optional third `onProgress` parameter. Declared
  // here so the test typechecks against the CURRENT two-parameter signature;
  // after the feature lands the real signature is assignable to this type.
  type ShareSongWithProgress = (
    group: TroffFirebaseGroupIdentifyer,
    songKey: string,
    onProgress?: (percent: number) => void
  ) => Promise<string | undefined>;
  let shareSongToFirebaseGroup: ShareSongWithProgress;

  beforeEach(async () => {
    vi.resetModules();
    Object.keys(nDBStore).forEach((k) => delete nDBStore[k]);
    Object.keys(mockCache).forEach((k) => delete mockCache[k]);
    mockCollection.mockClear();
    mockDoc.mockClear();
    mockAddDoc.mockClear();
    mockSetDoc.mockClear();
    mockDeleteDoc.mockClear();
    mockRef.mockClear();
    mockDeleteObject.mockClear();
    mockUploadBytesResumable.mockReset();
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

  it('calls onProgress with floor((bytesTransferred / totalBytes) * 100) from state_changed snapshots', async () => {
    const group = {
      firebaseGroupDocId: 'g1',
      name: 'G1',
      songs: [{ fullPath: 'track.mp3', galleryId: 'pwa-galleryId' }],
    };
    nDBStore['aoSongLists'] = [group];
    nDBStore['track.mp3'] = { markers: [], latestUploadToFirebase: 100 };
    mockCache['track.mp3'] = new Response('audio data');

    // Resumable-upload task shaped for the NEW upload code:
    //   const task = uploadBytesResumable(storageRef, file);
    //   task.on('state_changed', handler);
    //   await task;
    // A plain (non-thenable) object also works for the OLD code shape, because
    // `await` on a non-thenable resolves to the object itself — only the
    // missing `.on(...)` registration differs.
    const fakeTask: FakeUploadTask = { ref: {}, on: vi.fn() };
    mockUploadBytesResumable.mockReturnValue(fakeTask);

    const onProgress = vi.fn();
    const sharePromise = shareSongToFirebaseGroup(group, 'track.mp3', onProgress);

    // Wait until the share code registers its state_changed listener. On the
    // current implementation no listener is ever registered, so the poll
    // expires and the onProgress assertions below produce the RED failure.
    let stateChangedHandler: ((snapshot: UploadSnapshot) => void) | undefined;
    const deadline = Date.now() + 500;
    while (!stateChangedHandler && Date.now() < deadline) {
      const call = fakeTask.on.mock.calls.find((args) => args[0] === 'state_changed');
      if (call) stateChangedHandler = call[1] as (snapshot: UploadSnapshot) => void;
      if (!stateChangedHandler) await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Fire state_changed snapshots; progress = floor(bytes / total * 100),
    // mirroring utils/upload-song.ts.
    stateChangedHandler?.({ bytesTransferred: 42, totalBytes: 100 });
    stateChangedHandler?.({ bytesTransferred: 100, totalBytes: 300 }); // floor(33.33…) = 33

    const result = await sharePromise;

    expect(result).toBe('songDoc123');
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, 42);
    expect(onProgress).toHaveBeenNthCalledWith(2, 33);
  });
});
