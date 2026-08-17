import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock nDB, firebaseClient, caches and crypto before importing upload-song.js
// (mirrors the tests/firebase-group-song-sync.test.ts pattern).
// ---------------------------------------------------------------------------

const nDBStore: Record<string, unknown> = {};
const uploadMocks = { setOnSong: vi.fn() };

vi.mock('../assets/internal/db.js', () => ({
  nDB: {
    get: vi.fn((key: string) => nDBStore[key]),
    set: vi.fn(),
    setOnSong: uploadMocks.setOnSong,
  },
}));

const firebaseMocks = {
  ref: vi.fn(),
  getDownloadURL: vi.fn(),
  uploadBytesResumable: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
};

vi.mock('../services/firebaseClient.js', () => ({
  db: {},
  storage: {},
  ref: firebaseMocks.ref,
  getDownloadURL: firebaseMocks.getDownloadURL,
  uploadBytesResumable: firebaseMocks.uploadBytesResumable,
  doc: firebaseMocks.doc,
  setDoc: firebaseMocks.setDoc,
}));

const mockCache: Record<string, Response> = {};
const cachesMock = {
  match: vi.fn(async (key: string) => mockCache[key] ?? undefined),
};
vi.stubGlobal('caches', cachesMock);

const FILE_URL =
  'https://firebasestorage.googleapis.com/v0/b/bucket.appspot.com/o/TroffFiles%2Fabc?alt=media';

type UploadResult = { id: number; fileUrl: string; fileName: string } | null;

