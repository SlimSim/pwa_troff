// @ts-check

import log from '../../utils/log.js';

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
      log.e(
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
    const writeOk = nDB.set(songId, valObject[0]);
    if (!writeOk) {
      log.e(
        'setOnSong: Failed to persist updated song "' + songId + '" to localStorage'
      );
    }
  },
  /**
   * Store a JSON-serializable value.
   * Returns true on success, false if the write failed (e.g. storage full
   * or the IndexedDB connection was lost on iOS).
   */
  set: function (key: string, value: any): boolean {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      log.e('nDB.set: Failed to write to localStorage for key "' + key + '":', e);
      return false;
    }
  },
  /**
   * Get a stored value parsed from JSON.
   * Returns null when the key is missing, the value is corrupted,
   * or localStorage is unavailable (e.g. IndexedDB connection lost on iOS).
   */
  get: function (key: string): any | null {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch (e) {
      log.w('nDB.get: Failed to read from localStorage for key "' + key + '":', e);
      return null;
    }
  },
  /**
   * Remove a stored value
   */
  delete: function (key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      log.e('nDB.delete: Failed to remove key "' + key + '" from localStorage:', e);
    }
  },
  /**
   * Get all keys stored in localStorage
   */
  getAllKeys: function (): string[] {
    try {
      return Object.keys(localStorage);
    } catch (e) {
      log.e('nDB.getAllKeys: Failed to read localStorage keys:', e);
      return [];
    }
  },
  /**
   * Clear all localStorage
   */
  clearAllStorage: function (): void {
    try {
      localStorage.clear();
    } catch (e) {
      log.e('nDB.clearAllStorage: Failed to clear localStorage:', e);
    }
  },
};

export { nDB };
