/*
	This file is part of Troff.

	Troff is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License,
	or (at your option) any later version.

	Troff is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with Troff. If not, see <http://www.gnu.org/licenses/>.
*/

/* eslint eqeqeq: "off" */

import './assets/external/DataTables/js/jquery.dataTables.min.js';
import { nDB } from './assets/internal/db.js';
import { DB, Troff, IO, addSongsToSonglist, mergeSongListHistorys } from './script.js';
import log from './utils/log.js';
import { cacheImplementation } from './services/FileApiImplementation.js';
import { notifyUndo } from './assets/internal/notify-js/notify.config.js';
import { auth, db, doc, setDoc, getDoc } from './services/firebaseClient.js';
import { escapeRegExp, getFileExtension } from './utils/utils.js';
import { TROFF_SETTING_SHOW_SONG_DIALOG, DATA_TABLE_COLUMNS } from './constants/constants.js';
import { DirectoryListObject, SonglistSongInfo, TroffHistoryList } from './types/troff.js';
import { openGroupDialog } from './features/groupManagement.js';

window.alert = (alert) => {
  log.w('Alert:', alert);
};

var imgFormats = ['png', 'bmp', 'jpeg', 'jpg', 'gif', 'svg', 'xbm', 'webp'];
var audFormats = ['wav', 'mp3', 'm4a'];
var vidFormats = ['avi', '3gp', '3gpp', 'flv', 'mov', 'mpeg', 'mpeg4', 'mp4', 'webm', 'wmv', 'ogg'];

const nrIdsInHistoryList = (historyList: TroffHistoryList[]) => {
  if (!historyList) return 0;
  let nrIds = 0;
  historyList.forEach((historyObject) => {
    nrIds += historyObject.troffDataIdObjectList.length;
  });
  return nrIds;
};

const updateUploadedHistory = async () => {
  try {
    if (auth.currentUser == null) return;

    const snapshot = await getDoc(doc(db, 'UserData', auth.currentUser.uid));
    const userData = snapshot.exists() ? snapshot.data() : {};

    const uploadedHistory = userData.uploadedHistory || [];
    const localHistory = nDB.get('TROFF_TROFF_DATA_ID_AND_FILE_NAME') || [];
    const totalList = mergeSongListHistorys(uploadedHistory, localHistory);

    const nrIdsInTotalList = nrIdsInHistoryList(totalList);
    const nrIdsInUploadedHistory = nrIdsInHistoryList(uploadedHistory);

    // om total är längre än uploadedHistory, så ska
    // firebase uppdateras!
    if (nrIdsInTotalList > nrIdsInUploadedHistory) {
      // totalList kanske ska ränsa totalList från onödiga saker???
      // beroende på hur mycket plats det tar upp i firebase...
      userData.uploadedHistory = totalList;
      await setDoc(doc(db, 'UserData', auth.currentUser.uid), userData);
    }
  } catch (error) {
    log.e('updateUploadedHistory: error', error);
  }
};

function addImageToContentDiv() {
  var content_div = document.getElementById('content');
  var videoBox = document.createElement('div');
  var image = document.createElement('img');

  if (content_div == null) return;

  videoBox.setAttribute('id', 'videoBox');
  image.classList.add('contain-object');
  image.classList.add('full-width');
  Troff.setMetadataImage();
  Troff.setImageLayout();

  var fsButton = document.createElement('button');
  fsButton.addEventListener('click', Troff.forceFullscreenChange);
  fsButton.appendChild(document.createTextNode('Fullscreen (F)'));
  content_div.appendChild(fsButton);
  videoBox.appendChild(image);
  content_div.appendChild(videoBox);

  return image;
}

function addAudioToContentDiv() {
  var content_div = document.getElementById('content');
  var audio = document.createElement('audio');
  audio.addEventListener('loadedmetadata', () => {
    // onSongLoad:
    log.d('Safari loadedmetadata', { duration: audio.duration, readyState: audio.readyState });

    Troff.setMetadata(audio);
    Troff.setAudioVideoLayout();
  });
  audio.addEventListener('error', (e) => log.e('Audio media error', e));

  if (content_div == null) return;
  content_div.appendChild(audio);
  return audio;
}

