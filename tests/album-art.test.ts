import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock nDB, log, troff-settings (parseId3) and caches before importing the
// module under test (mirrors tests/firebase-group-song-sync.test.ts).
//
// troff-settings is mocked so the heavy component graph it imports
// (t-marker-slider → t-butt) is never evaluated under vi.resetModules().
// parseId3 itself is covered by tests/troff-settings.test.ts.
// ---------------------------------------------------------------------------

type NdbEntry = {
  markers?: unknown[];
  fileData?: { albumArt?: string; [key: string]: unknown };
  [key: string]: unknown;
};

const nDBStore: Record<string, NdbEntry> = {};

vi.mock('../assets/internal/db.js', () => ({
  nDB: {
    get: vi.fn((key: string) => nDBStore[key] ?? null),
    set: vi.fn((key: string, value: NdbEntry) => {
      nDBStore[key] = value;
    }),
    setOnSong: vi.fn(),
  },
}));

// Shared instances so assertions survive vi.resetModules() re-imports.
const logMock = vi.hoisted(() => ({
  i: vi.fn(),
  e: vi.fn(),
  d: vi.fn(),
  w: vi.fn(),
  t: vi.fn(),
}));
vi.mock('../utils/log.js', () => ({ default: logMock }));

const parseId3Mock = vi.hoisted(() => vi.fn());
vi.mock('../utils/troff-settings.js', () => ({
  parseId3: parseId3Mock,
}));

const mockCache: Record<string, Response> = {};
const mockCacheInstance = {
  match: vi.fn(async (key: string) => mockCache[key] ?? null),
  put: vi.fn(async (key: string, response: Response) => {
    mockCache[key] = response;
  }),
};
const cachesMock = {
  open: vi.fn(async (_name: string) => mockCacheInstance),
};
vi.stubGlobal('caches', cachesMock);

const ALBUM_ART = 'data:image/jpeg;base64,extractedArt';

const id3WithArt = {
  title: 'My Title',
  artist: 'My Artist',
  album: '',
  genre: '',
  info: '',
  albumArt: ALBUM_ART,
};
const id3WithoutArt = { title: 'Plain', artist: '', album: '', genre: '', info: '' };

