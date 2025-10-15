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
/// <reference path="./types/globals.d.ts" />

import './assets/external/jquery-3.6.0.min.js';
import './assets/internal/cookie_consent.js';
import './utils/sentry.js';
import './utils/debugging.js';
import {
  auth,
  db,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  doc,
  signOut,
  onSnapshot,
  collection,
  initiateAllFirebaseGroups,
  getDocs,
  getDoc,
} from './services/firebaseClient.js';
import {
  closeSongDialog,
  getFileType,
  clearContentDiv,
  addImageToContentDiv,
  addAudioToContentDiv,
  addVideoToContentDiv,
} from './script0.js';
import log from './utils/log.js';
import { saveSongDataToFirebaseGroup } from './services/firebase.js';
import { notifyUndo } from './assets/internal/notify-js/notify.config.js';
import { cacheImplementation } from './services/FileApiImplementation.js';
import { groupDocUpdate, setGroupAsSonglist } from './features/groupManagement.js';
import { setUiToSignIn, setUiToNotSignIn, updateGroupNotification } from './ui/ui.js';
import { nDB } from './assets/internal/db.js';
import { SongToGroup } from './scriptASimple.js';
import { environment } from './assets/internal/environment.js';
import { TroffClass } from './scriptTroffClass.js';
import { errorHandler, ShowUserException } from './scriptErrorHandler.js';
import DBClass from './scriptDBClass.js';
import { loadExternalHtml } from './utils/utils.js';
import { isSafari, isIphone, isIpad, treatSafariDifferent } from './utils/browserEnv.js';
import IOClass from './ui/scriptIOClass.js';
import RateClass from './scriptRateClass.js';
import { addItem_NEW_2 } from './songManagement.js';

import { firebaseWrapper, fileHandler } from './services/file.js';
import { User } from 'firebase/auth';
import { DocumentData, DocumentSnapshot, QuerySnapshot } from 'firebase/firestore';
import {
  DirectoryListObject,
  SonglistSongInfo,
  TroffDataIdObject,
  TroffFirebaseGroupIdentifyer,
  TroffHistoryList,
  TroffHtmlMarkerElement,
  TroffSongIdentifyer_sk,
} from './types/troff.js';
import { initSongTable } from './dataTable.js';
import { sleep } from './utils/timeHack.js';
import { addAndStartSentry, setSentryEnvironment, setSentryVersion } from './utils/sentry.js';
import { COOKIE_CONSENT_ACCEPTED } from './assets/internal/cookie_consent.js';
import { getManifest } from './utils/manifestHelper.js';

/**
 * A minimal shape for the authenticated user used across the app.
 * Extend as needed without pulling in external types.
 */
let firebaseUser: User | null = null;

// replace your current init:
SongToGroup.initiateFromDb();

SongToGroup.onSongAdded((event) => {
  const songKey = event.detail.songKey;

  $('#dataSongTable').find(`[data-song-key="${songKey}"]`).addClass('groupIndication');

  if (Troff.getCurrentSong() == songKey) {
    $('.groupIndicationDiv').addClass('groupIndication');
  }
});

const googleSignIn = async function () {
  if (isSafari && treatSafariDifferent) {
    IO.alert(
      'Safari and iOS does not support sign in',
      'If you want to sign in and use shared songlists and more, ' +
        'please switch to a supported browser, such as Firefox, Chromium or Chrome.<br /><br />' +
        'Best of luck!'
    );
    return;
  }

  try {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    firebaseUser = result.user;
    if (firebaseUser == null) {
      return;
    }
    setUiToSignIn(firebaseUser);
    const snap = await initiateAllFirebaseGroups(firebaseUser.email);
    initiateCollections(snap);
  } catch (error) {
    log.e('Error during sign-in:', error);
  }
};

const doSignOut = function () {
  signOut(auth)
    .then(() => {
      // Sign-out successful
      // ui will be reset by the auth.onAuthStateChanged-function
    })
    .catch((error) => {
      // An error happened.
      log.e('Error during sign-out:', error);
    });
};

