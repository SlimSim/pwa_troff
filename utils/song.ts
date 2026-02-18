import { nDB } from '../assets/internal/db.js';

/**
 * Returns the display name of a song based on its file data.
 * @param fileData The file data of the song.
 * @param defaultValue The default value to return if no display name is found.
 * @returns The display name of the song.
 */
export function getSongDisplayName(fileData: any, defaultValue: string): string {
  return fileData.customName || fileData.choreography || fileData.title || defaultValue;
}

/**
 * Get song metadata from local storage
 * @param songKey The song key/path
 * @returns Song metadata with title, artist, duration, etc.
 */
export function getSongMetadata(songKey: string) {
  if (!songKey) return null;

  const songData = nDB.get(songKey);
  if (!songData || !songData.fileData) {
    return {
      title: songKey.split('/').pop() || 'Unknown Song',
      artist: 'Unknown Artist',
      duration: 0,
    };
  }

  const { fileData } = songData;
  return {
    title: getSongDisplayName(fileData, songKey),
    artist: fileData.artist || 'Unknown Artist',
    duration: fileData.duration || 0,
  };
}
