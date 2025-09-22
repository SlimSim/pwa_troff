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
import { TroffFirebaseGroupIdentifyer, TroffFirebaseSongIdentifyer } from 'types/troff.js';
import { DocumentSnapshot } from 'firebase/firestore';

const setGroupAsSonglist = function (groupDocId: string) {
  const songLists: TroffFirebaseGroupIdentifyer[] = JSON.parse(nDB.get('straoSongLists'));
  if (!songLists.find((sl) => sl.firebaseGroupDocId == groupDocId)) {
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

const groupDocUpdate = function (doc: DocumentSnapshot) {
  if (!doc.exists()) {
    setGroupAsSonglist(doc.id);
    return;
  }

  const group = doc.data();
  const $target = $('#songListList').find(`[data-firebase-group-doc-id="${doc.id}"]`);

  if (!group.owners.includes(firebaseUser?.email)) {
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
    /** @type {any} */ songListObject[key] = value;
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

  const songListObject = {
    id: $('#groupDialogName').data('songListObjectId'),
    name: $('#groupDialogName').val() as string,
    color: $('#groupDialogColor').val() as string,
    icon: $('#groupDialogIcon').val() as string,
    info: $('#groupDialogInfo').val() as string,
  } as TroffFirebaseGroupIdentifyer;

  if (isGroup) {
    const owners: string[] = [];
    $('#groupOwnerParent')
      .find('.groupDialogOwner')
      .each((_i, v) => {
        owners.push($(v).val() as string);
      });

    if (firebaseUser?.email && !owners.includes(firebaseUser?.email)) {
      owners.push(firebaseUser?.email);
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
  const songs: TroffFirebaseSongIdentifyer[] = [];
  $('#groupSongParent')
    .find('input')
    .each((_i, v) => {
      const songKey: string = $(v).val() || '';

      const galleryId = $(v).data('galleryId');
      const songDocId = $(v).data('firebaseSongDocId');

      const songIdObject: TroffFirebaseSongIdentifyer = {
        fullPath: songKey,
        galleryId: galleryId || '',
        firebaseSongDocId: songDocId || '',
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

const addGroupSongRow = (songIdObject: TroffFirebaseSongIdentifyer) => {
  const songRow = $('#groupDialogSongRowTemplate').children().clone(true, true);

  console.log('addGroupSongRow: songIdObject.firebaseSongDocId', songIdObject.firebaseSongDocId);

  songRow.find('.groupDialogRemoveSong').on('click', removeSongRow);
  songRow
    .find('.groupDialogSong')
    .prop('readonly', true)
    .addClass('form-control-plaintext')
    .addClass('text-inherit')
    .data('galleryId', songIdObject.galleryId)
    .data('firebaseSongDocId', songIdObject.firebaseSongDocId || null)
    .val(songIdObject.fullPath);

  $('#groupSongParent').append(songRow);
};

const removeSongRow = (event: { target: any }) => {
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
