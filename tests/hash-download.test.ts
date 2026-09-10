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

  it('returns null when fetch to file URL throws', async () => {
    vi.useFakeTimers();
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

    const promise = downloadSongFromHash('#1&fail.mp3');
    // Advance through retries: 1s + 2s + 4s = 7s
    await vi.advanceTimersByTimeAsync(7000);
    const result = await promise;
    expect(result).toBeNull();
    vi.useRealTimers();
  });

  it('returns null when fetch response is not ok after retries', async () => {
    vi.useFakeTimers();
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

    const promise = downloadSongFromHash('#2&fail.mp3');

    // Advance through all retries
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);

    const result = await promise;
    expect(result).toBeNull();
    // 1 initial + 3 retries = 4 calls
    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
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

  // Helper: set up nDB + Firestore mocks for a new song download that reaches fetchAndCacheFile
  function setupDownloadToFetchPoint(
    troffId: number,
    fileUrl: string,
    fileName: string
  ) {
    mockNdbGet.mockImplementation((key: string) => {
      if (key === fileName) return null;
      if (key === 'TROFF_TROFF_DATA_ID_AND_FILE_NAME') return [];
      return null;
    });
    mockNdbSet.mockResolvedValue(undefined);

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        fileName,
        fileUrl,
        fileSize: 0,
        fileType: 'audio/mpeg',
        id: troffId,
        markerJsonString: '{"markers":[],"fileData":{}}',
        troffDataPublic: true,
        troffDataUploadedMillis: Date.now(),
      }),
    });
  }

  // --------------- Retry logic (fetchAndCacheFile) ---------------

  describe('fetchAndCacheFile retry logic', () => {
    it('retries on non-ok response and succeeds on the second attempt', async () => {
      vi.useFakeTimers();
      setupDownloadToFetchPoint(10, 'https://example.com/retry1.mp3', 'retry1.mp3');

      const okResponse = new Response('data', { status: 200 });
      const failResponse = new Response('Server Error', { status: 500, statusText: 'Internal Server Error' });

      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce(failResponse).mockResolvedValueOnce(okResponse);

      const promise = downloadSongFromHash('#10&retry1.mp3');

      // Let the setTimeout resolve — first retry has 1000ms delay (2^0 * 1000)
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result).toBe('retry1.mp3');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('does not retry past maxRetries (3) and throws', async () => {
      vi.useFakeTimers();
      setupDownloadToFetchPoint(12, 'https://example.com/retry3.mp3', 'retry3.mp3');

      const failResponse = new Response('Server Error', { status: 500, statusText: 'Internal Server Error' });
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      // Always fail: attempt 0, 1, 2, 3 = 4 calls total
      fetchMock.mockResolvedValue(failResponse);

      const promise = downloadSongFromHash('#12&retry3.mp3');

      // Advance through all retries: 1000ms + 2000ms + 4000ms
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      const result = await promise;
      expect(result).toBeNull();
      // 1 initial + 3 retries = 4 calls
      expect(fetchMock).toHaveBeenCalledTimes(4);
      vi.useRealTimers();
    });

    it('uses exponential backoff delays (1s, 2s, 4s)', async () => {
      vi.useFakeTimers();
      setupDownloadToFetchPoint(13, 'https://example.com/backoff.mp3', 'backoff.mp3');

      const failResponse = new Response('Error', { status: 503, statusText: 'Service Unavailable' });
      const okResponse = new Response('data', { status: 200 });
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce(failResponse)   // attempt 0 → retry after 1s
        .mockResolvedValueOnce(failResponse)            // attempt 1 → retry after 2s
        .mockResolvedValueOnce(failResponse)            // attempt 2 → retry after 4s
        .mockResolvedValueOnce(okResponse);             // attempt 3 → success

      const promise = downloadSongFromHash('#13&backoff.mp3');

      // Attempt 0 fails, timer for 1s (2^0 * 1000)
      await vi.advanceTimersByTimeAsync(1000);
      // Attempt 1 fails, timer for 2s (2^1 * 1000)
      await vi.advanceTimersByTimeAsync(2000);
      // Attempt 2 fails, timer for 4s (2^2 * 1000)
      await vi.advanceTimersByTimeAsync(4000);

      const result = await promise;
      expect(result).toBe('backoff.mp3');
      expect(fetchMock).toHaveBeenCalledTimes(4);
      vi.useRealTimers();
    });

    it('does not retry when the first attempt succeeds', async () => {
      setupDownloadToFetchPoint(14, 'https://example.com/first-ok.mp3', 'first-ok.mp3');

      const okResponse = new Response('data', { status: 200 });
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValue(okResponse);

      const result = await downloadSongFromHash('#14&first-ok.mp3');
      expect(result).toBe('first-ok.mp3');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('carries the HTTP status code on the thrown error after retries exhausted', async () => {
      vi.useFakeTimers();
      setupDownloadToFetchPoint(15, 'https://example.com/status.mp3', 'status.mp3');

      const failResponse = new Response('Not Found', { status: 404, statusText: 'Not Found' });
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValue(failResponse);

      const promise = downloadSongFromHash('#15&status.mp3');

      // Advance through all retries
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      const result = await promise;
      expect(result).toBeNull();
      // The error message in the alert should contain the status code info
      expect(window.alert).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  // --------------- 404 error handling ---------------

  describe('downloadSongFromHash 404 error handling', () => {
    it('shows "could not be found on the server" when fetch returns 404', async () => {
      vi.useFakeTimers();
      setupDownloadToFetchPoint(20, 'https://example.com/404-song.mp3', '404-song.mp3');

      const notFoundResponse = new Response('Not Found', { status: 404, statusText: 'Not Found' });
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValue(notFoundResponse);

      const promise = downloadSongFromHash('#20&404-song.mp3');

      // Advance through all retries
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      const result = await promise;
      expect(result).toBeNull();

      // The alert should mention the song not being found on the server
      const alertCalls = (window.alert as ReturnType<typeof vi.fn>).mock.calls;
      expect(alertCalls.length).toBeGreaterThan(0);
      const lastAlert = alertCalls[alertCalls.length - 1][0] as string;
      expect(lastAlert).toContain('could not be found on the server');
      vi.useRealTimers();
    });

    it('shows "temporary issue" for non-404 errors after retries exhausted', async () => {
      vi.useFakeTimers();
      setupDownloadToFetchPoint(21, 'https://example.com/server-error.mp3', 'server-error.mp3');

      const serverErrorResponse = new Response('Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      });
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValue(serverErrorResponse);

      const promise = downloadSongFromHash('#21&server-error.mp3');

      // Advance through all retries
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      const result = await promise;
      expect(result).toBeNull();

      // The alert should mention a temporary issue
      const alertCalls = (window.alert as ReturnType<typeof vi.fn>).mock.calls;
      expect(alertCalls.length).toBeGreaterThan(0);
      const lastAlert = alertCalls[alertCalls.length - 1][0] as string;
      expect(lastAlert).toContain('temporary issue');
      expect(lastAlert).not.toContain('could not be found on the server');
      vi.useRealTimers();
    });

    it('shows "temporary issue" for 503 errors', async () => {
      vi.useFakeTimers();
      setupDownloadToFetchPoint(22, 'https://example.com/unavailable.mp3', 'unavailable.mp3');

      const unavailableResponse = new Response('Service Unavailable', {
        status: 503,
        statusText: 'Service Unavailable',
      });
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValue(unavailableResponse);

      const promise = downloadSongFromHash('#22&unavailable.mp3');

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      const result = await promise;
      expect(result).toBeNull();

      const alertCalls = (window.alert as ReturnType<typeof vi.fn>).mock.calls;
      const lastAlert = alertCalls[alertCalls.length - 1][0] as string;
      expect(lastAlert).toContain('temporary issue');
      vi.useRealTimers();
    });

    it('shows generic network error when fetch itself throws', async () => {
      vi.useFakeTimers();
      setupDownloadToFetchPoint(23, 'https://example.com/network-error.mp3', 'network-error.mp3');

      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      // fetch throws a TypeError on network failure — no .status on TypeError, so status is 0
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      const promise = downloadSongFromHash('#23&network-error.mp3');
      // Advance through retries: 1s + 2s + 4s = 7s
      await vi.advanceTimersByTimeAsync(7000);
      const result = await promise;
      expect(result).toBeNull();

      // Network errors don't carry .status, so should show "temporary issue"
      const alertCalls = (window.alert as ReturnType<typeof vi.fn>).mock.calls;
      const lastAlert = alertCalls[alertCalls.length - 1][0] as string;
      expect(lastAlert).toContain('temporary issue');
      vi.useRealTimers();
    });

    it('returns null on error and does not proceed further', async () => {
      vi.useFakeTimers();
      setupDownloadToFetchPoint(24, 'https://example.com/returns-null.mp3', 'returns-null.mp3');

      const failResponse = new Response('Error', { status: 404 });
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValue(failResponse);

      const promise = downloadSongFromHash('#24&returns-null.mp3');

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      const result = await promise;
      expect(result).toBeNull();

      // Should not have cached anything
      expect(cacheStore.has('returns-null.mp3')).toBe(false);
      vi.useRealTimers();
    });
  });
});
