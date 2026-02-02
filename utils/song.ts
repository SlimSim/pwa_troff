/**
 * Returns the display name of a song based on its file data.
 * @param fileData The file data of the song.
 * @param defaultValue The default value to return if no display name is found.
 * @returns The display name of the song.
 */
export function getSongDisplayName(fileData: any, defaultValue: string): string {
  return fileData.customName || fileData.choreography || fileData.title || defaultValue;
}