function addVideoToContentDiv() {
  var content_div = document.getElementById('content');
  var videoBox = document.createElement('div');
  var video = document.createElement('video');

  var fsButton = document.createElement('button');

  var margin = '4px';
  video.style.marginTop = margin;
  video.style.marginBottom = margin;

  fsButton.addEventListener('click', Troff.playInFullscreenChanged);
  fsButton.appendChild(document.createTextNode('Play in Fullscreen'));
  fsButton.setAttribute('id', 'playInFullscreenButt');
  fsButton.setAttribute('class', 'stOnOffButton mt-2 mr-2');

  videoBox.setAttribute('id', 'videoBox');

  video.addEventListener('loadedmetadata', () => {
    // onSongLoad:
    Troff.setMetadata(video);
    Troff.setAudioVideoLayout();
  });

  if (content_div == null) return;
  content_div.appendChild(fsButton);

  content_div.appendChild(
    $('<button>')
      .text('Mirror Image')
      .attr('id', 'mirrorImageButt')
      .click(Troff.mirrorImageChanged)
      .addClass('stOnOffButton mt-2 mr-2')[0]
  );

  videoBox.appendChild(video);
  content_div.appendChild(videoBox);
  return video;
}

function getFileType(filename: string) {
  var ext = getFileExtension(filename);
  if (imgFormats.indexOf(ext) >= 0) return 'image';
  else if (audFormats.indexOf(ext) >= 0) return 'audio';
  else if (vidFormats.indexOf(ext) >= 0) return 'video';
  else return null;
}

function getFileTypeFaIcon(filename: string) {
  var type = getFileType(filename);

  switch (type) {
    case 'image':
      return 'fa-image';
    case 'audio':
      return 'fa-music';
    case 'video':
      return 'fa-film';
  }
  return 'fa-question';
}

function clearContentDiv() {
  var content_div = document.getElementById('content');
  if (content_div == null) return;
  while (content_div.childNodes.length >= 1) {
    content_div.removeChild(content_div.firstChild as Node);
  }
}

function sortAndValue(sortValue: number | string, stringValue: string) {
  if (sortValue === undefined) return '<i class="hidden">' + 0 + '</i>'; //<i class=\"fa " + faType + "\"></i>",
  if (typeof String.prototype.padStart == 'function') {
    sortValue = sortValue.toString().padStart(16, '0');
  }
  return '<i class="hidden">' + sortValue + '</i>' + stringValue;
}

function filterSongTable(list: string[]) {
  var regex = list.join('|') || false;
  if (
    $('#directoryList, #galleryList, #songListsList').find('button').filter('.active, .selected')
      .length == 0
  ) {
    $('#songListAll').addClass('selected');
    regex = '';
  }
  $('#songlistSelectedWarning').toggleClass('hidden', $('#songListAll').hasClass('selected'));
  const $songLists = $('#songListList .selected, #songListList .active');
  if ($songLists.length == 1) {
    $('#songlistSelectedWarningName').text(' "' + $songLists.text() + '"');
  } else {
    $('#songlistSelectedWarningName').text('s');
  }

  ($('#dataSongTable') as any)
    .DataTable()
    .columns(DATA_TABLE_COLUMNS.getPos('DATA_INFO'))
    .search(regex, true, false)
    .draw();
}

function getFilterDataList(): string[] {
  var list: string[] = [];

  $('#songListsList')
    .find('button')
    .filter('.active, .selected')
    .each((i, v) => {
      var innerData = $(v).data('songList');

      if (innerData) {
        $.each(innerData.songs, (i, vi) => {
          if (vi.isDirectory) {
            const galleryId = vi.galleryId || vi.data.galleryId;
            list.push('^{"galleryId":"' + galleryId + '"');
          } else {
            const fullPath = vi.fullPath || vi.data.fullPath;
            list.push('"fullPath":"' + escapeRegExp(fullPath) + '"}$');
          }
        });
      }
    });
  return list;
}

/**
 * returns a list of the checked visible songs in the SongTable
 * AND ALSO unchecks the songs!
 * @returns List of songDataInfoObjects {galleryId, fullPath}
 */
