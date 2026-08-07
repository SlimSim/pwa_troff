const audio = new Audio();

export { audio };

export async function loadSong(
  songKey: string
): Promise<{ url: string; isVideo: boolean } | null> {
  try {
    audio.pause();
    const cache = await caches.open('songCache-v1.0');
    const response = await cache.match(songKey);
    if (!response) {
      throw new Error(`Song ${songKey} not found in cache`);
    }
    const blob = await response.blob();
    return { url: URL.createObjectURL(blob), isVideo: blob.type.startsWith('video/') };
  } catch (error) {
    console.error('Error loading song:', error);
    alert(`Error loading song: ${songKey}. It may not be cached.`);
    return null;
  }
}
