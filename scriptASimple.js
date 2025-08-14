import { nDB } from "./assets/internal/db.js";

class SongToGroup {
  static #map = {};

  static #onSongAdded = [];

  static get() {
    return this.#map;
  }

  static getSongGroupList(songKey) {
    return this.#map[songKey];
  }

  static onSongAdded(callback) {
    this.#onSongAdded.push(callback);
  }

  static add(groupDocId, songDocId, songKey, fileUrl) {
    this.quickAdd(groupDocId, songDocId, songKey, fileUrl);
    this.saveToDb();
  }

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

  static getNrOfGroupsThisSongIsIn(songKey) {
    let myGroups = this.#map;

    const firestoreIdentifierList = myGroups[songKey];
    if (firestoreIdentifierList == undefined) {
      return 0;
    }
    return firestoreIdentifierList.length;
  }

  static saveToDb() {
    nDB.set("TROFF_SONG_GROUP_MAP", this.#map);
  }

  static initiateFromDb() {
    this.#map = nDB.get("TROFF_SONG_GROUP_MAP") || {};
  }

  static clearMap() {
    this.#map = {};
  }

  static songKeyToFileUrl = (songKey, docId, songDocId) => {
    const myGroups = this.#map;
    const firestoreIdentifierList = myGroups[songKey];
    return firestoreIdentifierList?.find(
      (fi) => fi.groupDocId == docId && fi.songDocId == songDocId
    )?.fileUrl;
  };

  static getFileNameFromSongDocId(songDocId) {
    const myGroups = this.#map;
    const myGroupsE = Object.entries(myGroups);

    for (let i = 0; i < myGroupsE.length; i++) {
      let groupWithSongList = myGroupsE[i][1].filter(
        (idObject) => idObject.songDocId == songDocId
      );

      if (groupWithSongList.length == 0) {
        continue;
      }
      return myGroupsE[i][0];
    }
    console.info(
      `getFileNameFromSongDocId: songDocId (${songDocId})`` did not return any fileName!`
    );
    return "undefined";
  }
}

export { SongToGroup };
