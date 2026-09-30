import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';

// ---------------------------------------------------------------------------
// Part 1 of "hash-link import prefetch + conditional loading + deferred errors"
// (utils/hash-download.ts):
//
//  - `fetchServerTroffDataResult(serverId, fileName)` fetches and parses the
//    server TroffData but NEVER shows UI itself (no toast, no alert). Errors
//    are returned as `{ ok:false, message, useAlert }` so the CALLER can
//    decide when/where to surface them (deferred errors).
//  - `fetchServerTroffData` becomes a thin wrapper that keeps TODAY's exact
//    behavior: toast for not-found / filename mismatch, alert for thrown
//    errors, `null` on failure. The wrapper tests below pin that behavior.
//
// Module-mocking pattern: tests/hash-download-security.test.ts (mocks db,
// firebase-getter, constants; spies on alert). notification.js is mocked here
// so showToast calls are observable.
//
// Every Result-function test asserts `typeof ... === 'function'` first so a
// missing export produces a meaningful RED instead of a bare TypeError.
// ---------------------------------------------------------------------------

type FetchFn = (serverId: string | number, fileName: string) => Promise<unknown>;

describe('fetchServerTroffDataResult (quiet fetch — no toast, no alert)', () => {
  let fetchServerTroffDataResult: FetchFn | undefined;
  let mockGetDoc: ReturnType<typeof vi.fn>;
  let mockDoc: ReturnType<typeof vi.fn>;
  let mockDb: Record<string, never>;
  let showToastMock: ReturnType<typeof vi.fn>;
  let alertSpy: MockInstance;

  beforeEach(async () => {
    vi.resetModules();

    mockGetDoc = vi.fn();
    mockDoc = vi.fn((_db: unknown, _collection: string, _id: string) => ({ id: _id }));
    mockDb = {};

    vi.doMock('../assets/internal/db.js', () => ({
      nDB: {
        get: vi.fn(),
        set: vi.fn(),
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

    // Make showToast observable (the quiet-fetch contract is "no toast").
    showToastMock = vi.fn();
    vi.doMock('../utils/notification.js', () => ({
      showToast: showToastMock,
      showLoading: vi.fn(),
      showDownloadProgress: vi.fn(),
      hideDownloadProgress: vi.fn(),
    }));

    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    // Silence duplicate custom element definitions that happen when
    // multiple tests re-import modules that register components.
    const registry = customElements;
    const originalDefine = registry.define.bind(registry);
    const patched = Object.create(registry);
    patched.define = (
      name: string,
      constructor: CustomElementConstructor,
      options?: ElementDefinitionOptions
    ) => {
      if (!registry.get(name)) {
        originalDefine(name, constructor, options);
      }
    };
    vi.stubGlobal('customElements', patched);

    const mod = await import('../utils/hash-download.js');
    // Cast instead of direct property access so this file typechecks both
    // before and after `fetchServerTroffDataResult` is exported.
    const exports = mod as unknown as {
      fetchServerTroffDataResult?: FetchFn;
    };
    fetchServerTroffDataResult = exports.fetchServerTroffDataResult;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('success → { ok:true, data } with markers/states/info/serverId/fileUrl/duration, no toast/alert', async () => {
    expect(typeof fetchServerTroffDataResult).toBe('function');

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        fileName: 'song.mp3',
        fileUrl: 'https://example.com/song.mp3',
        fileSize: 12345,
        fileType: 'audio/mpeg',
        id: 42,
        markerJsonString: JSON.stringify({
          markers: [{ id: 'm1', time: 3 }],
          aStates: ['{"currentMarker":"m1"}'],
          info: 'Verse 1',
          fileData: { duration: 60 },
        }),
        troffDataPublic: true,
        troffDataUploadedMillis: Date.now(),
      }),
    });

    const result = await fetchServerTroffDataResult!(42, 'song.mp3');

    expect(result).toEqual({
      ok: true,
      data: {
        markers: [{ id: 'm1', time: 3 }],
        states: ['{"currentMarker":"m1"}'],
        info: 'Verse 1',
        serverId: 42,
        fileUrl: 'https://example.com/song.mp3',
        duration: 60,
      },
    });
    expect(showToastMock, 'quiet fetch must never toast on success').not.toHaveBeenCalled();
    expect(alertSpy, 'quiet fetch must never alert on success').not.toHaveBeenCalled();
  });

  it('doc not found → { ok:false, useAlert:false, outdated-link message } with NO toast/alert', async () => {
    expect(typeof fetchServerTroffDataResult).toBe('function');

    mockGetDoc.mockResolvedValue({ exists: () => false });

    const result = await fetchServerTroffDataResult!(789, 'missing.mp3');

    expect(result).toEqual({
      ok: false,
      useAlert: false,
      message: 'Could not find the song data on the server. The link may be outdated.',
    });
    expect(showToastMock, 'errors must be deferred — no toast at fetch time').not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('filename mismatch → { ok:false, useAlert:false, song-specific message } with NO toast/alert', async () => {
    expect(typeof fetchServerTroffDataResult).toBe('function');

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        fileName: 'other-song.mp3',
        fileUrl: 'https://example.com/other-song.mp3',
        fileSize: 1,
        fileType: 'audio/mpeg',
        id: 123,
        markerJsonString: JSON.stringify({ markers: [], fileData: { duration: 10 } }),
        troffDataPublic: true,
        troffDataUploadedMillis: Date.now(),
      }),
    });

    const result = await fetchServerTroffDataResult!(123, 'mysong.mp3');

    expect(result).toEqual({
      ok: false,
      useAlert: false,
      message:
        'Could not find the song "mysong.mp3" on the server. ' +
        'The link may be wrong, or the song has been removed.',
    });
    expect(showToastMock, 'errors must be deferred — no toast at fetch time').not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('thrown error → { ok:false, useAlert:true, network message } and NO alert from the fetch', async () => {
    expect(typeof fetchServerTroffDataResult).toBe('function');

    mockGetDoc.mockRejectedValue(new Error('socket hang up'));

    const result = await fetchServerTroffDataResult!(7, 'broken.mp3');

    expect(result).toEqual({
      ok: false,
      useAlert: true,
      message: 'Could not fetch the song data from the server due to a network error.',
    });
    expect(showToastMock).not.toHaveBeenCalled();
    expect(alertSpy, 'the Result fn must never alert — the caller reports later').not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Wrapper pin: fetchServerTroffData keeps TODAY's exact behavior
// (toast + null) so existing callers/tests stay green.
// This is GREEN pre-implementation (current code already toasts here) and must
// stay green after fetchServerTroffData delegates to the Result function.
// ---------------------------------------------------------------------------
describe('fetchServerTroffData wrapper (legacy UX pinned)', () => {
  let fetchServerTroffData: FetchFn | undefined;
  let mockGetDoc: ReturnType<typeof vi.fn>;
  let mockDoc: ReturnType<typeof vi.fn>;
  let mockDb: Record<string, never>;
  let showToastMock: ReturnType<typeof vi.fn>;
  let alertSpy: MockInstance;

  beforeEach(async () => {
    vi.resetModules();

    mockGetDoc = vi.fn();
    mockDoc = vi.fn((_db: unknown, _collection: string, _id: string) => ({ id: _id }));
    mockDb = {};

    vi.doMock('../assets/internal/db.js', () => ({
      nDB: {
        get: vi.fn(),
        set: vi.fn(),
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

    showToastMock = vi.fn();
    vi.doMock('../utils/notification.js', () => ({
      showToast: showToastMock,
      showLoading: vi.fn(),
      showDownloadProgress: vi.fn(),
      hideDownloadProgress: vi.fn(),
    }));

    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const registry = customElements;
    const originalDefine = registry.define.bind(registry);
    const patched = Object.create(registry);
    patched.define = (
      name: string,
      constructor: CustomElementConstructor,
      options?: ElementDefinitionOptions
    ) => {
      if (!registry.get(name)) {
        originalDefine(name, constructor, options);
      }
    };
    vi.stubGlobal('customElements', patched);

    const mod = await import('../utils/hash-download.js');
    const exports = mod as unknown as { fetchServerTroffData?: FetchFn };
    fetchServerTroffData = exports.fetchServerTroffData;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('doc not found → still toasts the outdated-link message as an error (5000 ms) and returns null', async () => {
    expect(typeof fetchServerTroffData).toBe('function');

    mockGetDoc.mockResolvedValue({ exists: () => false });

    const result = await fetchServerTroffData!(789, 'missing.mp3');

    expect(result).toBeNull();
    expect(showToastMock).toHaveBeenCalledWith(
      'Could not find the song data on the server. The link may be outdated.',
      'error',
      5000
    );
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