function getSelectedSongs_NEW(): DirectoryListObject[] {
  const $checkboxes = $('#dataSongTable').find('td').find('input[type=checkbox]:checked');
  const checkedVisibleSongs = $checkboxes
    .closest('tr')
    .map((i, v) =>
      JSON.parse(
        ($('#dataSongTable') as any).DataTable().row(v).data()[
          DATA_TABLE_COLUMNS.getPos('DATA_INFO')
        ]
      )
    )
    .get();

  $checkboxes.prop('checked', false);
  return checkedVisibleSongs;
}

function clickButtNewSongList() {
  var songs: DirectoryListObject[] = getSelectedSongs_NEW();
  openGroupDialog({ songs: songs });
}

function songListDialogOpenExisting(event: JQuery.ClickEvent) {
  openGroupDialog($(event.target).closest('button').next().data('songList'));
}

function onDragleave(ev: JQuery.DragLeaveEvent) {
  $(ev.target).removeClass('drop-active');
}

function allowDrop(ev: JQuery.DragEvent) {
  if ($(ev.target).hasClass('songlist')) {
    $(ev.target).addClass('drop-active');
    ev.preventDefault();
  }
}

function dropSongOnSonglist(event: JQuery.DragEvent) {
  if (!$(event.target).hasClass('songlist')) {
    return;
  }
  event.preventDefault();

  $(event.target).removeClass('drop-active');

  if ((event as any).dataTransfer === undefined) {
    (event as any).dataTransfer = event?.originalEvent?.dataTransfer;
  }

  var dataInfo = JSON.parse((event as any).dataTransfer.getData('jsonDataInfo')),
    $target = $(event.target);

  addSongsToSonglist([dataInfo], $target);
}

function removeSongsFromSonglist(
  songs: DirectoryListObject[] | SonglistSongInfo[],
  $target: JQuery
) {
  let songDidNotExists;

  const songList = $target.data('songList');

  $.each(songs, (i, song) => {
    var index,
      dataInfo: DirectoryListObject = (song as SonglistSongInfo).data || song,
      value;
    songDidNotExists = true;

    for (index = 0; index < songList.songs.length; index++) {
      value = songList.songs[index];
      if (value.galleryId == dataInfo.galleryId && value.fullPath == dataInfo.fullPath) {
        songDidNotExists = false;
        songList.songs.splice(index, 1);
      }
    }

    if (songDidNotExists) {
      $.notify(dataInfo.fullPath + ' did not exist in ' + songList.name, 'info');
      return;
    }

    $target.data('songList', songList);

    notifyUndo(
      ((song as SonglistSongInfo).name || dataInfo.fullPath) + ' was removed from ' + songList.name,
      () => {
        var undo_songList = $target.data('songList');

        undo_songList.songs.push(dataInfo);

        DB.saveSonglists_new();
      }
    );
  });
  DB.saveSonglists_new();
}

function clickAttachedSongListToggle() {
  $('#toggleSonglistsId').trigger('click');
}

function reloadSongsButtonActive(event: JQuery.ClickEvent) {
  if (event == null || !$(event.target).hasClass('outerDialog')) {
    return;
  }
  if ($('#outerSongListPopUpSquare').hasClass('hidden')) {
    closeSongDialog();
  } else {
    openSongDialog();
  }
}

function closeSongDialog() {
  $('#outerSongListPopUpSquare').addClass('hidden');
  $('#songPickerAttachedArea').addClass('hidden');
  $('#buttSongsDialog').removeClass('active');
  DB.saveVal(TROFF_SETTING_SHOW_SONG_DIALOG, false);
}

function openSongDialog() {
  if ($('#TROFF_SETTING_SONG_LIST_FLOATING_DIALOG').hasClass('active')) {
    $('#outerSongListPopUpSquare').removeClass('hidden');
  } else {
    $('#songPickerAttachedArea').removeClass('hidden');
  }

  $('#buttSongsDialog').addClass('active');

  DB.saveVal(TROFF_SETTING_SHOW_SONG_DIALOG, true);
}

function clickSongsDialog(event: JQuery.ClickEvent) {
  if ($(event.target).hasClass('active')) {
    closeSongDialog();
  } else {
    openSongDialog();
  }
}

function minimizeSongPicker() {
  $('#TROFF_SETTING_SONG_LIST_FLOATING_DIALOG').click();
}

function maximizeSongPicker() {
  $('#TROFF_SETTING_SONG_LIST_FLOATING_DIALOG').click();
}