const initiateCollections = async function (querySnapshot?: QuerySnapshot<DocumentData>) {
  if (!querySnapshot) {
    return;
  }
  if (querySnapshot.metadata.fromCache) {
    // If the result is from the cache,
    // we dont want to update the DB with the result!
    return;
  }

  SongToGroup.clearMap();

  await Promise.all(
    querySnapshot.docs.map(async (doc) => {
      const subCollection = await getDocs(collection(doc.ref, 'Songs'));
      // const subCollection = await doc.ref.collection("Songs").get();

      onSnapshot(doc.ref, groupDocUpdate);
      const group = doc.data();

      const songListObject: TroffFirebaseGroupIdentifyer = {
        name: group.name,
        id: group.id, // does not need, but type require it...
        firebaseGroupDocId: doc.id,
        owners: group.owners,
        color: group.color,
        icon: group.icon,
        songs: [],
      };

      subCollection.forEach((songDoc) => {
        songListObject.songs.push({
          galleryId: 'pwa-galleryId',
          fullPath: songDoc.data().songKey,
          firebaseSongDocId: songDoc.id,
        });

        SongToGroup.quickAdd(doc.id, songDoc.id, songDoc.data().songKey, songDoc.data().fileUrl);

        onSnapshot(songDoc.ref, songDocUpdate);
        // songDoc.ref.onSnapshot(songDocUpdate);
      });

      const exists = $('#songListList').find(`[data-firebase-group-doc-id="${doc.id}"]`).length;

      if (exists == 0) {
        Troff.addSonglistToHTML_NEW(songListObject);
      } else {
        Troff.updateSongListInHTML(songListObject);
      }
      DB.saveSonglists_new();

      $('#songListList')
        .find(`[data-firebase-group-doc-id="${doc.id}"]`)
        .addClass('verrified-in-firebase');
    })
  );

  $('#songListList')
    .find(`[data-firebase-group-doc-id]`)
    .not(`.verrified-in-firebase`)
    .each((i, v) => {
      const groupDocId = $(v).data('firebase-group-doc-id');
      setGroupAsSonglist(groupDocId);
    });

  SongToGroup.saveToDb();
};

// onSongUpdate, onSongDocUpdate <- i keep searching for theese words so...
const songDocUpdate = async function (doc: DocumentSnapshot) {
  const songDocId = doc.id;
  const groupDocId = doc.ref.parent?.parent?.id;

  if (!groupDocId) {
    return;
  }

  if (!doc.exists()) {
    const fileName = SongToGroup.getFileNameFromSongDocId(songDocId);
    const groupName = $(`[group-id="${groupDocId}"]`).text(); // TODO: fix this ($(`[group-id="${groupDocId}"]`) does not exist)
    $.notify(
      `The song "${fileName}" has been removed from the group
			${groupName}
			\nBut the song and markers are still saved on your computer!`,
      'info'
    );

    SongToGroup.remove(songDocId, undefined);
    removeGroupIndicationIfSongInNoGroup(fileName);
    return;
  }

  const songData = doc.data();
  const songKey = songData.songKey;

  const songExists = await fileHandler.doesFileExistInCache(songKey);

  if (!songExists) {
    log.i('songDocUpdate missing song - fetching from server', {
      songKey,
      navigatorOnLine: navigator.onLine,
      treatSafariDifferent,
    });
    try {
      await fileHandler.fetchAndSaveResponse(songData.fileUrl, songKey);
    } catch (error) {
      return errorHandler.fileHandler_fetchAndSaveResponse(error, songKey);
    }
    addItem_NEW_2(songKey);
    $.notify(songKey + ' was successfully added');
  }

  const fileUrl = songData.fileUrl;
  const existingMarkerInfo = nDB.get(songKey);
  const newMarkerInfo = JSON.parse(songData.jsonDataInfo);

  const existingUploadTime = existingMarkerInfo?.latestUploadToFirebase;
  const firebaseUploadTime = newMarkerInfo.latestUploadToFirebase;

  const songHaveLocalChanges = DB.popSongWithLocalChanges(groupDocId, songDocId, songKey);

  if (existingUploadTime == firebaseUploadTime) {
    // firestore does NOT have any new updates:
    if (songHaveLocalChanges) {
      // But there is local updates that should be pushed to firestore:
      saveSongDataToFirebaseGroup(songKey, groupDocId, songDocId);
    }

    return;
  }

  if (Troff.getCurrentSong() == songKey) {
    if (!doc.metadata.hasPendingWrites) {
      // The update has troffData that is not from this computer
      // should replace the current troffData without interupting
      // the current activity
      replaceTroffDataWithoutInterupt(songData);
    }
  }

  newMarkerInfo.localInformation = existingMarkerInfo?.localInformation;
  if (songHaveLocalChanges) {
    $.notify(`The song ${songKey} had local changes that where overwritten`, {
      className: 'info',
      autoHide: false,
      clickToHide: true,
    });
    // (och kanske spara undan dom markörerna i en temp-grejj om man vill ta in dom igen??? eller för komplicerat?)
  }

  nDB.set(songKey, newMarkerInfo);

  SongToGroup.add(groupDocId, songDocId, songKey, fileUrl);
};

