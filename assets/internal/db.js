// @ts-check

/**
 * Shared types for the nDB storage helpers
 *
 * @typedef {string} SongId
 * @typedef {string | string[]} KeyPath
 *
 * A synchronous callback signature used by the callback-based API.
 * @callback NDBValueCallback
 * @param {any} value
 * @returns {void}
 *
 * Represents the shape of the localStorage-backed database helper (sync API).
 * @typedef {Object} NDB
 * @property {(songId: SongId, keys: KeyPath, value: any) => void} setOnSong
 *   Set a deep property on a stored song object. Creates any missing objects along the path.
 * @property {(key: string, value: any) => void} set
 *   Store a JSON-serializable value under the provided key.
 * @property {(key: string) => (any | null)} get
 *   Retrieve a value and parse it from JSON. Returns null when not found.
 * @property {(key: string) => void} delete
 *   Remove a stored value.
 * @property {() => string[]} getAllKeys
 *   Get all keys currently stored in localStorage.
 * @property {() => void} clearAllStorage
 *   Clear the entire localStorage.
 *
 * Represents the shape of the callback-based wrapper API.
 * @typedef {Object} NDBc
 * @property {(key: string, callback: NDBValueCallback) => void} get
 *   Async-style wrapper around nDB.get.
 * @property {(callback: NDBValueCallback) => void} getAllKeys
 *   Async-style wrapper around nDB.getAllKeys.
 */

/** @type {NDB} */
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
   * @param {SongId} songId
   * @param {KeyPath} keys Path to set. Either a single key or an array of nested keys.
   * @param {any} value Value to set at the targeted path.
   * @returns {void}
   */
  setOnSong: function (songId, keys, value) {
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
   * @param {string} key
   * @param {any} value
   * @returns {void}
   */
  set: function (key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  },
  /**
   * Get a stored value parsed from JSON
   * @param {string} key
   * @returns {any | null}
   */
  get: function (key) {
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
   * @param {string} key
   * @returns {void}
   */
  delete: function (key) {
    window.localStorage.removeItem(key);
    // todo, add print if "key" do not exist
  },
  /**
   * Get all keys stored in localStorage
   * @returns {string[]}
   */
  getAllKeys: function () {
    return Object.keys(localStorage);
  },
  /**
   * Clear all localStorage
   * @returns {void}
   */
  clearAllStorage: function () {
    localStorage.clear();
  },
};

/** @type {NDBc} */
const nDBc = {
  //new data base callback

  /**
   * @param {string} key
   * @param {NDBValueCallback} callback
   * @returns {void}
   */
  get: function (key, callback) {
    callback(nDB.get(key));
  },
  /**
   * @param {NDBValueCallback} callback
   * @returns {void}
   */
  getAllKeys: function (callback) {
    callback(nDB.getAllKeys());
  },
};

export { nDB, nDBc };