function clickToggleFloatingSonglists() {
  const shouldOpenSongDialog = $('#buttSongsDialog').hasClass('active');
  closeSongDialog();
  if ($('#TROFF_SETTING_SONG_LIST_FLOATING_DIALOG').hasClass('active')) {
    moveSongPickerToFloatingState();
  } else {
    moveSongPickerToAttachedState();
  }
  if (shouldOpenSongDialog) {
    openSongDialog();
  }
}

function moveSongPickerToAttachedState() {
  dataTableShowOnlyColumnsForAttachedState();
  $('#newSearchParent, #songPicker').detach().appendTo($('#songPickerAttachedArea'));
  $('.hideOnSongsDialogFloatingState').removeClass('hidden');
  $('.hideOnSongsDialogAttachedState').addClass('hidden');
}

function moveSongPickerToFloatingState() {
  $('#newSearchParent, #songPicker').detach().insertBefore('#songPickerFloatingBase');
  dataTableShowColumnsForFloatingState();
  $('#songPickerAttachedArea, .hideOnSongsDialogFloatingState').addClass('hidden');
  $('.hideOnSongsDialogAttachedState').removeClass('hidden');
}

function dataTableShowOnlyColumnsForAttachedState() {
  $('#columnToggleParent')
    .children()
    .each((i, v) => {
      if (DATA_TABLE_COLUMNS.list[$(v).data('column')].showOnAttachedState) {
        ($('#dataSongTable') as any).DataTable().column($(v).data('column')).visible(true);
      } else {
        ($('#dataSongTable') as any).DataTable().column($(v).data('column')).visible(false);
      }
    });
}

function dataTableShowColumnsForFloatingState() {
  $('#columnToggleParent')
    .children()
    .each((i, v) => {
      if ($(v).hasClass('active')) {
        ($('#dataSongTable') as any).DataTable().column($(v).data('column')).visible(true);
      } else {
        ($('#dataSongTable') as any).DataTable().column($(v).data('column')).visible(false);
      }
    });
}

function onChangeSongListSelector(event: JQuery.ChangeEvent) {
  var $target = $(event.target),
    $selected = $target.find(':selected'),
    $checkedRows = $('#dataSongTable').find('td').find('input[type=checkbox]:checked'),
    songDataInfoList: DirectoryListObject[] = getSelectedSongs_NEW();

  var $songlist = $('#songListList').find('[data-songlist-id="' + $selected.val() + '"]');

  if ($selected.val() == '+') {
    openGroupDialog({ songs: songDataInfoList });
  } else if ($selected.val() == '--remove') {
    IO.confirm(
      'Remove songs?',
      'Remove songs: <br />' +
        songDataInfoList.map((s) => s.fullPath || (s as any).name).join('<br />') +
        '?<br /><br />Can not be undone.',
      () => {
        songDataInfoList.forEach((song) => {
          const fullPath = song.fullPath || (song as any).fullPath;
          cacheImplementation.removeSong(fullPath);
        });
        $checkedRows.closest('tr').each((i, row) => {
          ($('#dataSongTable') as any).DataTable().row(row).remove().draw();
        });
      }
    );
  } else if ($selected.parent().attr('id') == 'songListSelectorAddToSonglist') {
    addSongsToSonglist(songDataInfoList, $songlist);
  } else if ($selected.parent().attr('id') == 'songListSelectorRemoveFromSonglist') {
    removeSongsFromSonglist(songDataInfoList, $songlist);
  } else {
    log.e('something wrong');
  }

  $target.val('-');
}

export {
  updateUploadedHistory,
  moveSongPickerToFloatingState,
  songListDialogOpenExisting,
  openGroupDialog,
  dropSongOnSonglist,
  allowDrop,
  onDragleave,
  clickButtNewSongList,
  onChangeSongListSelector,
  closeSongDialog,
  openSongDialog,
  clickSongsDialog,
  minimizeSongPicker,
  maximizeSongPicker,
  clickAttachedSongListToggle,
  clickToggleFloatingSonglists,
  reloadSongsButtonActive,
  moveSongPickerToAttachedState,
  filterSongTable,
  getFilterDataList,
  getFileTypeFaIcon,
  getFileType,
  sortAndValue,
  clearContentDiv,
  addImageToContentDiv,
  addAudioToContentDiv,
  addVideoToContentDiv,
};
