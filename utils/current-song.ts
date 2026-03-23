import { nDB } from '../assets/internal/db.js';
import { getSongMetadata } from './song.js';

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
      header.currentTime = '0:00';
    }
  } else {
    // No song selected, show default values
    header.songTitle = 'No song selected';
    header.artistName = 'Select a song to play';
    header.currentTime = '0:00';
    header.totalTime = '0:00';
  }
}

export function updateFooterWithCurrentSong() {
  const footer = document.getElementById('footer') as any;
  if (!footer) return;

  // Get current song path from localStorage
  const currentSongData = nDB.get('stroCurrentSongPathAndGalleryId');
  const songPath = currentSongData?.strPath;

  if (songPath) {
    const songData = nDB.get(songPath);
    if (songData) {
      footer.speed = Number(songData.TROFF_VALUE_speedBar) || 100;
      footer.volume = Number(songData.TROFF_VALUE_volumeBar) || 75;
      footer.pauseBefore = Number(songData.TROFF_VALUE_pauseBeforeStart) || 3;
      footer.waitBetween = Number(songData.TROFF_VALUE_waitBetweenLoops) || 1;
      footer.disablePauseBefore = !songData.TROFF_CLASS_TO_TOGGLE_buttPauseBefStart;
      footer.disableWaitBetween = !songData.TROFF_CLASS_TO_TOGGLE_buttWaitBetweenLoops;
    }
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