const replaceTroffDataWithoutInterupt = function (songData: DocumentData) {
  const serverTroffData = JSON.parse(songData.jsonDataInfo);

  // Update tempo:
  $('#tapTempo').val(serverTroffData.TROFF_VALUE_tapTempo);

  // Update the states:
  Troff.clearAllStates();
  Troff.addButtonsOfStates(serverTroffData.aStates);

  // Update the markers:
  const currentMarkerId = $('.currentMarker').attr('id');
  const currentStopMarkerId = $('.currentStopMarker').attr('id');
  $('#markerList').children().remove();
  Troff.addMarkers(serverTroffData.markers);
  $('.currentMarker').removeClass('currentMarker');
  $('.currentStopMarker').removeClass('currentStopMarker');
  $('#' + currentMarkerId).addClass('currentMarker');
  $('#' + currentStopMarkerId).addClass('currentStopMarker');
  Troff.setAppropriateActivePlayRegion();

  // Update the Song info:
  if (!$('#songInfoArea').is(':focus')) {
    Troff.setInfo(serverTroffData.info);
  }

  // Update the current marker info:
  if (!$('#markerInfoArea').is(':focus')) {
    $('#markerInfoArea').val(($('#' + currentMarkerId)[0] as TroffHtmlMarkerElement).info);
  }
};

const removeGroupIndicationIfSongInNoGroup = function (songKey: string) {
  if (SongToGroup.getNrOfGroupsThisSongIsIn(songKey) > 0) {
    return;
  }

  $('#dataSongTable').find(`[data-song-key="${songKey}"]`).removeClass('groupIndication');

  if (Troff.getCurrentSong() != songKey) {
    return;
  }

  $('.groupIndicationDiv').removeClass('groupIndication');
};

/**
 * Gets the data in the group that is sent to firebase!
 * IE it does NOT include the songLIstObjectId,
 * because that is
 */
const getFirebaseGroupDataFromDialog = function (forceUserEmail: boolean) {
  const owners: string[] = [];
  $('#groupOwnerParent')
    .find('.groupDialogOwner')
    .each((i, v) => {
      owners.push($(v).val() as string);
    });

  if (forceUserEmail && firebaseUser?.email && !owners.includes(firebaseUser.email)) {
    owners.push(firebaseUser.email);
  }

  const groupData = {
    name: $('#groupDialogName').val(),
    owners: owners,
  };

  return groupData;
};

const onOnline = async function () {
  // this async sleep is because I want to wait untill possible existing
  // firestore updates get synced to the ego-computer.
  // because then Ego-offline-changes should be overwritten:
  await sleep(42);
  const changedSongList: TroffSongIdentifyer_sk[] = nDB.get('TROFF_SONGS_WITH_LOCAL_CHANGES') || [];
  // This is to send local changes IF the server does NOT
  // have new updates
  changedSongList.forEach((changedSong) => {
    // firebase
    //   .firestore()
    //   .collection("Groups")
    //   .doc(changedSong.groupDocId)
    //   .collection("Songs")
    //   .doc(changedSong.songDocId)
    //   .get()
    //   .then(songDocUpdate);
    // There is 2 callbacks,
    // it is because firebase is beign updated and the
    // it sends out the update-calblack, so all in good order!
    getDoc(doc(db, 'Groups', changedSong.groupDocId, 'Songs', changedSong.songDocId)).then(
      songDocUpdate
    );
  });
};

/*
vilka låtar har fileUrl?

de låtar som jag laddar upp?
	- nej
låtar som jag laddar ner
	- ja!
*/

/*
 * If this sing is in a group,
 * update the info in firestore for that gruop
 */
