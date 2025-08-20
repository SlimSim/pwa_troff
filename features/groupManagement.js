// Group management functions

/* eslint eqeqeq: "off" */
// @ts-check

/**
 * @typedef {{
 *   fullPath: string,
 *   galleryId: any,
 *   firebaseSongDocId?: string
 * }} SongIdObject
 */
/**
 * @typedef {{
 *   id: any,
 *   name: any,
 *   color: any,
 *   icon: any,
 *   info: any,
 *   owners?: string[],
 *   firebaseGroupDocId?: string,
 *   songs?: SongIdObject[]
 * }} SongListObject
 */
/**
 * @typedef {{ id: string, exists: () => boolean, data: () => any }} DocSnapshotLike
 */

import { db, setDoc, doc, addDoc, collection, onSnapshot } from '../services/firebaseClient.js';
import { Troff, DB, firebaseUser } from '../script.js';
import { removeSongFromFirebaseGroup, saveSongDataToFirebaseGroup } from '../services/firebase.js';
import { nDB } from '../assets/internal/db.js';
import { SongToGroup } from '../scriptASimple.js';

/**
 * @param {string} groupDocId
 */
const setGroupAsSonglist = function (groupDocId) {
  /** @type {SongListObject[]} */
  const songLists = JSON.parse(nDB.get('straoSongLists'));
  if (!songLists.find((sl) => (/** @type {SongListObject} */ (sl)).firebaseGroupDocId == groupDocId)) {
    return;
  }

  SongToGroup.remove(undefined, groupDocId);

  DB.setSonglistAsNotGroup(groupDocId);

  const $target = $('#songListList').find(`[data-firebase-group-doc-id="${groupDocId}"]`);
  if ($target.length == 0) {
    return;
  }

  $target.removeClass('groupIndication');
  $target.attr('data-firebase-group-doc-id', null);

  const songList = $target.data('songList');
  if (songList == undefined) {
    return;
  }

  delete songList.firebaseGroupDocId;
  delete songList.owners;
  $target.data('songList', songList);
};

/**
 * @param {DocSnapshotLike} doc
 */
const groupDocUpdate = function (doc) {
  if (!doc.exists()) {
    setGroupAsSonglist(doc.id);
    return;
  }

  const group = doc.data();
  const $target = $('#songListList').find(`[data-firebase-group-doc-id="${doc.id}"]`);

  if (!group.owners.includes((/** @type {{email: string}} */ (firebaseUser)).email)) {
    setGroupAsSonglist(doc.id);

    $.notify(
      `You have been removed from the group "${$target.text()}".
			It has been converted to a songlist`,
      'info'
    );
    return;
  }

  const songListObject = $target.data('songList');

  Object.entries(group).forEach(([key, value]) => {
    (/** @type {any} */ (songListObject))[key] = value;
  });

  Troff.updateSongListInHTML(songListObject);

  DB.saveSonglists_new();
};

/**
 * @returns {Promise<void>}
 */
const groupDialogSave = async function () {
  if (!$('#buttAttachedSongListToggle').hasClass('active')) {
    $('#buttAttachedSongListToggle').click();
  }

  const isGroup = $('#groupDialogIsGroup').is(':checked');
  let groupDocId = $('#groupDialogName').data('groupDocId');

  /** @type {SongListObject} */
  const songListObject = {
    id: $('#groupDialogName').data('songListObjectId'),
    name: $('#groupDialogName').val(),
    color: $('#groupDialogColor').val(),
    icon: $('#groupDialogIcon').val(),
    info: $('#groupDialogInfo').val(),
  };

  if (isGroup) {
    /** @type {string[]} */
    const owners = [];
    $('#groupOwnerParent')
      .find('.groupDialogOwner')
      .each(/** @param {number} i @param {HTMLElement} v */ (i, v) => {
        owners.push($(v).val());
      });

    if (!owners.includes((/** @type {{email: string}} */ (firebaseUser)).email)) {
      owners.push((/** @type {{email: string}} */ (firebaseUser)).email);
    }
    songListObject.owners = owners;

    // copying songListObject to groupData without references!
    const groupData = JSON.parse(JSON.stringify(songListObject));
    delete groupData.id;

    if (groupDocId != null) {
      await setDoc(doc(db, 'Groups', groupDocId), groupData);
    } else {
      const groupRef = await addDoc(collection(db, 'Groups'), groupData);
      onSnapshot(groupRef, groupDocUpdate);

      groupDocId = groupRef.id;
    }

    songListObject.firebaseGroupDocId = groupDocId;
  }

  /** @type {SongIdObject[]} */
  const songs = [];
  $('#groupSongParent')
    .find('input')
    .each(/** @param {number} i @param {HTMLElement} v */ async (i, v) => {
      const songKey = $(v).val();

      const galleryId = $(v).data('galleryId');
      const songDocId = $(v).data('firebaseSongDocId');

      /** @type {SongIdObject} */
      const songIdObject = {
        fullPath: songKey,
        galleryId: galleryId,
        firebaseSongDocId: songDocId,
      };

      if (songKey == '') {
        return;
      }

      if (isGroup) {
        if ($(v).hasClass('removed')) {
          if (songDocId == undefined) {
            return;
          }
          removeSongFromFirebaseGroup(songKey, groupDocId, songDocId);
          return;
        }
        saveSongDataToFirebaseGroup(songKey, groupDocId, songDocId);
      }
      if ($(v).hasClass('removed')) {
        return;
      }

      songs.push(songIdObject);
    });
  songListObject.songs = songs;

  if (songListObject.id == undefined) {
    Troff.addSonglistToHTML_NEW(songListObject);
  } else {
    Troff.updateSongListInHTML(songListObject);
  }
  DB.saveSonglists_new();
};

/**
 * @param {SongIdObject} songIdObject
 */
const addGroupSongRow = (songIdObject) => {
  const songRow = $('#groupDialogSongRowTemplate').children().clone(true, true);

  songRow.find('.groupDialogRemoveSong').on('click', removeSongRow);
  songRow
    .find('.groupDialogSong')
    .attr('readonly', true)
    .addClass('form-control-plaintext')
    .addClass('text-inherit')
    .data('galleryId', songIdObject.galleryId)
    .data('firebaseSongDocId', songIdObject.firebaseSongDocId)
    .val(songIdObject.fullPath);

  $('#groupSongParent').append(songRow);
};

/**
 * @param {Event} event
 */
const removeSongRow = (event) => {
  const row = $(event.target).closest('.form-group.row');
  row.find('.groupDialogSong').addClass('bg-danger removed');
  /*
      notifyUndo( song + " was removed.", function() {
          addGroupOwnerRow( song );
      } );
      */

  //row.remove();
};

export { groupDialogSave, addGroupSongRow, groupDocUpdate, setGroupAsSonglist };
