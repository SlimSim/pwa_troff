import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --------------- parseHash tests (pure function, no mocking needed) ---------------

describe('parseHash', () => {
  let parseHash: (hash: string) => { serverId: number; fileName: string } | null;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../utils/hash-download.js');
    parseHash = mod.parseHash;
  });

  it('returns null for empty string', () => {
    expect(parseHash('')).toBeNull();
  });

  it('returns null for string without hash prefix', () => {
    expect(parseHash('123&song.mp3')).toBeNull();
  });

  it('returns null for nullish input', () => {
    expect(parseHash(null as unknown as string)).toBeNull();
    expect(parseHash(undefined as unknown as string)).toBeNull();
  });

  it('parses a valid hash with server id and file name', () => {
    const result = parseHash('#123&my-song.mp3');
    expect(result).toEqual({ serverId: 123, fileName: 'my-song.mp3' });
  });

  it('parses hash with zero server id', () => {
    const result = parseHash('#0&track.wav');
    expect(result).toEqual({ serverId: 0, fileName: 'track.wav' });
  });

  it('returns null when server id is non-numeric', () => {
    expect(parseHash('#abc&song.mp3')).toBeNull();
  });

  it('returns null when file name is empty', () => {
    expect(parseHash('#123&')).toBeNull();
  });

  it('returns null when ampersand is missing', () => {
    expect(parseHash('#123song.mp3')).toBeNull();
  });

  it('decodes URI-encoded characters in file name', () => {
    const result = parseHash('#456&my%20song%20%231.mp3');
    expect(result).toEqual({ serverId: 456, fileName: 'my song #1.mp3' });
  });
});

// --------------- downloadSongFromHash tests (mocked dependencies) ---------------

