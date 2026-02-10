const audio = new Audio();

export { audio };

export async function loadSong(songKey: string) {
  try {
    const cache = await caches.open('songCache-v1.0');
    const response = await cache.match(songKey);
    if (!response) {
      throw new Error(`Song ${songKey} not found in cache`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    audio.src = url;
    audio.load();
  } catch (error) {
    console.error('Error loading song:', error);
    alert(`Error loading song: ${songKey}. It may not be cached.`);
  }
}
