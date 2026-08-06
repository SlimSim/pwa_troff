import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadSong, audio } from '../services/audio.js';

/**
 * Feature spec #32 — `loadSong(songKey)` signature change:
 * It must return `Promise<{ url: string; isVideo: boolean } | null>`, pause the
 * `audio` singleton, open cache `songCache-v1.0`, match the songKey, and return
 * `{ url: URL.createObjectURL(blob), isVideo: blob.type.startsWith('video/') }`.
 * It must NO LONGER set `audio.src` (the caller decides where the URL goes).
 */
describe('loadSong (audio service) — video support', () => {
  const cachesOpenMock = vi.fn();
  let cacheMatchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cacheMatchMock = vi.fn();
    cachesOpenMock.mockReset();
    cachesOpenMock.mockResolvedValue({ match: cacheMatchMock });
    vi.stubGlobal('caches', { open: cachesOpenMock });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.stubGlobal('alert', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('resolves to { url, isVideo: true } when the cached blob is a video', async () => {
    const blob = new Blob(['fake video data'], { type: 'video/mp4' });
    cacheMatchMock.mockResolvedValue(new Response(blob));

    const result = await loadSong('video.mp4');

    expect(cachesOpenMock).toHaveBeenCalledWith('songCache-v1.0');
    expect(cacheMatchMock).toHaveBeenCalledWith('video.mp4');
    expect(result).toEqual({ url: 'blob:mock-url', isVideo: true });
  });

  it('resolves to { url, isVideo: false } when the cached blob is audio', async () => {
    const blob = new Blob(['fake audio data'], { type: 'audio/mpeg' });
    cacheMatchMock.mockResolvedValue(new Response(blob));

    const result = await loadSong('song.mp3');

    expect(result).toEqual({ url: 'blob:mock-url', isVideo: false });
  });

  it('resolves to null when the song is missing from the cache (does not throw)', async () => {
    cacheMatchMock.mockResolvedValue(undefined);

    await expect(loadSong('missing.mp3')).resolves.toBeNull();
  });

  it('pauses the audio singleton and does NOT set audio.src (caller decides)', async () => {
    const pauseSpy = vi.spyOn(audio, 'pause').mockImplementation(() => {});
    // Use the raw attribute: the `src` PROPERTY getter resolves relative URLs
    // to absolute in happy-dom (like real browsers), so assert on the attribute
    // to genuinely verify loadSong never set/overwrote audio.src.
    audio.setAttribute('src', 'old-src.mp3');

    const blob = new Blob(['fake audio data'], { type: 'audio/mpeg' });
    cacheMatchMock.mockResolvedValue(new Response(blob));

    await loadSong('song.mp3');

    expect(pauseSpy).toHaveBeenCalled();
    expect(audio.getAttribute('src')).toBe('old-src.mp3');
  });
});
