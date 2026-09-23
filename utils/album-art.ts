import { nDB } from '../assets/internal/db.js';
import log from './log.js';
import { parseId3 } from './troff-settings.js';

const CACHE_NAME = 'songCache-v1.0';

/** Loose shape of an nDB song entry (entries are partial at runtime). */
type AlbumArtEntry = {
  fileData?: { albumArt?: string; [key: string]: unknown };
  [key: string]: unknown;
};

/**
 * Extract album art from the cached audio file's ID3 tags and store it on
 * the nDB entry for `songKey`.
 *
 * No-ops (without touching the cache) when there is no nDB entry or the
 * entry already has album art, and when the file is not cached or the ID3
 * tags contain no art. Never throws.
 */
export async function extractAlbumArt(songKey: string): Promise<void> {
  try {
    const entry = nDB.get(songKey) as AlbumArtEntry | null;
    if (!entry) return;
    if (entry.fileData?.albumArt) return;

    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(songKey);
    if (!cachedResponse) return;

    const blob = await cachedResponse.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const id3Data = parseId3(new Uint8Array(arrayBuffer));
    if (!id3Data.albumArt) return;

    // Re-read after the awaits so we don't overwrite concurrent nDB writes
    // with a stale snapshot.
    const fresh = nDB.get(songKey) as AlbumArtEntry | null;
    if (!fresh) return;
    if (fresh.fileData) {
      fresh.fileData.albumArt = id3Data.albumArt;
    } else {
      fresh.fileData = { albumArt: id3Data.albumArt };
    }
    nDB.set(songKey, fresh);
  } catch (error) {
    // Optional call: some test setups mock utils/log.js with a partial
    // default export (no `d`), and this catch must never throw.
    log.d?.('Could not extract album art from audio file:', error);
  }
}