describe('utils/upload-song.js', () => {
  let crc32Hash: (r: string) => number;
  let buildShareUrl: (serverId: string | number, fileName: string) => string;
  let uploadSongToServer: (
    songKey: string,
    onProgress?: (percent: number) => void
  ) => Promise<UploadResult>;

  beforeEach(async () => {
    vi.resetModules();
    Object.keys(nDBStore).forEach((k) => delete nDBStore[k]);
    Object.keys(mockCache).forEach((k) => delete mockCache[k]);
    uploadMocks.setOnSong.mockClear();
    firebaseMocks.ref.mockClear();
    firebaseMocks.getDownloadURL.mockClear();
    firebaseMocks.uploadBytesResumable.mockClear();
    firebaseMocks.doc.mockClear();
    firebaseMocks.setDoc.mockClear();
    cachesMock.match.mockClear();

    firebaseMocks.ref.mockImplementation((_storage: unknown, path: string) => ({ path }));
    // Fake resumable-upload task shaped for the NEW upload code:
    //   const task = uploadBytesResumable(fileRef, file);
    //   task.on('state_changed', handler);
    //   await task;
    // The task must be returned synchronously (mockReturnValue): the NEW code
    // calls uploadBytesResumable(...) WITHOUT awaiting it, so a mockResolvedValue
    // promise wrapper would lack .on. A plain object works for the OLD code shape
    // too, because `await` on a non-thenable resolves to the object itself.
    firebaseMocks.uploadBytesResumable.mockReturnValue({ ref: {}, on: vi.fn() });
    firebaseMocks.doc.mockImplementation(
      (_db: unknown, collection: string, id: string) => ({ path: collection + '/' + id })
    );
    firebaseMocks.setDoc.mockResolvedValue(undefined);

    // Deterministic file hash (implementation detail): 32 bytes of 0xAB.
    // The concrete hex value is irrelevant for the assertions below — only
    // that hashing is stable across the upload flow.
    const cryptoDigest = vi.fn(async () => new Uint8Array(32).fill(0xab).buffer);
    if (globalThis.crypto) {
      Object.defineProperty(globalThis.crypto, 'subtle', {
        configurable: true,
        value: { digest: cryptoDigest },
      });
    } else {
      vi.stubGlobal('crypto', { subtle: { digest: cryptoDigest } });
    }

    const mod = await import('../utils/upload-song.js');
    crc32Hash = mod.crc32Hash;
    buildShareUrl = mod.buildShareUrl;
    uploadSongToServer = mod.uploadSongToServer;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('crc32Hash', () => {
    it('returns 0 for the empty string', () => {
      expect(crc32Hash('')).toBe(0);
    });

    it('matches the standard CRC-32 value for "abc"', () => {
      expect(crc32Hash('abc')).toBe(0x352441c2);
    });
  });

  describe('buildShareUrl', () => {
    it('builds origin#serverId&encodedFileName', () => {
      expect(buildShareUrl(123, 'my song.mp3')).toBe(
        window.location.origin + '#123&' + encodeURI('my song.mp3')
      );
    });
  });

  describe('uploadSongToServer', () => {
    it('returns null when the song is not in nDB', async () => {
      const result = await uploadSongToServer('track.mp3');

      expect(result).toBeNull();
      expect(cachesMock.match).not.toHaveBeenCalled();
      expect(firebaseMocks.uploadBytesResumable).not.toHaveBeenCalled();
      expect(firebaseMocks.setDoc).not.toHaveBeenCalled();
    });

    it('returns null when the song file is not in the cache', async () => {
      nDBStore['track.mp3'] = { markers: [{ id: 'm1' }] };

      const result = await uploadSongToServer('track.mp3');

      expect(result).toBeNull();
      expect(cachesMock.match).toHaveBeenCalledWith('track.mp3');
      expect(firebaseMocks.uploadBytesResumable).not.toHaveBeenCalled();
      expect(firebaseMocks.setDoc).not.toHaveBeenCalled();
    });

    it('uploads the file, strips local info, writes TroffData and returns id/fileUrl/fileName', async () => {
      nDBStore['track.mp3'] = {
        markers: [{ id: 'm1', time: 1.5 }],
        localInformation: { playCount: 7 },
        fileData: { duration: 120 },
      };
      mockCache['track.mp3'] = new Response('fake-audio-bytes');

      // First getDownloadURL is the "does it already exist?" check (throws),
      // the second is the download URL of the freshly uploaded file.
      firebaseMocks.getDownloadURL
        .mockRejectedValueOnce(new Error('storage/object-not-found'))
        .mockResolvedValueOnce(FILE_URL);

      const result = await uploadSongToServer('track.mp3');

      // 1) File uploaded to TroffFiles/{fileHash}
      expect(firebaseMocks.ref).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringMatching(/^TroffFiles\//)
      );
      expect(firebaseMocks.uploadBytesResumable).toHaveBeenCalledTimes(1);
      const [, uploadedFile] = firebaseMocks.uploadBytesResumable.mock.calls[0];
      expect(uploadedFile).toBeInstanceOf(File);
      expect(uploadedFile.name).toBe('track.mp3');
      expect(firebaseMocks.getDownloadURL).toHaveBeenCalledTimes(2);

      // 2) TroffData written to Firestore under TroffData/{crc32 of troffData}
      expect(firebaseMocks.setDoc).toHaveBeenCalledTimes(1);
      const [docRef, troffData] = firebaseMocks.setDoc.mock.calls[0];

      // The id is computed from the troffData payload (before `id` was added),
      // so recompute it on the object without the id field.
      const { id: _writtenId, ...troffDataWithoutId } = troffData;
      const expectedId = crc32Hash(JSON.stringify(troffDataWithoutId));

      expect(firebaseMocks.doc).toHaveBeenCalledWith(
        expect.anything(),
        'TroffData',
        String(expectedId)
      );
      expect(docRef.path).toBe('TroffData/' + String(expectedId));

      expect(troffData.troffDataPublic).toBe(true);
      expect(typeof troffData.troffDataUploadedMillis).toBe('number');
      expect(troffData.fileName).toBe('track.mp3');
      expect(troffData.fileUrl).toBe(FILE_URL);

      // localInformation must be stripped before sending to the server
      const markerJson = JSON.parse(troffData.markerJsonString);
      expect(markerJson.markers).toEqual([{ id: 'm1', time: 1.5 }]);
      expect(markerJson.localInformation).toBeUndefined();

      // 3) nDB updated with serverId and fileUrl
      expect(uploadMocks.setOnSong).toHaveBeenCalledWith('track.mp3', 'serverId', expectedId);
      expect(uploadMocks.setOnSong).toHaveBeenCalledWith('track.mp3', 'fileUrl', FILE_URL);

      // 4) Return value
      expect(result).toEqual({
        id: expectedId,
        fileUrl: FILE_URL,
        fileName: 'track.mp3',
      });
    });

    it('calls onProgress with upload percentages during upload', async () => {
      nDBStore['track.mp3'] = {
        markers: [{ id: 'm1', time: 1.5 }],
        localInformation: { playCount: 7 },
      };
      mockCache['track.mp3'] = new Response('fake-audio-bytes');

      // First getDownloadURL is the "does it already exist?" check (throws),
      // the second is the download URL of the freshly uploaded file.
      firebaseMocks.getDownloadURL
        .mockRejectedValueOnce(new Error('storage/object-not-found'))
        .mockResolvedValueOnce(FILE_URL);

      const fakeTask = { ref: {}, on: vi.fn() };
      firebaseMocks.uploadBytesResumable.mockReturnValue(fakeTask);

      const onProgress = vi.fn();
      const uploadPromise = uploadSongToServer('track.mp3', onProgress);

      // Wait until the upload branch registered its state_changed listener.
      // On the current implementation no listener is ever registered, so the
      // poll simply expires and the onProgress assertions below produce the
      // RED failure.
      type UploadSnapshot = { bytesTransferred: number; totalBytes: number };
      let stateChangedHandler: ((snapshot: UploadSnapshot) => void) | undefined;
      const deadline = Date.now() + 500;
      while (!stateChangedHandler && Date.now() < deadline) {
        const call = fakeTask.on.mock.calls.find((args) => args[0] === 'state_changed');
        if (call) stateChangedHandler = call[1] as (snapshot: UploadSnapshot) => void;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Fire state_changed snapshots mirroring the v1 pattern in
      // services/file.ts (progress = bytesTransferred / totalBytes * 100).
      stateChangedHandler?.({ bytesTransferred: 25, totalBytes: 100 });
      stateChangedHandler?.({ bytesTransferred: 100, totalBytes: 100 });

      const result = await uploadPromise;

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenNthCalledWith(1, 25);
      expect(onProgress).toHaveBeenNthCalledWith(2, 100);
      expect(result?.fileUrl).toBe(FILE_URL);
    });

    it('does not call onProgress when the file already exists on the server', async () => {
      nDBStore['track.mp3'] = { markers: [{ id: 'm1' }] };
      mockCache['track.mp3'] = new Response('fake-audio-bytes');
      firebaseMocks.getDownloadURL.mockResolvedValue(FILE_URL);

      const fakeTask = { ref: {}, on: vi.fn() };
      firebaseMocks.uploadBytesResumable.mockReturnValue(fakeTask);

      const onProgress = vi.fn();
      const result = await uploadSongToServer('track.mp3', onProgress);

      expect(onProgress).not.toHaveBeenCalled();
      expect(firebaseMocks.uploadBytesResumable).not.toHaveBeenCalled();
      expect(fakeTask.on).not.toHaveBeenCalled();
      expect(result?.fileUrl).toBe(FILE_URL);
    });
  });
});