import { TroffSongAddedEvent, TroffSongGroupMap, TroffSongIdentifyer_fu } from 'types/troff.js';
import { nDB } from './assets/internal/db.js';

class SongToGroup {
  static #map: TroffSongGroupMap = {};

  static #onSongAdded: ((evt: TroffSongAddedEvent) => void)[] = [];

  static get(): TroffSongGroupMap {
    return this.#map;
  }

  static getSongGroupList(songKey: string): TroffSongIdentifyer_fu[] | undefined {
    return this.#map[songKey];
  }

  static onSongAdded(callback: (evt: TroffSongAddedEvent) => void) {
    this.#onSongAdded.push(callback);
  }

  static add(groupDocId: string, songDocId: string, songKey: string, fileUrl: string): void {
    this.quickAdd(groupDocId, songDocId, songKey, fileUrl);
    this.saveToDb();
  }

  static quickAdd(groupDocId: string, songDocId: string, songKey: string, fileUrl: string): void {
    const myGroups = this.#map;
    var thisSong = myGroups[songKey];

    if (thisSong == null) {
      thisSong = [];
    }

    const thisSongIsInThisGroup = thisSong.some(
      (o) => o.groupDocId === groupDocId && o.songDocId === songDocId
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

  static remove(songDocId: string | undefined, groupDocId?: string): void {
    const myGroups = this.#map;

    Object.entries(myGroups).forEach((v) => {
      let idObjectList = v[1];
      idObjectList = idObjectList.filter(
        (o) => o.songDocId !== songDocId && o.groupDocId !== groupDocId
      );
      if (idObjectList.length === 0) {
        delete myGroups[v[0]];
      } else {
        myGroups[v[0]] = idObjectList;
      }
    });

    this.#map = myGroups;
    this.saveToDb();
  }

  static getNrOfGroupsThisSongIsIn(songKey: string): number {
    const myGroups = this.#map;

    const firestoreIdentifierList = myGroups[songKey];
    if (firestoreIdentifierList == null) {
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

  static songKeyToFileUrl(songKey: string, docId: string, songDocId: string): string | undefined {
    const myGroups = this.#map;
    const firestoreIdentifierList = myGroups[songKey];
    return firestoreIdentifierList?.find(
      (fi) => fi.groupDocId === docId && fi.songDocId === songDocId
    )?.fileUrl;
  }

  static getFileNameFromSongDocId(songDocId: string): string {
    const myGroups = this.#map;
    const myGroupsE = Object.entries(myGroups);

    for (let i = 0; i < myGroupsE.length; i++) {
      const groupWithSongList = myGroupsE[i][1].filter(
        (idObject) => idObject.songDocId === songDocId
      );

      if (groupWithSongList.length === 0) {
        continue;
      }
      return myGroupsE[i][0];
    }
    console.info(`getFileNameFromSongDocId: songDocId (${songDocId}) did not return any fileName!`);
    return 'undefined';
  }
}

export { SongToGroup };
