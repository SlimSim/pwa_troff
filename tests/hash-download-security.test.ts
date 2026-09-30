import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';

// ---------------------------------------------------------------------------
// Security / UX regression tests for v2 share links (utils/hash-download.js).
//
// Spec:
//  a) A v2 link must NOT download unless BOTH the hash (serverId) AND the
//     filename in the URL match the server record. Current code fetches by
//     serverId only and downloads even when the URL filename differs.
//  b) A link that does not exist on the server must NOT use window.alert().
//     Current code calls alert("could not find the song ...").
//     The fix should use better UX (toast / inline error UI) instead.
//
// These tests FAIL (RED) on current code and PASS (GREEN) after the fix.
// ---------------------------------------------------------------------------

describe('v2 share link: filename+hash must both match', () => {
  let downloadSongFromHash: (hash: string) => Promise<string | null>;
  let mockNdbGet: ReturnType<typeof vi.fn>;
  let mockNdbSet: ReturnType<typeof vi.fn>;
  let mockGetDoc: ReturnType<typeof vi.fn>;
  let mockDoc: ReturnType<typeof vi.fn>;
  let mockDb: Record<string, never>;
  let cacheStore: Map<string, Response>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    mockNdbGet = vi.fn();
    mockNdbSet = vi.fn();
    mockGetDoc = vi.fn();
    mockDoc = vi.fn((_db: unknown, _collection: string, _id: string) => ({ id: _id }));
    mockDb = {};

    vi.doMock('../assets/internal/db.js', () => ({
      nDB: {
        get: mockNdbGet,
        set: mockNdbSet,
        setOnSong: vi.fn(),
      },
    }));

    vi.doMock('../utils/firebase-getter.js', () => ({
      getFirestore: vi.fn().mockResolvedValue({
        db: mockDb,
        doc: mockDoc,
        getDoc: mockGetDoc,
      }),
      getStorageHandle: vi.fn().mockResolvedValue({
        getFreshDownloadUrl: vi.fn(async (url: string) => url),
      }),
    }));

    vi.doMock('../constants/constants.js', () => ({
      TROFF_TROFF_DATA_ID_AND_FILE_NAME: 'TROFF_TROFF_DATA_ID_AND_FILE_NAME',
    }));

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
    Object.defineProperty(globalThis, 'caches', {
      value: { open: vi.fn(async () => mockCache as Cache) },
      writable: true,
      configurable: true,
    });

    fetchMock = vi.fn(async () => new Response('audio data', { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    vi.spyOn(window, 'alert').mockImplementation(() => {});

    // Silence duplicate custom element definitions that happen when
    // multiple tests re-import modules that register components.
    // Without this guard, the second import throws:
    //   "the name "t-butt" has already been used with this registry"
    const registry = customElements;
    const originalDefine = registry.define.bind(registry);
    const patched = Object.create(registry);
    patched.define = (name: string, constructor: CustomElementConstructor, options?: ElementDefinitionOptions) => {
      if (!registry.get(name)) {
        originalDefine(name, constructor, options);
      }
    };
    vi.stubGlobal('customElements', patched);

    const mod = await import('../utils/hash-download.js');
    downloadSongFromHash = mod.downloadSongFromHash;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does NOT download when URL filename differs from server fileName (hash matches)', async () => {
    // Song not cached locally.
    mockNdbGet.mockImplementation((key: string) => {
      if (key === 'TROFF_TROFF_DATA_ID_AND_FILE_NAME') return [];
      return null;
    });
    mockNdbSet.mockResolvedValue(undefined);

    // Server record has id 456 and fileName 'real-song.mp3',
    // but the URL claims '#456&wrong-name.mp3'.
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        fileName: 'real-song.mp3',
        fileUrl: 'https://example.com/real-song.mp3',
        fileSize: 12345,
        fileType: 'audio/mpeg',
        id: 456,
        markerJsonString: JSON.stringify({
          markers: [],
          fileData: { title: 'Real Song' },
          info: '',
        }),
        troffDataPublic: true,
        troffDataUploadedMillis: Date.now(),
      }),
    });

    const result = await downloadSongFromHash('#456&wrong-name.mp3');

    // FIX contract: mismatched filename must reject — no download.
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockNdbSet).not.toHaveBeenCalled();
    expect(cacheStore.size).toBe(0);
  });
});

describe('v2 share link: missing song must NOT use window.alert', () => {
  let downloadSongFromHash: (hash: string) => Promise<string | null>;
  let fetchServerTroffData: (
    serverId: string | number,
    fileName: string
  ) => Promise<unknown | null>;
  let mockNdbGet: ReturnType<typeof vi.fn>;
  let mockNdbSet: ReturnType<typeof vi.fn>;
  let mockGetDoc: ReturnType<typeof vi.fn>;
  let mockDoc: ReturnType<typeof vi.fn>;
  let mockDb: Record<string, never>;
  let alertSpy: MockInstance;

  beforeEach(async () => {
    vi.resetModules();

    mockNdbGet = vi.fn().mockReturnValue(null);
    mockNdbSet = vi.fn();
    mockGetDoc = vi.fn();
    mockDoc = vi.fn((_db: unknown, _collection: string, _id: string) => ({ id: _id }));
    mockDb = {};

    vi.doMock('../assets/internal/db.js', () => ({
      nDB: {
        get: mockNdbGet,
        set: mockNdbSet,
        setOnSong: vi.fn(),
      },
    }));

    vi.doMock('../utils/firebase-getter.js', () => ({
      getFirestore: vi.fn().mockResolvedValue({
        db: mockDb,
        doc: mockDoc,
        getDoc: mockGetDoc,
      }),
      getStorageHandle: vi.fn().mockResolvedValue({
        getFreshDownloadUrl: vi.fn(async (url: string) => url),
      }),
    }));

    vi.doMock('../constants/constants.js', () => ({
      TROFF_TROFF_DATA_ID_AND_FILE_NAME: 'TROFF_TROFF_DATA_ID_AND_FILE_NAME',
    }));

    globalThis.fetch = vi.fn() as unknown as typeof fetch;

    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    // Silence duplicate custom element definitions that happen when
    // multiple tests re-import modules that register components.
    // Without this guard, the second import throws:
    //   "the name "t-butt" has already been used with this registry"
    const registry = customElements;
    const originalDefine = registry.define.bind(registry);
    const patched = Object.create(registry);
    patched.define = (name: string, constructor: CustomElementConstructor, options?: ElementDefinitionOptions) => {
      if (!registry.get(name)) {
        originalDefine(name, constructor, options);
      }
    };
    vi.stubGlobal('customElements', patched);

    const mod = await import('../utils/hash-download.js');
    downloadSongFromHash = mod.downloadSongFromHash;
    fetchServerTroffData = mod.fetchServerTroffData;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('downloadSongFromHash: nonexistent server doc returns null WITHOUT calling alert', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const result = await downloadSongFromHash('#789&missing.mp3');

    expect(result).toBeNull();
    // FIX contract: better UX than alert() (e.g. toast / inline error UI).
    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockNdbSet).not.toHaveBeenCalled();
  });

  it('fetchServerTroffData: nonexistent server doc returns null WITHOUT calling alert', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const result = await fetchServerTroffData(789, 'missing.mp3');

    expect(result).toBeNull();
    // FIX contract: better UX than alert() (e.g. toast / inline error UI).
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
