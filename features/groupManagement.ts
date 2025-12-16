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
import { TroffFirebaseGroupIdentifyer, TroffFirebaseSongIdentifyer } from '../types/troff.js';
import { DocumentSnapshot } from 'firebase/firestore';
import { notifyUndo } from '../assets/internal/notify-js/notify.config.js';
import { DATA_TABLE_COLUMNS } from '../constants/constants.js';
import { appendColorButtonsTo } from '../ui/troffUi.js';
import { MarkerColorConfig } from '../types/markers.js';
import { getBgColor } from '../utils/colorHelpers.js';

console.log('groupManagement ->');

const generateColorBut = (col: MarkerColorConfig) => {
  const clas = 'colorPicker markerBackgroundColor m-1';
  const colorButt = $('<input>', {
    type: 'button',
    value: '',
    title: col.name,
    class: clas,
  }).on('click', Troff.setSonglistColor);
  colorButt[0].style.setProperty('--marker-bg-color', col.color);
  colorButt[0].dataset.colorName = col.name;
  colorButt[0].dataset.colorValue = col.color;
  colorButt[0].dataset.onColorValue = col.onColor;
  return colorButt;
};

export const setColorsOnGroupDialog = function () {
  const colorParent = $('#songlistColorPicker');
  appendColorButtonsTo(colorParent, generateColorBut);
};

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
  console.log('groupDocUpdate -> ');
  if (!doc.exists()) {
    setGroupAsSonglist(doc.id);
    return;
  }

  const group = doc.data();
  console.log('groupDocUpdate: group', group);
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

  console.log("groupDialogSave:  $('#groupDialogColor').val()", $('#groupDialogColor').val());

  const songListObject = {
    id: $('#groupDialogName').data('songListObjectId'),
    name: $('#groupDialogName').val() as string,
    color: $('#groupDialogColor').val() as string,
    icon: $('#groupDialogIcon').val() as string,
    info: $('#groupDialogInfo').val() as string,
  } as TroffFirebaseGroupIdentifyer;

  console.log('groupDialogSave: songListObject', songListObject);

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

const populateExampleSongsInGroupDialog = (songs: TroffFirebaseSongIdentifyer[]) => {
  // TODO: fixa bättre sätt att lägga på låtarna!
  const dataInfo: any = ($('#dataSongTable') as any)
    .DataTable()
    .column(DATA_TABLE_COLUMNS.getPos('DATA_INFO'))
    .data();

  const fullPathList = songs.map((song) => song.fullPath);
  dataInfo.each((v: string) => {
    const fullPath = JSON.parse(v).fullPath;
    if (fullPathList.includes(fullPath)) {
      return;
    }
    $('#possible-songs-to-add').append(
      $('<li>')
        .addClass('py-1')
        .append(
          $('<button>')
            .text(fullPath)
            .addClass('regularButton')
            .attr('type', 'button')
            .data('fullPath', fullPath)
            .click(onClickAddNewSongToGroup)
        )
    );
  });
};

const openGroupDialog = async (songListObject: TroffFirebaseGroupIdentifyer) => {
  console.log('openGroupDialog -> songListObject', songListObject);
  emptyGroupDialog();

  const isGroup = songListObject.firebaseGroupDocId !== undefined;

  if (isGroup) {
    $('#leaveGroup').removeClass('hidden');
    $('.showOnSharedSonglist').removeClass('hidden');
    if (!songListObject.icon) {
      songListObject.icon = 'fa-users';
    }

    const color = getBgColor(songListObject.color);
    console.log('color', color);

    $('#groupDialog').find('.innerDialog')[0].style.setProperty('--bg-custom-color', color.color);
    $('#groupDialog')
      .find('.innerDialog')[0]
      .style.setProperty('--on-bg-custom-color', color.onColor);
    $('#groupDialog')
      .find('.innerDialog')
      .toggleClass('bg-custom', color.color != '');

    $('#groupDialogSonglistIcon').addClass(songListObject.icon);

    $('#groupDialogColor').val(color.color || '');
    $('#groupDialogIcon').val(songListObject.icon);

    $('#songlistColorPicker')
      .find('[data-color-value="' + (color.color || 'backgroundColorNone') + '"]')
      .addClass('colorPickerSelected');

    $('#songlistIconPicker')
      .find('.' + songListObject.icon)
      .parent()
      .addClass('selected');
  } else {
    $('#shareSonglist').removeClass('hidden');
  }

  $('#groupDialogName').val(songListObject.name || '');
  $('#groupDialogName').data('songListObjectId', songListObject.id || null);
  $('#groupDialogName').data('groupDocId', songListObject.firebaseGroupDocId || null);

  $('#groupDialogIsGroup').prop('checked', isGroup);

  $('#groupDialogInfo').val(songListObject.info || '');

  songListObject.owners?.forEach(addGroupOwnerRow);

  songListObject.songs.forEach(addGroupSongRow);

  populateExampleSongsInGroupDialog(songListObject.songs);

  $('#groupDialog').removeClass('hidden');
};

const emptyGroupDialog = () => {
  $('#groupDialog').find('form').trigger('reset');

  $('#groupOwnerParent').empty();
  $('#groupSongParent').empty();
  $('#possible-songs-to-add').empty();

  $('#groupDialogName').val('');
  $('#groupDialogName').removeData();

  $('#leaveGroup').addClass('hidden');
  $('#shareSonglist').addClass('hidden');
  $('.showOnSharedSonglist').addClass('hidden');

  $('#groupDialog').find('.innerDialog').removeClassStartingWith('bg-');

  $('#groupDialogSonglistIcon').removeClassStartingWith('fa-');

  $('#groupDialogIcon').val('');
  $('#songlistIconPicker').find('button').removeClass('selected');

  $('#groupDialogColor').val('');
  $('#songlistColorPicker').find('.colorPickerSelected').removeClass('colorPickerSelected');
};

const removeOwnerRow = (event: JQuery.ClickEvent) => {
  const row = $(event.target).closest('.form-group.row');
  const owner = row.find('.groupDialogOwner').val() as string;

  notifyUndo(owner + ' was removed.', () => {
    addGroupOwnerRow(owner);
  });

  row.remove();
};

const onClickAddNewSongToGroup = (event: JQuery.ClickEvent) => {
  const target = $(event.target);
  addGroupSongRow({ fullPath: target.data('fullPath'), galleryId: 'pwa-galleryId' });
  target.remove();
};

const addGroupOwnerRow = (owner: string = '') => {
  const ownerRow = $('#groupDialogOwnerRowTemplate').children().clone(true, true);

  ownerRow.find('.groupDialogRemoveOwner').on('click', removeOwnerRow);
  ownerRow.find('.groupDialogOwner').val(owner);
  $('#groupOwnerParent').append(ownerRow);
};

export {
  groupDialogSave,
  addGroupSongRow,
  groupDocUpdate,
  setGroupAsSonglist,
  openGroupDialog,
  addGroupOwnerRow,
  emptyGroupDialog,
};
