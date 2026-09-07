import { nDB } from '../assets/internal/db.js';
import { TroffObjectLocal } from 'types/troff.js';
import type { TroffFirebaseGroupIdentifyer } from '../types/troff.d.js';
import { formatSongForUI } from './formatters.js';
import { toSongKey } from './utils.js';

const ts = () => new Date().toLocaleTimeString();

export class LocalSongDataService {
  static CACHE_NAME = 'songCache-v1.0';

  /**
   * Get all songs from local cache
   * @returns An array of TroffObjectLocal objects WITH songKey
   */
  static async getAllSongs(): Promise<TroffObjectLocal[]> {
    const songs: TroffObjectLocal[] = [];
    const seenKeys = new Set<string>();

    // Get all songs from cache first
    const cache = await caches.open(this.CACHE_NAME);
    const cacheKeys = await cache.keys();

    for (const cacheRequest of cacheKeys) {
      const songKey = toSongKey(cacheRequest.url);

      // Skip duplicates — same basename from different cache keys (e.g. "font/song.mp3" vs "song.mp3")
      if (seenKeys.has(songKey)) {
        continue;
      }
      seenKeys.add(songKey);

      const songData = nDB.get(songKey);

      // TODO: If songData is null, The song should still be added, with fileData set to "standard values"
      if (songData && songData.fileData) {
        songs.push(formatSongForUI(songKey, songData));
      }
    }

    return songs;
  }

  /**
   * Get all songs known from local cache AND group references.
   *
   * Songs that are in the cache appear with `downloaded: true` and full
   * metadata. Songs that are only referenced by groups (not yet cached)
   * appear with `downloaded: false` and whatever metadata is available in
   * nDB — or just the filename as title when nDB has nothing.
   *
   * @returns An array of song objects with a `downloaded` boolean flag.
   */
  static async getAllSongsWithDownloadStatus(): Promise<
    (TroffObjectLocal & { downloaded: boolean })[]
  > {
    const cachedSongs = await this.getAllSongs();
    const cachedKeys = new Set(cachedSongs.map((s) => (s as any).songKey as string));

    console.log(`${ts()} [LocalSongDataService] getAllSongsWithDownloadStatus: ${cachedSongs.length} songs found in cache`);

    // Collect all songKeys referenced by groups
    const groupSongKeys = new Map<
      string,
      { fileUrl?: string; firebaseSongDocId?: string }
    >();
    const songLists: TroffFirebaseGroupIdentifyer[] =
      (nDB.get('aoSongLists') as TroffFirebaseGroupIdentifyer[]) || [];

    for (const group of songLists) {
      for (const gs of group.songs || []) {
        const key = gs.fullPath || gs.galleryId;
        if (key && !groupSongKeys.has(key)) {
          groupSongKeys.set(key, {
            fileUrl: gs.fileUrl,
            firebaseSongDocId: gs.firebaseSongDocId,
          });
        }
      }
    }

    console.log(`${ts()} [LocalSongDataService] ${groupSongKeys.size} unique songs referenced by ${songLists.length} groups`);

    // Mark all cached songs as downloaded
    const result: { downloaded: boolean; [key: string]: unknown }[] = cachedSongs.map(
      (s) => ({ ...s, downloaded: true })
    );

    // Add songs from groups that are not in the cache
    let addedPending = 0;
    for (const [songKey, groupInfo] of groupSongKeys) {
      if (cachedKeys.has(songKey)) continue;

      // Try to get metadata from nDB (firebase-sync may have saved it)
      const songData = nDB.get(songKey) as Record<string, unknown> | null;
      const fileData = songData?.fileData as Record<string, unknown> | undefined;

      if (fileData) {
        console.log(`${ts()} [LocalSongDataService]   ⏳ pending (has metadata): "${songKey}"`);
        result.push({
          ...formatSongForUI(songKey, songData as unknown as TroffObjectLocal),
          downloaded: false,
          fileUrl: groupInfo.fileUrl,
        });
      } else {
        console.log(`${ts()} [LocalSongDataService]   ⏳ pending (no metadata): "${songKey}"`);
        result.push({
          songKey,
          title: songKey.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '),
          artist: '',
          album: '',
          genre: '',
          tags: '',
          choreographer: '',
          choreography: '',
          info: '',
          duration: '0:00',
          albumArt: '',
          isVideo: false,
          playsTotal: 0,
          playsMonth: 0,
          downloaded: false,
          fileUrl: groupInfo.fileUrl,
        });
      }
      addedPending++;
    }

    console.log(`${ts()} [LocalSongDataService] result: ${cachedSongs.length} cached + ${addedPending} pending = ${result.length} total`);
    return result as unknown as (TroffObjectLocal & { downloaded: boolean })[];
  }

  /**
   * Get the set of songKeys from groups that are not yet in the cache.
   */
  static async getPendingSongKeys(): Promise<
    { songKey: string; fileUrl?: string }[]
  > {
    const cache = await caches.open(this.CACHE_NAME);
    const cacheKeys = await cache.keys();
    const cachedKeys = new Set(cacheKeys.map((r) => toSongKey(r.url)));

    const songLists: TroffFirebaseGroupIdentifyer[] =
      (nDB.get('aoSongLists') as TroffFirebaseGroupIdentifyer[]) || [];
    const pending: { songKey: string; fileUrl?: string }[] = [];

    for (const group of songLists) {
      for (const gs of group.songs || []) {
        const key = gs.fullPath || gs.galleryId;
        if (key && !cachedKeys.has(key) && gs.fileUrl) {
          cachedKeys.add(key); // deduplicate across groups
          pending.push({ songKey: key, fileUrl: gs.fileUrl });
        }
      }
    }

    return pending;
  }
}
