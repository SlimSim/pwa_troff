import { nDB } from '../assets/internal/db.js';
import { getSongMetadata } from './song.js';
import { formatDuration } from './formatters.js';

/**
 * Update the header with current song information
 */
export function updateHeaderWithCurrentSong() {
  const header = document.getElementById('header') as any;
  if (!header) return;

  // Get current song path from localStorage
  const currentSongData = nDB.get('stroCurrentSongPathAndGalleryId');
  const songPath = currentSongData?.strPath;

  if (songPath) {
    const metadata = getSongMetadata(songPath);
    if (metadata) {
      header.songTitle = metadata.title;
      header.artistName = metadata.artist;
      header.currentTime = '0:00'; // Will be updated by media player
      header.totalTime = formatDuration(metadata.duration);
      console.log('Header updated with song:', metadata.title, 'by', metadata.artist);
    }
  } else {
    // No song selected, show default values
    header.songTitle = 'No song selected';
    header.artistName = 'Select a song to play';
    header.currentTime = '0:00';
    header.totalTime = '0:00';
  }
}

/**
 * Set the current song in localStorage and update header
 * @param songKey The song key/path
 * @param galleryId The gallery ID (optional)
 */
export function setCurrentSong(songKey: string, galleryId?: string) {
  const currentSongData = {
    strPath: songKey,
    iGalleryId: galleryId || 'pwa-galleryId',
  };
  nDB.set('stroCurrentSongPathAndGalleryId', currentSongData);

  // Update header with new song info
  updateHeaderWithCurrentSong();
}

/**
 * Get the current song key from localStorage
 * @returns The current song key or null if no song is selected
 */
export function getCurrentSongKey(): string | null {
  const currentSongData = nDB.get('stroCurrentSongPathAndGalleryId');
  return currentSongData?.strPath || null;
}

/**
 * Get the current song metadata
 * @returns Current song metadata or null if no song is selected
 */
export function getCurrentSongMetadata() {
  const songKey = getCurrentSongKey();
  return songKey ? getSongMetadata(songKey) : null;
}
