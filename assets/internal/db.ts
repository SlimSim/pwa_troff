// @ts-check

/** nDB New Data Base */
const nDB = {
  // new data base

  /**
   * Set a deep property on a song object identified by songId.
   * If intermediate objects in the path don't exist, they will be created.
   *
   * Example:
   *   setOnSong('mySong', ['fileData', 'artist'], 'ABBA')
   *   setOnSong('mySong', 'serverId', 123)
   *
   * @param songId
   * @param keys Path to set. Either a single key or an array of nested keys.
   * @param value Value to set at the targeted path.
   */
  setOnSong: function (songId: string, keys: string | string[], value: any) {
    if (typeof keys != 'object') {
      keys = [keys];
    }

    const valObject = [];
    valObject[0] = nDB.get(songId);
    if (valObject[0] == null) {
      console.error(
        'setOnSong: songId does no exist in database. You are trying to set ' +
          value +
          ' on the property ' +
          keys[0] +
          ' on the song ' +
          songId +
          ', but that song does not exist in the DB, RETURNING'
      );
      return;
    }

    for (let i = 0; i < keys.length - 1; i++) {
      if (typeof valObject[i] != 'object') {
        if (i === 1) {
          console.warn(
            'setOnSong: Adding key to songObject, the object does not have the key "' +
              keys[i - 1] +
              '", on the song "' +
              songId +
              '"; it will be added'
          );
        } else {
          console.warn(
            'setOnSong: Adding key to songObject, the object "' +
              keys[i - 2] +
              '"; does not have the key "' +
              keys[i - 1] +
              '"; it will be added'
          );
        }
        valObject[i] = {};
      }
      valObject[i + 1] = valObject[i][keys[i]];
    }

    if (typeof valObject[keys.length - 1] != 'object') {
      valObject[keys.length - 1] = {};
    }
    if (
      typeof valObject[keys.length - 1] != 'object' ||
      valObject[keys.length - 1][keys[keys.length - 1]] === undefined
    ) {
      console.warn(
        'setOnSong: Adding key to songObject, the object does not have the key "' +
          keys[keys.length - 1] +
          '" ' +
          keys.length +
          ' levels deep, on the song "' +
          songId +
          '"; it will be added'
      );
    }
    valObject[keys.length - 1][keys[keys.length - 1]] = value;

    for (let i = keys.length - 1; i > 0; i--) {
      valObject[i - 1][keys[i - 1]] = valObject[i];
    }
    nDB.set(songId, valObject[0]);
  },
  /**
   * Store a JSON-serializable value
   */
  set: function (key: string, value: any): void {
    window.localStorage.setItem(key, JSON.stringify(value));
  },
  /**
   * Get a stored value parsed from JSON
   */
  get: function (key: string): any | null {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn('nDB.get: Failed to parse JSON for key', key, e);
      return null;
    }
  },
  /**
   * Remove a stored value
   */
  delete: function (key: string): void {
    window.localStorage.removeItem(key);
    // todo, add print if "key" do not exist
  },
  /**
   * Get all keys stored in localStorage
   */
  getAllKeys: function (): string[] {
    return Object.keys(localStorage);
  },
  /**
   * Clear all localStorage
   */
  clearAllStorage: function (): void {
    localStorage.clear();
  },
};

export { nDB };