describe('extractAlbumArt', () => {
  let extractAlbumArt: (songKey: string) => Promise<void>;

  beforeEach(async () => {
    vi.resetModules();
    Object.keys(nDBStore).forEach((k) => delete nDBStore[k]);
    Object.keys(mockCache).forEach((k) => delete mockCache[k]);
    parseId3Mock.mockReset();
    parseId3Mock.mockReturnValue(id3WithoutArt);
    logMock.d.mockClear();
    logMock.e.mockClear();
    cachesMock.open.mockClear();
    cachesMock.open.mockImplementation(async (_name: string) => mockCacheInstance);
    mockCacheInstance.match.mockClear();

    const mod = await import('../utils/album-art.js');
    extractAlbumArt = mod.extractAlbumArt;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Extraction
  // -----------------------------------------------------------------------

  it('extracts albumArt from the cached audio file and writes it to the nDB entry', async () => {
    nDBStore['track.mp3'] = {
      markers: [{ id: 'm1' }],
      fileData: { title: 'My Title', artist: 'My Artist' },
    };
    mockCache['track.mp3'] = new Response(new Uint8Array([0x49, 0x44, 0x33]), { status: 200 });
    parseId3Mock.mockReturnValue(id3WithArt);

    await extractAlbumArt('track.mp3');

    expect(cachesMock.open).toHaveBeenCalledWith('songCache-v1.0');
    expect(mockCacheInstance.match).toHaveBeenCalledWith('track.mp3');
    expect(parseId3Mock).toHaveBeenCalledTimes(1);
    expect(parseId3Mock.mock.calls[0][0]).toBeInstanceOf(Uint8Array);

    const entry = nDBStore['track.mp3'];
    expect(entry.fileData).toBeDefined();
    expect(entry.fileData?.albumArt).toBe(ALBUM_ART);
    // Existing fileData/markers are preserved
    expect(entry.fileData?.title).toBe('My Title');
    expect(entry.fileData?.artist).toBe('My Artist');
    expect(entry.markers).toEqual([{ id: 'm1' }]);
  });

  it('creates fileData when the nDB entry has none', async () => {
    nDBStore['fresh.mp3'] = { markers: [] };
    mockCache['fresh.mp3'] = new Response('audio', { status: 200 });
    parseId3Mock.mockReturnValue({
      title: '',
      artist: '',
      album: '',
      genre: '',
      info: '',
      albumArt: 'data:image/png;base64,newArt',
    });

    await extractAlbumArt('fresh.mp3');

    const entry = nDBStore['fresh.mp3'];
    expect(entry.fileData).toBeDefined();
    expect(entry.fileData?.albumArt).toBe('data:image/png;base64,newArt');
    expect(entry.markers).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Idempotency
  // -----------------------------------------------------------------------

  it('skips the cache read entirely when albumArt is already present', async () => {
    nDBStore['done.mp3'] = {
      fileData: { title: 'T', albumArt: 'data:image/jpeg;base64,alreadyThere' },
    };
    mockCache['done.mp3'] = new Response('audio', { status: 200 });

    await extractAlbumArt('done.mp3');

    expect(cachesMock.open).not.toHaveBeenCalled();
    expect(mockCacheInstance.match).not.toHaveBeenCalled();
    expect(parseId3Mock).not.toHaveBeenCalled();
    // Existing art untouched
    expect(nDBStore['done.mp3'].fileData?.albumArt).toBe('data:image/jpeg;base64,alreadyThere');
  });

  // -----------------------------------------------------------------------
  // No-ops
  // -----------------------------------------------------------------------

  it('is a no-op when the file is not in the cache', async () => {
    nDBStore['missing.mp3'] = { fileData: { title: 'T' } };
    // deliberately no mockCache entry

    await expect(extractAlbumArt('missing.mp3')).resolves.toBeUndefined();

    expect(parseId3Mock).not.toHaveBeenCalled();
    expect(nDBStore['missing.mp3'].fileData?.albumArt).toBeUndefined();
  });

  it('is a no-op when the ID3 tags contain no albumArt', async () => {
    nDBStore['plain.mp3'] = { fileData: { title: 'T' } };
    mockCache['plain.mp3'] = new Response('audio', { status: 200 });
    parseId3Mock.mockReturnValue(id3WithoutArt);

    await expect(extractAlbumArt('plain.mp3')).resolves.toBeUndefined();

    expect(parseId3Mock).toHaveBeenCalledTimes(1);
    expect(nDBStore['plain.mp3'].fileData?.albumArt).toBeUndefined();
    expect(nDBStore['plain.mp3'].fileData?.title).toBe('T');
  });

  it('is a no-op when there is no nDB entry for the song', async () => {
    mockCache['unknown.mp3'] = new Response('audio', { status: 200 });

    await expect(extractAlbumArt('unknown.mp3')).resolves.toBeUndefined();

    expect(nDBStore['unknown.mp3']).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Never throws
  // -----------------------------------------------------------------------

  it('never throws and logs via log.d when the cache API fails', async () => {
    nDBStore['track.mp3'] = { fileData: { title: 'T' } };
    cachesMock.open.mockRejectedValue(new Error('cache unavailable'));

    await expect(extractAlbumArt('track.mp3')).resolves.toBeUndefined();

    expect(logMock.d).toHaveBeenCalled();
    expect(nDBStore['track.mp3'].fileData?.albumArt).toBeUndefined();
  });

  it('never throws and logs via log.d when parseId3 fails', async () => {
    nDBStore['track.mp3'] = { fileData: { title: 'T' } };
    mockCache['track.mp3'] = new Response('audio', { status: 200 });
    parseId3Mock.mockImplementation(() => {
      throw new Error('corrupt ID3');
    });

    await expect(extractAlbumArt('track.mp3')).resolves.toBeUndefined();

    expect(logMock.d).toHaveBeenCalled();
    expect(nDBStore['track.mp3'].fileData?.albumArt).toBeUndefined();
  });
});