const ifGroupSongUpdateFirestore = function (songKey: string) {
  const firestoreIdentifierList = SongToGroup.getSongGroupList(songKey);
  if (firestoreIdentifierList == undefined) {
    return;
  }

  // If this song is in no groups =>
  // firestoreIdentifierList will be undefined and
  // ?. will simply return undefined instead of craching...
  firestoreIdentifierList?.forEach((fi) => {
    saveSongDataToFirebaseGroup(songKey, fi.groupDocId, fi.songDocId);
  });
};

// auth.onAuthStateChanged((user) => {
onAuthStateChanged(auth, async (user) => {
  firebaseUser = user;
  if (firebaseUser == null) {
    setUiToNotSignIn();
    return;
  }

  // The signed-in user info.
  setUiToSignIn(firebaseUser);
  const snap = await initiateAllFirebaseGroups(firebaseUser.email);
  initiateCollections(snap);
});

const mergeSongHistorys = function (
  song1?: TroffHistoryList,
  song2?: TroffHistoryList
): TroffHistoryList {
  if (song1 == null && song2 == null) throw new Error('song1 and song2 are null');
  if (song1 == null) return song2 as TroffHistoryList;
  if (song2 == null) return song1;

  const song = { fileNameUri: song1.fileNameUri } as TroffHistoryList;

  const tdioList = song1.troffDataIdObjectList;

  song2.troffDataIdObjectList.forEach((tdio: TroffDataIdObject) => {
    if (tdioList.some((td: TroffDataIdObject) => td.troffDataId === tdio.troffDataId)) {
      /* Troffdata already in troffDataIdObjectList */
      return;
    }
    tdioList.push(tdio);
  });
  song.troffDataIdObjectList = tdioList;
  return song;
};

const mergeSongListHistorys = function (
  songList1: TroffHistoryList[],
  songList2: TroffHistoryList[]
) {
  if (songList1 == null && songList2 == null) return [];
  if (songList1 == null) return songList2;
  if (songList2 == null) return songList1;

  const mergedSongList: TroffHistoryList[] = [];
  songList1.forEach((song1) => {
    const song2 = songList2.find((s) => s.fileNameUri == song1.fileNameUri);
    mergedSongList.push(mergeSongHistorys(song1, song2));
  });

  // adding the songs from songList2 that was not in songList1
  // (and thus not handled in the above forEach):
  songList2.forEach((song2) => {
    const song1 = songList1.find((s) => s.fileNameUri == song2.fileNameUri);
    if (song1 == undefined) {
      mergedSongList.push(song2);
    }
  });

  return mergedSongList;
};

