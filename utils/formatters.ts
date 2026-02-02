import { TroffObjectLocal } from 'types/troff';
import { getSongDisplayName } from './song';

/**
 * Format duration in seconds to MM:SS format
 * @param seconds The duration in seconds
 * @returns The duration in MM:SS format
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Format TroffObjectLocal data for UI consumption
 * @param songKey The song key
 * @param songData The TroffObjectLocal data
 * @returns The formatted song data
 */
export function formatSongForUI(songKey: string, songData: TroffObjectLocal): any {
  const { fileData } = songData;

  return {
    songKey: songKey,
    title: getSongDisplayName(fileData, songKey),
    artist: fileData.artist || '',
    album: fileData.album || '',
    genre: fileData.genre || '',
    duration: formatDuration(fileData.duration),
    // Add other fields as needed
  };
}
