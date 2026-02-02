import { nDB } from '../assets/internal/db.js';
import { TroffObjectLocal } from 'types/troff';
import { formatSongForUI } from './formatters.js';

export class LocalSongDataService {
  static CACHE_NAME = 'songCache-v1.0';

  /**
   * Get all songs from local cache
   * @returns An array of TroffObjectLocal objects WITH songKey
   */
  static async getAllSongs(): Promise<TroffObjectLocal[]> {
    const songs: TroffObjectLocal[] = [];

    // Get all songs from cache first
    const cache = await caches.open(this.CACHE_NAME);
    const cacheKeys = await cache.keys();

    for (const cacheRequest of cacheKeys) {
      const songKey = decodeURIComponent(cacheRequest.url.split('/').pop() || cacheRequest.url);
      const songData = nDB.get(songKey);

      // TODO: If songData is null, The song should still be added, with fileData set to "standard values"
      if (songData && songData.fileData) {
        songs.push(formatSongForUI(songKey, songData));
      }
    }

    return songs;
  }
}
