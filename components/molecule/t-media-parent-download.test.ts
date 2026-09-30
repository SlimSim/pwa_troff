import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MediaParent } from './t-media-parent.js';
import * as firebaseGetter from '../../utils/firebase-getter.js';
import * as notification from '../../utils/notification.js';

// ---------------------------------------------------------------------------
// Mock the shared album-art helper so the call site after cache.put can be
// asserted. (Factory-only mock — no import of the path, the module does not
// exist yet while the helper is being implemented.)
// ---------------------------------------------------------------------------

const extractAlbumArtSpy = vi.hoisted(() => vi.fn(async (_songKey: string) => {}));
vi.mock('../../utils/album-art.js', () => ({
  extractAlbumArt: extractAlbumArtSpy,
}));

describe('t-media-parent _downloadSong stale-token retry (403)', () => {
  let element: MediaParent;
  let fetchMock: ReturnType<typeof vi.fn>;
  let cachePutSpy: ReturnType<typeof vi.fn>;

  const staleUrl =
    'https://firebasestorage.googleapis.com/v0/b/troff-prod.appspot.com/o/TroffFiles%2Fabc123?alt=media&token=stale-token';
  const freshUrl =
    'https://firebasestorage.googleapis.com/v0/b/troff-prod.appspot.com/o/TroffFiles%2Fabc123?alt=media&token=fresh-token';

  beforeEach(() => {
    extractAlbumArtSpy.mockClear();
    vi.spyOn(MediaParent.prototype as unknown as { _loadSongs: () => Promise<void> }, '_loadSongs').mockResolvedValue(undefined);

    element = new MediaParent();
    document.body.appendChild(element);

    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    cachePutSpy = vi.fn(async () => undefined);
    const mockCache = {
      put: cachePutSpy,
      match: vi.fn(async () => undefined),
    };
    Object.defineProperty(globalThis, 'caches', {
      value: { open: vi.fn(async () => mockCache) },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('retries once with a fresh URL after 403 and marks downloaded', async () => {
    const getFreshDownloadUrl = vi.fn(async (url: string) => {
      expect(url).toBe(staleUrl);
      return freshUrl;
    });
    vi.spyOn(firebaseGetter, 'getStorageHandle').mockResolvedValue({
      getFreshDownloadUrl,
    });

    // Let Lit finish its initial render so icon fetches settle, then isolate
    // the fetch mock so only _downloadSong calls are asserted below.
    await element.updateComplete;
    fetchMock.mockClear();
    // URL-based routing: icon/other fetches that hit the same global mock
    // must not consume the queued download responses.
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url === staleUrl) return new Response('Forbidden', { status: 403 });
      if (url === freshUrl) return new Response('audio data', { status: 200 });
      return new Response('', { status: 200 });
    });

    const song = {
      songKey: 'test-song',
      title: 'Test Song',
      fileUrl: staleUrl,
      downloaded: false,
    };

    const result = await (element as unknown as { _downloadSong: (s: unknown) => Promise<boolean> })._downloadSong(song);

    // Must have minted a fresh URL from the stale one and retried exactly once.
    expect(getFreshDownloadUrl).toHaveBeenCalledWith(staleUrl);
    const downloadCalls = fetchMock.mock.calls.filter(
      (call) => call[0] === staleUrl || call[0] === freshUrl
    );
    expect(downloadCalls).toHaveLength(2);
    expect(downloadCalls[0][0]).toBe(staleUrl);
    expect(downloadCalls[1][0]).toBe(freshUrl);

    // Retry success follows the existing success path.
    expect(result).toBe(true);
    expect(song.downloaded).toBe(true);
  });

  it('calls extractAlbumArt after caching the downloaded file', async () => {
    // Isolate from icon fetches sharing the same global mock (see above).
    await element.updateComplete;
    fetchMock.mockClear();
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url === freshUrl) return new Response('audio data', { status: 200 });
      return new Response('', { status: 200 });
    });

    const song = {
      songKey: 'album-art-song',
      title: 'Album Art Song',
      fileUrl: freshUrl,
      downloaded: false,
    };

    const result = await (element as unknown as { _downloadSong: (s: unknown) => Promise<boolean> })._downloadSong(song);

    // File reached the song cache, then the shared ID3 album-art helper ran
    expect(result).toBe(true);
    expect(cachePutSpy).toHaveBeenCalledWith('album-art-song', expect.any(Response));
    expect(extractAlbumArtSpy).toHaveBeenCalledWith('album-art-song');
  });

  it('returns false and shows an error toast when retry still fails', async () => {
    const getFreshDownloadUrl = vi.fn(async () => freshUrl);
    vi.spyOn(firebaseGetter, 'getStorageHandle').mockResolvedValue({
      getFreshDownloadUrl,
    });
    const toastSpy = vi.spyOn(notification, 'showToast').mockImplementation(() => {});

    // Isolate from icon fetches sharing the same global mock (see above).
    await element.updateComplete;
    fetchMock.mockClear();
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url === staleUrl || url === freshUrl) {
        return new Response('Forbidden', { status: 403 });
      }
      return new Response('', { status: 200 });
    });

    const song = {
      songKey: 'test-song-2',
      title: 'Failing Song',
      fileUrl: staleUrl,
      downloaded: false,
    };

    const result = await (element as unknown as { _downloadSong: (s: unknown) => Promise<boolean> })._downloadSong(song);

    expect(getFreshDownloadUrl).toHaveBeenCalledWith(staleUrl);
    const downloadCalls = fetchMock.mock.calls.filter(
      (call) => call[0] === staleUrl || call[0] === freshUrl
    );
    expect(downloadCalls).toHaveLength(2);
    expect(downloadCalls[0][0]).toBe(staleUrl);
    expect(downloadCalls[1][0]).toBe(freshUrl);
    expect(result).toBe(false);
    expect(song.downloaded).toBe(false);
    // Must not fail silently — user-visible error feedback is required.
    expect(toastSpy).toHaveBeenCalledWith(expect.any(String), 'error');
  });
});