describe('downloadSongFromHash', () => {
  let downloadSongFromHash: (hash: string) => Promise<string | null>;
  let mockNdbGet: ReturnType<typeof vi.fn>;
  let mockNdbSet: ReturnType<typeof vi.fn>;
  let mockGetDoc: ReturnType<typeof vi.fn>;
  let mockDoc: ReturnType<typeof vi.fn>;
  let mockDb: Record<string, never>;
  let cacheStore: Map<string, Response>;

  beforeEach(async () => {
    vi.resetModules();

    mockNdbGet = vi.fn();
    mockNdbSet = vi.fn();
    mockGetDoc = vi.fn();
    mockDoc = vi.fn((_db: unknown, _collection: string, _id: string) => ({ id: _id }));
    mockDb = {};

    // Mock nDB (assets/internal/db.js)
    vi.doMock('../assets/internal/db.js', () => ({
      nDB: {
        get: mockNdbGet,
        set: mockNdbSet,
        setOnSong: vi.fn(),
      },
    }));

    // Mock the Firebase getter — returns a controlled Firestore handle so we
    // never actually load the Firebase SDK from the CDN.
    vi.doMock('../utils/firebase-getter.js', () => ({
      getFirestore: vi.fn().mockResolvedValue({
        db: mockDb,
        doc: mockDoc,
        getDoc: mockGetDoc,
      }),
    }));

    // Mock constants — re‑export the real value for
    // TROFF_TROFF_DATA_ID_AND_FILE_NAME so the history logic works correctly.
    vi.doMock('../constants/constants.js', () => ({
      TROFF_TROFF_DATA_ID_AND_FILE_NAME: 'TROFF_TROFF_DATA_ID_AND_FILE_NAME',
    }));

    // Set up a fresh in‑memory cache store for testing
    cacheStore = new Map();
    const mockCache: Partial<Cache> = {
      put: vi.fn(async (request: RequestInfo | URL, response: Response) => {
        const key = typeof request === 'string' ? request : request.toString();
        cacheStore.set(key, response);
      }),
      match: vi.fn(async (request: RequestInfo | URL) => {
        const key = typeof request === 'string' ? request : request.toString();
        return cacheStore.get(key) || undefined;
      }),
    };
    const mockCaches: Partial<CacheStorage> = {
      open: vi.fn(async () => mockCache as Cache),
    };
    Object.defineProperty(globalThis, 'caches', {
      value: mockCaches,
      writable: true,
      configurable: true,
    });

    // Mock fetch globally
    globalThis.fetch = vi.fn();

    // Hide alerts during tests
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    const mod = await import('../utils/hash-download.js');
    downloadSongFromHash = mod.downloadSongFromHash;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns null when hash cannot be parsed', async () => {
    const result = await downloadSongFromHash('');
    expect(result).toBeNull();
    expect(mockNdbGet).not.toHaveBeenCalled();
  });

  it('returns file name immediately when song already exists in nDB', async () => {
    mockNdbGet.mockImplementation((key: string) => {
      if (key === 'my-song.mp3') return { fileData: { title: 'My Song' } };
      return null;
    });

    const result = await downloadSongFromHash('#123&my-song.mp3');
    expect(result).toBe('my-song.mp3');
    // Should not have attempted Firebase fetch
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('downloads and caches a song successfully', async () => {
    // nDB returns null for the song (first call for existing check)
    mockNdbGet.mockImplementation((key: string) => {
      if (key === 'song.mp3') return null;
      if (key === 'TROFF_TROFF_DATA_ID_AND_FILE_NAME') return [];
      return null;
    });
    mockNdbSet.mockResolvedValue(undefined);

    // Firestore returns TroffData
    const troffData = {
      fileName: 'song.mp3',
      fileUrl: 'https://example.com/song.mp3',
      fileSize: 12345,
      fileType: 'audio/mpeg',
      id: 456,
      markerJsonString: JSON.stringify({
        markers: [{ id: 'm1', time: 0 }],
        fileData: { title: 'Test Song', artist: 'Test Artist' },
        info: 'Test info',
      }),
      troffDataPublic: true,
      troffDataUploadedMillis: Date.now(),
    };
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => troffData,
    });

    // Mock fetch to return a successful response
    const fetchResponse = new Response('audio data', {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(fetchResponse);

    const result = await downloadSongFromHash('#456&song.mp3');
    expect(result).toBe('song.mp3');

    // Should have fetched from Firestore
    expect(mockDoc).toHaveBeenCalledWith(mockDb, 'TroffData', '456');
    expect(mockGetDoc).toHaveBeenCalledTimes(1);

    // Should have saved markers to nDB with serverId and fileUrl
    const ndbSetCall = mockNdbSet.mock.calls.find(
      (call: unknown[]) => call[0] === 'song.mp3'
    );
    expect(ndbSetCall).toBeDefined();
    const savedMarkers = ndbSetCall![1];
    expect(savedMarkers.serverId).toBe(456);
    expect(savedMarkers.fileUrl).toBe('https://example.com/song.mp3');

    // Should have cached the audio file
    expect(cacheStore.has('song.mp3')).toBe(true);

    // Should have saved download history
    const historySetCall = mockNdbSet.mock.calls.find(
      (call: unknown[]) => call[0] === 'TROFF_TROFF_DATA_ID_AND_FILE_NAME'
    );
    expect(historySetCall).toBeDefined();
    expect(historySetCall![1]).toHaveLength(1);
    expect(historySetCall![1][0].fileNameUri).toBe(encodeURI('song.mp3'));
  });

  it('returns null when Firestore document does not exist', async () => {
    mockNdbGet.mockReturnValue(null);
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    const result = await downloadSongFromHash('#789&missing.mp3');
    expect(result).toBeNull();
    expect(mockNdbSet).not.toHaveBeenCalled();
  });

  it('returns null when Firestore fetch throws', async () => {
    mockNdbGet.mockReturnValue(null);
    mockGetDoc.mockRejectedValue(new Error('Network error'));

    const result = await downloadSongFromHash('#999&broken.mp3');
    expect(result).toBeNull();
  });

  it('returns null when fetch to file URL fails', async () => {
    mockNdbGet.mockReturnValue(null);
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        fileName: 'fail.mp3',
        fileUrl: 'https://example.com/fail.mp3',
        fileSize: 0,
        fileType: 'audio/mpeg',
        id: 1,
        markerJsonString: '{"markers":[],"fileData":{}}',
        troffDataPublic: true,
        troffDataUploadedMillis: Date.now(),
      }),
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );

    const result = await downloadSongFromHash('#1&fail.mp3');
    expect(result).toBeNull();
  });

  it('returns null when fetch response is not ok', async () => {
    mockNdbGet.mockReturnValue(null);
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        fileName: 'fail.mp3',
        fileUrl: 'https://example.com/fail.mp3',
        fileSize: 0,
        fileType: 'audio/mpeg',
        id: 2,
        markerJsonString: '{"markers":[],"fileData":{}}',
        troffDataPublic: true,
        troffDataUploadedMillis: Date.now(),
      }),
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('Not Found', { status: 404 })
    );

    const result = await downloadSongFromHash('#2&fail.mp3');
    expect(result).toBeNull();
  });

  it('updates download history when song already has history entries', async () => {
    // Initial history has one entry for a different server/file
    mockNdbGet.mockImplementation((key: string) => {
      if (key === 'new-song.mp3') return null;
      if (key === 'TROFF_TROFF_DATA_ID_AND_FILE_NAME') {
        return [
          {
            fileNameUri: encodeURI('old-song.mp3'),
            troffDataIdObjectList: [{ troffDataId: 1, displayName: 'Old Song' }],
          },
        ];
      }
      return null;
    });
    mockNdbSet.mockResolvedValue(undefined);

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        fileName: 'new-song.mp3',
        fileUrl: 'https://example.com/new-song.mp3',
        fileSize: 0,
        fileType: 'audio/mpeg',
        id: 99,
        markerJsonString: '{"markers":[],"fileData":{}}',
        troffDataPublic: true,
        troffDataUploadedMillis: Date.now(),
      }),
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('data', { status: 200 })
    );

    const result = await downloadSongFromHash('#99&new-song.mp3');
    expect(result).toBe('new-song.mp3');

    // History should contain both the old entry and the new one
    const historyCall = mockNdbSet.mock.calls.find(
      (call: unknown[]) => call[0] === 'TROFF_TROFF_DATA_ID_AND_FILE_NAME'
    );
    expect(historyCall).toBeDefined();
    expect(historyCall![1]).toHaveLength(2);
  });

  it('does not duplicate history entry when same serverId already recorded', async () => {
    mockNdbGet.mockImplementation((key: string) => {
      if (key === 'existing.mp3') return null;
      if (key === 'TROFF_TROFF_DATA_ID_AND_FILE_NAME') {
        return [
          {
            fileNameUri: encodeURI('existing.mp3'),
            troffDataIdObjectList: [{ troffDataId: 55, displayName: 'Existing' }],
          },
        ];
      }
      return null;
    });
    mockNdbSet.mockResolvedValue(undefined);

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        fileName: 'existing.mp3',
        fileUrl: 'https://example.com/existing.mp3',
        fileSize: 0,
        fileType: 'audio/mpeg',
        id: 55, // same serverId as in history
        markerJsonString: '{"markers":[],"fileData":{}}',
        troffDataPublic: true,
        troffDataUploadedMillis: Date.now(),
      }),
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('data', { status: 200 })
    );

    const result = await downloadSongFromHash('#55&existing.mp3');
    expect(result).toBe('existing.mp3');

    // History should still have only one entry
    const historyCall = mockNdbSet.mock.calls.find(
      (call: unknown[]) => call[0] === 'TROFF_TROFF_DATA_ID_AND_FILE_NAME'
    );
    expect(historyCall).toBeDefined();
    expect(historyCall![1]).toHaveLength(1);
    expect(historyCall![1][0].troffDataIdObjectList).toHaveLength(1);
  });
});