function setSong2(/*fullPath, galleryId*/ path: string, songData: string): Promise<void> {
  log.d(`-> path ${path} songData ${songData} isSafari ${isSafari}`);

  Troff.pauseSong(false);

  if ($('#TROFF_SETTING_SONG_LIST_CLEAR_ON_SELECT').hasClass('active')) {
    $('#dataSongTable_filter').find('input').val('');
    ($('#dataSongTable') as any).DataTable().search('').draw();
  }

  var exitOnSelect = $('#TROFF_SETTING_SONG_LIST_EXIT_ON_SELECT').hasClass('active'),
    floatingDialog = $('#TROFF_SETTING_SONG_LIST_FLOATING_DIALOG').hasClass('active');

  if (exitOnSelect && floatingDialog) {
    closeSongDialog();
  }

  DB.setCurrentSong(path, 'pwa-galleryId');

  Troff.setWaitForLoad(path, 'pwa-galleryId');
  //fs.root.getFile(path, {create: false}, function(fileEntry) {

  var newElem = {} as HTMLAudioElement | HTMLVideoElement | HTMLImageElement | undefined;
  // show the file data
  clearContentDiv();
  const type = getFileType(path); //varför gör jag detta? jag har ju redan type!!!

  if (type == 'image') newElem = addImageToContentDiv();
  else if (type == 'audio') newElem = addAudioToContentDiv();
  else if (type == 'video') newElem = addVideoToContentDiv();

  if (!newElem) {
    log.e('setSong2: newElem is not defined!');
    IO.removeLoadScreen();
    return Promise.reject(new Error('newElem is not defined'));
  }
  // TODO: metadata? finns det något sätt jag kan få fram metadata från filerna?
  $('#currentPath').text(path);

  $('#downloadSongFromServerInProgressDialog').addClass('hidden');

  //Safari does not play well with blobs as src :(
  log.i(`Browser detection 1: isSafari ${isSafari} treatSafariDifferent ${treatSafariDifferent}`);
  log.i('setSong2 selecting media source', {
    path,
    isSafari,
    treatSafariDifferent,
    navigatorOnLine: navigator.onLine,
  });
  log.d(`setting src to ${songData}`);
  //för vanlig linux, bäst att använda songData hela tiden :)
  newElem.setAttribute('src', songData);

  const localInfo = nDB.get(path).localInformation || {};
  const nrTimesLoaded = localInfo.nrTimesLoaded || 0;
  nDB.setOnSong(path, ['localInformation', 'nrTimesLoaded'], nrTimesLoaded + 1);

  updateVersionLink(path);

  updateGroupNotification(path);

  return new Promise((resolve, reject) => {
    if (!newElem) {
      reject(new Error('newElem is not defined in the final return!'));
      return;
    }
    const timer = setTimeout(() => reject(new Error('Media load timeout')), 10000); // 10s timeout
    newElem.addEventListener(
      'canplay',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
} //end setSong2

function updateVersionLink(path: string) {
  const fileNameUri = encodeURI(path);

  function hideVersionLink() {
    $('.nr-of-versions-in-history').text(0);
    $('.nr-of-versions-in-history-parent').addClass('hidden');
    return;
  }

  const dbHistory: TroffHistoryList[] = nDB.get('TROFF_TROFF_DATA_ID_AND_FILE_NAME');
  if (dbHistory == null) {
    return hideVersionLink();
  }

  const hist = dbHistory.filter((h) => h.fileNameUri == fileNameUri);

  if (
    hist.length == 0 ||
    hist[0].troffDataIdObjectList == null ||
    hist[0].troffDataIdObjectList.length == 0
  ) {
    return hideVersionLink();
  }

  if (hist[0].troffDataIdObjectList.length == 1 && nDB.get(path).serverId != undefined) {
    // hiding the history-link since there is only one version, ant that version is in use now
    return hideVersionLink();
  }

  $('.nr-of-versions-in-history').text(hist[0].troffDataIdObjectList.length);
  $('.nr-of-versions-in-history-parent')
    .attr('href', 'find.html#f=my&id=' + fileNameUri)
    .removeClass('hidden');
}

async function createSongAudio(path: string) {
  log.d('createSongAudio ->', { path });
  let songIsV2;
  try {
    songIsV2 = await cacheImplementation.isSongV2(path);
  } catch {
    return errorHandler.fileHandler_fetchAndSaveResponse(
      new ShowUserException(`The song "${path}" does not exist.
			if you have the file named "${path}", you can
			simply import it again and the markers will be connected with the file!`),
      path
    );
  }
  log.d('createSongAudio: cacheImplementation.isSongV2 result', {
    path,
    isSongV2: songIsV2,
    isSafari,
  });

  if (songIsV2) {
    try {
      var songData = await cacheImplementation.getSong(path);

      log.i('createSongAudio: obtained media URL', {
        path,
        source: songIsV2 ? 'cacheImplementation.getSong' : 'fileHandler.getObjectUrlFromFile',
        urlScheme: songData.split(':', 1)[0],
      });
      await setSong2(path, songData);
      log.d('createSongAudio: setSong2 result', {
        path,
        source: songIsV2 ? 'cacheImplementation.getSong' : 'fileHandler.getObjectUrlFromFile',
        urlScheme: songData.split(':', 1)[0],
      });
    } catch (e) {
      log.e('createSongAudio:error: No song selected yet: ', e);
    }
  } else {
    try {
      const v3SongObjectUrl = await fileHandler.getObjectUrlFromFile(path);

      log.i('createSongAudio obtained media URL', {
        path,
        source: songIsV2 ? 'cacheImplementation.getSong' : 'fileHandler.getObjectUrlFromFile',
        urlScheme: v3SongObjectUrl.split(':', 1)[0],
      });

      await setSong2(path, v3SongObjectUrl);
    } catch (e) {
      errorHandler.fileHandler_sendFile(e, path);
    }
  }
}

/**
 * Denna funktion används när användaren själv lägger till låtar i en songList
 * antingen via drag and drop, eller selecten
 * Den används INTE om groupDialog sparas,
 * eller om låtarna läggs till via en firebase update!
 * @param {array of songs} songs
 * @param {jQuery button} $target
 */
function addSongsToSonglist(songs: SonglistSongInfo[] | DirectoryListObject[], $target: JQuery) {
  var songAlreadyExists,
    songList = $target.data('songList');

  $.each(songs, function (i, song) {
    var dataInfo: DirectoryListObject = (song as SonglistSongInfo).data || song; // todo: fixa detta!
    songAlreadyExists =
      songList.songs.filter(function (value: any) {
        return value.galleryId == dataInfo.galleryId && value.fullPath == dataInfo.fullPath;
      }).length > 0;

    if (songAlreadyExists) {
      $.notify((song as any).fullPath + ' is already in ' + songList.name, 'info');
      return;
    }

    songList.isDirectory = false;
    songList.songs.push(song);

    $target.data('songList', songList);

    notifyUndo(dataInfo.fullPath + ' was added to ' + songList.name, function () {
      var undo_songList = $target.data('songList');

      undo_songList.songs = undo_songList.songs.filter(function (value: any) {
        return !(value.galleryId == dataInfo.galleryId && value.fullPath == dataInfo.fullPath);
      });

      DB.saveSonglists_new();
    });
    const groupDocId = $target.data('firebaseGroupDocId');
    if (groupDocId != undefined) {
      const songDocId = undefined;
      saveSongDataToFirebaseGroup(dataInfo.fullPath, groupDocId, songDocId);
    }
  });
  DB.saveSonglists_new();
}

//******************************************************************************
//* End FS - File System ----------------------------------------------------- *
//******************************************************************************

var Troff = new TroffClass();
var DB = new DBClass();
var IO = new IOClass();
var Rate = new RateClass();

window.addEventListener('hashchange', Troff.checkHashAndGetSong);

$(document).ready(async function () {
  if (isIpad || isIphone) {
    $('#TROFF_SETTING_UI_VOLUME_SLIDER_SHOW').removeClass('active');
  }

  IO.removeLoadScreenSoon();

  // include external HTML-files:
  const includes = $('[data-include]');
  await loadExternalHtml(includes);

  initSongTable();
  await DB.cleanDB();
  DB.getAllSonglists();
  DB.getZoomDontShowAgain();
  IO.startFunc();
  Rate.startFunc();
  Troff.recallCurrentStateOfSonglists();
  DB.getShowSongDialog();
  await initEnvironment();

  firebaseWrapper.onUploadProgressUpdate = function (progress) {
    $('#uploadPercentDone').text(Math.trunc(progress));
  };
  firebaseWrapper.onDownloadProgressUpdate = function (progress) {
    $('#downloadPercentDone').text(Math.trunc(progress));
  };

  await Troff.checkHashAndGetSong();
  await Troff.initFileApiImplementation();
});

async function initEnvironment() {
  setSentryEnvironment(environment.environment);
  const manifest = await getManifest();
  $('.app-version-number').text(manifest.version);
  setSentryVersion(manifest.version);
  if (nDB.get(COOKIE_CONSENT_ACCEPTED)) {
    addAndStartSentry();
  }
  log.i('manifest.version', manifest.version);

  if (environment.banner.show) {
    $('#banner').removeClass('hidden');
    $('#banner').find('#banner-text').text(environment.banner.text);
  }

  if (environment.showHiddenInProd) {
    $('.hidden-in-prod').removeClass('hidden').removeClass('hidden-in-prod');
  }
}

//note, in this case we want "function", NOT short hand "() =>"
$.fn.removeClassStartingWith = function (filter: string) {
  this.each(function () {
    const $this = $(this);
    const classesToRemove = ($this.attr('class') || '')
      .split(' ')
      .filter((className) => className.startsWith(filter))
      .join(' ');
    $this.removeClass(classesToRemove);
  });
  return this; // Ensure chaining works
};

export {
  Troff,
  addSongsToSonglist,
  DB,
  IO,
  Rate,
  doSignOut,
  mergeSongListHistorys,
  googleSignIn,
  onOnline,
  createSongAudio,
  ifGroupSongUpdateFirestore,
  updateVersionLink,
  songDocUpdate,
  getFirebaseGroupDataFromDialog,
  firebaseUser,
};
