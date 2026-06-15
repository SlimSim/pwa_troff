import { TroffObjectLocal } from 'types/troff';
import { getSongDisplayName } from './song.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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
 * Count how many timestamps in the given array fall within the last 30 days.
 * Exported for testing.
 * @param timestamps Array of millisecond timestamps
 * @returns Count of entries within the last 30 days
 */
export function countLast30Days(timestamps: number[] | undefined): number {
  if (!timestamps || timestamps.length === 0) return 0;
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  return timestamps.filter((t) => t > cutoff).length;
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
    playsTotal: songData.localInformation?.nrTimesLoaded || 0,
    playsMonth: countLast30Days(songData.localInformation?.songStartsLastMonth),
  };
}
