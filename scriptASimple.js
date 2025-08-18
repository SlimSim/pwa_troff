/* eslint eqeqeq: "off" */
// @ts-check
import { nDB } from './assets/internal/db.js';

/**
 * A single membership entry: a song in a specific group with a file URL.
 * @typedef {Object} SongGroupEntry
 * @property {string} groupDocId
 * @property {string} songDocId
 * @property {string} fileUrl
 */

/** @typedef {Record<string, SongGroupEntry[]>} SongGroupMap */

/**
 * Payload sent to `#onSongAdded` listeners.
 * @typedef {Object} SongAddedEvent
 * @property {{ groupDocId: string, songDocId: string, songKey: string, fileUrl: string }} detail
 */

class SongToGroup {
  /** @type {SongGroupMap} */
  static #map = {};

  /** @type {((evt: SongAddedEvent) => void)[]} */
  static #onSongAdded = [];

  /**
   * @returns {SongGroupMap}
   */
  static get() {
    return this.#map;
  }

  /**
   * @param {string} songKey
   * @returns {SongGroupEntry[] | undefined}
   */
  static getSongGroupList(songKey) {
    return this.#map[songKey];
  }

  /**
   * @param {(evt: SongAddedEvent) => void} callback
   * @returns {void}
   */
  static onSongAdded(callback) {
    this.#onSongAdded.push(callback);
  }

  /**
   * @param {string} groupDocId
   * @param {string} songDocId
   * @param {string} songKey
   * @param {string} fileUrl
   * @returns {void}
   */
  static add(groupDocId, songDocId, songKey, fileUrl) {
    this.quickAdd(groupDocId, songDocId, songKey, fileUrl);
    this.saveToDb();
  }

  /**
   * @param {string} groupDocId
   * @param {string} songDocId
   * @param {string} songKey
   * @param {string} fileUrl
   * @returns {void}
   */
  static quickAdd(groupDocId, songDocId, songKey, fileUrl) {
    const myGroups = this.#map;
    var thisSong = myGroups[songKey];

    if (thisSong == undefined) {
      thisSong = [];
    }

    const thisSongIsInThisGroup = thisSong.some(
      (o) => o.groupDocId == groupDocId && o.songDocId == songDocId
    );

    if (thisSongIsInThisGroup) {
      return;
    }
    thisSong.push({
      groupDocId: groupDocId,
      songDocId: songDocId,
      fileUrl: fileUrl,
    });
    myGroups[songKey] = thisSong;

    this.#map = myGroups;

    this.#onSongAdded.forEach((funk) => {
      funk({
        detail: {
          groupDocId: groupDocId,
          songDocId: songDocId,
          songKey: songKey,
          fileUrl: fileUrl,
        },
      });
    });
  }

  /**
   * @param {string} songDocId
   * @param {string} groupDocId
   * @returns {void}
   */
  static remove(songDocId, groupDocId) {
    const myGroups = this.#map;

    Object.entries(myGroups).forEach((v) => {
      let idObjectList = v[1];
      idObjectList = idObjectList.filter(
        (o) => o.songDocId != songDocId && o.groupDocId != groupDocId
      );
      if (idObjectList.length == 0) {
        delete myGroups[v[0]];
      } else {
        myGroups[v[0]] = idObjectList;
      }
    });

    this.#map = myGroups;
    this.saveToDb();
  }

  /**
   * @param {string} songKey
   * @returns {number}
   */
  static getNrOfGroupsThisSongIsIn(songKey) {
    const myGroups = this.#map;

    const firestoreIdentifierList = myGroups[songKey];
    if (firestoreIdentifierList == undefined) {
      return 0;
    }
    return firestoreIdentifierList.length;
  }

  /** @returns {void} */
  static saveToDb() {
    nDB.set('TROFF_SONG_GROUP_MAP', this.#map);
  }

  /** @returns {void} */
  static initiateFromDb() {
    this.#map = nDB.get('TROFF_SONG_GROUP_MAP') || {};
  }

  /** @returns {void} */
  static clearMap() {
    this.#map = {};
  }

  /**
   * @param {string} songKey
   * @param {string} docId
   * @param {string} songDocId
   * @returns {string | undefined}
   */
  static songKeyToFileUrl(songKey, docId, songDocId) {
    const myGroups = this.#map;
    const firestoreIdentifierList = myGroups[songKey];
    return firestoreIdentifierList?.find(
      (fi) => fi.groupDocId == docId && fi.songDocId == songDocId
    )?.fileUrl;
  }

  /**
   * @param {string} songDocId
   * @returns {string}
   */
  static getFileNameFromSongDocId(songDocId) {
    const myGroups = this.#map;
    const myGroupsE = Object.entries(myGroups);

    for (let i = 0; i < myGroupsE.length; i++) {
      const groupWithSongList = myGroupsE[i][1].filter(
        (idObject) => idObject.songDocId == songDocId
      );

      if (groupWithSongList.length == 0) {
        continue;
      }
      return myGroupsE[i][0];
    }
    console.info(`getFileNameFromSongDocId: songDocId (${songDocId}) did not return any fileName!`);
    return 'undefined';
  }
}

export { SongToGroup };
