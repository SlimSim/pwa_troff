/* eslint eqeqeq: "off" */
import { nDB } from './assets/internal/db.js';
import { st } from './assets/internal/st-script.js';
import {
  db,
  doc,
  deleteDoc,
  ref,
  listAll,
  deleteObject,
  storage,
  setDoc,
} from './services/firebaseClient.js';
import {
  Troff,
  addSongsToSonglist,
  DB,
  IO,
  createSongAudio,
  ifGroupSongUpdateFirestore,
  getFirebaseGroupDataFromDialog,
  firebaseUser,
} from './script.js';
import { addItem_NEW_2 } from './songManagement.js';
import { removeSongDataFromFirebaseGroup } from './services/firebase.js';
import { fileHandler, backendService } from './services/file.js';
import { notifyUndo } from './assets/internal/notify-js/notify.config.js';
import { cacheImplementation } from './services/FileApiImplementation.js';
import {
  updateUploadedHistory,
  addGroupOwnerRow,
  emptyGroupDialog,
  moveSongPickerToFloatingState,
  songListDialogOpenExisting,
  dropSongOnSonglist,
  allowDrop,
  onDragleave,
  moveSongPickerToAttachedState,
  filterSongTable,
  getFilterDataList,
  sortAndValue,
} from './script0.js';
import { dataTableColumnPicker } from './dataTable.js';
import { gtag } from './services/analytics.js';
import { isSafari } from './utils/browserEnv.js';
import { errorHandler } from './scriptErrorHandler.js';
import log from './utils/log.js';
import { blurHack, removeLocalInfo } from './utils/utils.js';
import {
  TROFF_SETTING_SET_THEME,
  TROFF_SETTING_EXTENDED_MARKER_COLOR,
  TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR,
  TROFF_SETTING_ENTER_GO_TO_MARKER_BEHAVIOUR,
  TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR,
  TROFF_SETTING_SPACE_GO_TO_MARKER_BEHAVIOUR,
  TROFF_SETTING_ENTER_RESET_COUNTER,
  TROFF_SETTING_SPACE_RESET_COUNTER,
  TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER,
  TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR,
  TROFF_SETTING_PLAY_UI_BUTTON_GO_TO_MARKER_BEHAVIOUR,
  TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR,
  TROFF_SETTING_ON_SELECT_MARKER_GO_TO_MARKER,
  TROFF_SETTING_SONG_COLUMN_TOGGLE,
  TROFF_CURRENT_STATE_OF_SONG_LISTS,
  TROFF_TROFF_DATA_ID_AND_FILE_NAME,
  MARKER_COLOR_PREFIX,
  DATA_TABLE_COLUMNS,
} from './constants/constants.js';
import {
  DirectoryListObject,
  SonglistSongInfo,
  State,
  State_WithTime,
  TroffData,
  TroffFirebaseGroupIdentifyer,
  TroffHistoryList,
  TroffManualImportExport,
  TroffMarker,
  TroffObjectLocal,
  TroffStateOfSonglists,
} from './types/troff.js';
import { IOInput } from './types/io.js';

function clickSongList_NEW(event: JQuery.ClickEvent) {
  blurHack();
  var $target = $(event.target),
    data = $target.data('songList'),
    galleryId = $target.attr('data-gallery-id');

  $('#songListAll').removeClass('selected');

  if ($('#TROFF_SETTING_SONG_LIST_ADDITIVE_SELECT').hasClass('active')) {
    if (data || galleryId) {
      $target.toggleClass('active');
      $('#songListsList').find('button').removeClass('selected');
    } else {
      // It only enters here IF the All songs-button is pressed :)
      $('#songListsList').find('button').removeClass('selected').removeClass('active');
      $target.addClass('selected');
    }
  } else {
    $('#songListsList').find('button').removeClass('selected').removeClass('active');
    $target.addClass('selected');

    $('#headArea').removeClassStartingWith('bg-');
    $('#songlistIcon').removeClassStartingWith('fa-');
    $('#songlistName').text('');
    $('#songlistInfo').text('').addClass('hidden');

    if (data && data.firebaseGroupDocId) {
      $('#headArea').addClass(data.color);
      $('#songlistIcon').addClass(data.icon || 'fa-users');
      $('#songlistName').text(data.name);
      $('#songlistInfo').removeClass('hidden').text(data.info);
    }
  }

  Troff.saveCurrentStateOfSonglists();

  filterSongTable(getFilterDataList());
}

class TroffClass {
  strCurrentSong: string;
  strCurrentGalleryId: string;
  startTime: number;
  previousTime: number;
  time: number;
  nrTaps: number;
  m_zoomStartTime: number;
  m_zoomEndTime: number | null;
  stopTimeout: NodeJS.Timeout | undefined;
  stopInterval: NodeJS.Timeout | undefined;
  iOSHasLoadedSong: boolean;

  constructor() {
    this.strCurrentSong = '';
    this.strCurrentGalleryId = '';
    this.startTime = 0; // unused?
    this.previousTime = 0; // unused?
    this.time = 0; // unused?
    this.nrTaps = 0;
    this.m_zoomStartTime = 0;
    this.m_zoomEndTime = null;
    this.iOSHasLoadedSong = false;
  }

  addAskedSongsToCurrentSongList = (
    event: JQuery.ClickEvent,
    songKeys: JQuery<string>,
    $songList: JQuery
  ) => {
    $(event.target).addClass('active');
    $('#addAddedSongsToSongList_doNotAdd').addClass('hidden');
    $('#addAddedSongsToSongList_done').removeClass('hidden');

    const songs: SonglistSongInfo[] = [];

    songKeys.each((i, songKey) => {
      songs.push({
        name: songKey,
        data: {
          galleryId: 'pwa-galleryId',
          fullPath: songKey,
        },
      });
    });

    addSongsToSonglist(songs, $songList);

    const nrPossibleSongListsToAddTo = $('#addAddedSongsToSongList_currentSongLists').children()
      .length;
    const nrAlreadySongListsToAddTo = $('#addAddedSongsToSongList_currentSongLists .active').length;
    if (nrPossibleSongListsToAddTo == nrAlreadySongListsToAddTo) {
      $('#addAddedSongsToSongList_songs').empty();
      $('#addAddedSongsToSongList').addClass('hidden');
    }

    filterSongTable(getFilterDataList());
  };

  askIfAddSongsToCurrentSongList = (key: string) => {
    if ($('#songListAll').hasClass('selected')) {
      return;
    }

    $('#addAddedSongsToSongList_doNotAdd').removeClass('hidden');
    $('#addAddedSongsToSongList_done').addClass('hidden');
    $('#addAddedSongsToSongList').removeClass('hidden');
    $('#addAddedSongsToSongList_songs').append($('<li>').text(key));
    $('#addAddedSongsToSongList_currentSongLists').empty();

    const songKeys = $('#addAddedSongsToSongList_songs')
      .children()
      .map((i, v) => $(v).text());

    $('.songlist.selected, .songlist.active').each((i, songList) => {
      $('#addAddedSongsToSongList_currentSongLists').append(
        $('<li>').append(
          $('<button>')
            .addClass('regularButton')
            .text('Add songs to "' + $(songList).text() + '"')
            .click((event) => this.addAskedSongsToCurrentSongList(event, songKeys, $(songList)))
        )
      );
    });
  };

  emptyAddAddedSongsToSongList_songs = (event: JQuery.ClickEvent) => {
    if (!$(event.target).hasClass('emptyAddAddedSongsToSongList_songs')) {
      return;
    }
    $('#addAddedSongsToSongList_songs').empty();
  };

  initFileApiImplementation = async () => {
    log.d('initFileApiImplementation ->');
    $('#fileUploader').on('change', (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (files == null) {
        return;
      }
      fileHandler.handleFiles(files, (key, file) => {
        if (nDB.get(key) == null) {
          const newSongObject = DB.fixSongObject();
          newSongObject.localInformation = {
            addedFromThisDevice: true,
          };
          newSongObject.fileData.lastModified = file.lastModified;
          newSongObject.fileData.size = file.size;
          nDB.set(key, newSongObject);
        } else {
          nDB.setOnSong(key, ['localInformation', 'addedFromThisDevice'], true);
        }

        this.askIfAddSongsToCurrentSongList(key);
        addItem_NEW_2(key);
        if (!$('#dataSongTable_wrapper').find('tr').hasClass('selected')) {
          this.selectSongInSongList(key);
          log.d('initFileApiImplementation: -> createSongAudio', { key });
          createSongAudio(key);
        }

        $.notify(key + ' was successfully added');
      });
    });

    //loadAllFiles:
    const keys = await cacheImplementation.getAllKeys();
    keys.forEach(addItem_NEW_2);
  };

  setUrlToSong = (serverId: string | undefined, fileName: string | null) => {
    'use strict';
    if (serverId === undefined) {
      if (!window.location.hash) {
        return;
      }
      // remove url-hash completely:
      history.pushState('', document.title, window.location.pathname + window.location.search);
      return;
    }
    if (fileName === null) {
      return;
    }
    window.location.hash = this.createHash(serverId, fileName);
  };

  createHash = (serverId: string | number, fileName: string) => {
    return '#' + serverId + '&' + encodeURI(fileName);
  };

  uploadSongToServer = async () => {
    'use strict';

    // show a pop-up that says
    // "song is being uploaded, will let you know when it is done"
    // alt 1, please do not close this app in the mean time
    // alt 2, please do not switch song in the mean time....

    const songKey = this.getCurrentSong();

    $('#uploadSongToServerInProgressDialog').removeClass('hidden');
    try {
      const markerObject = nDB.get(songKey);
      const fakeTroffData = {
        markerJsonString: JSON.stringify(markerObject),
      };

      //removing localInformation before sending it to server:
      const publicData = removeLocalInfo(markerObject);

      const resp = await fileHandler.sendFile(songKey, publicData);

      nDB.setOnSong(songKey, 'serverId', resp.id);
      nDB.setOnSong(songKey, 'fileUrl', resp.fileUrl);

      this.saveDownloadLinkHistory(resp.id, resp.fileName, fakeTroffData);

      if (songKey == this.getCurrentSong()) {
        this.setUrlToSong(String(resp.id), resp.fileName);
      }

      $('#uploadSongToServerInProgressDialog').addClass('hidden');
      $('#shareSongUrl').val(window.location.origin + this.createHash(resp.id, resp.fileName));
      $('#doneUploadingSongToServerDialog_songName').text(songKey);
      $('#doneUploadingSongToServerLink').attr('href', '/find.html#id=' + resp.fileName);
      $('#doneUploadingSongToServerDialog').removeClass('hidden');
    } catch (error) {
      return errorHandler.fileHandler_sendFile(error, songKey);
    }
  };

  buttCopyUrlToClipboard = () => {
    const url = $('#doneUploadingSongToServerDialog').find('#shareSongUrl').val() as string;

    IO.copyTextToClipboard(url);
  };

  showUploadSongToServerDialog = () => {
    if (window.location.hash) {
      $('#shareSongUrl').val(window.location.href);
      $('.showOnUploadComplete').addClass('hidden');
      $('.showOnSongAlreadyUploaded').removeClass('hidden');

      $('#doneUploadingSongToServerDialog_songName').text(this.getCurrentSong());
      $('#doneUploadingSongToServerLink').attr('href', '/find.html#id=' + this.getCurrentSong());
      $('#doneUploadingSongToServerDialog').removeClass('hidden');
    } else {
      if (!this.getCurrentSong()) {
        IO.alert(
          'No Song',
          'You do not have a song to upload yet.<br />Add a song to Troff and then try again!'
        );
        return;
      }

      if (!window.navigator.onLine) {
        IO.alert(
          'Offline',
          'You appear to be offline, please wait until you have an internet connection and try again then.'
        );
        return;
      }

      $('.showOnUploadComplete').removeClass('hidden');
      $('.showOnSongAlreadyUploaded').addClass('hidden');
      $('#uploadSongToServerDialog').removeClass('hidden');
    }
  };

  selectSongInSongList = (fileName: string) => {
    $('#dataSongTable').find('tbody tr').removeClass('selected');
    $('[data-song-key="' + fileName + '"]').addClass('selected');
  };

  importTroffDataToExistingSong_importNew = async () => {
    const fileName = $('#importTroffDataToExistingSong_fileName').val() as string;
    const serverId = $('#importTroffDataToExistingSong_serverId').val() as string;

    this.showMarkersDownloadInProgressDialog(fileName);
    const hash = '#' + serverId + '&' + encodeURI(fileName);
    gtag('event', 'Download Markers', {
      event_category: 'Perform change',
      event_label: hash,
    });

    let troffData: TroffData;
    try {
      troffData = await backendService.getTroffData(serverId, fileName);
    } catch (error) {
      return errorHandler.backendService_getTroffData(error, serverId, fileName);
    }

    this.saveDownloadLinkHistory(Number(serverId), fileName, troffData);

    const markers = JSON.parse(troffData.markerJsonString);
    markers.serverId = serverId;
    markers.fileUrl = troffData.fileUrl;
    const oldMarkers = nDB.get(troffData.fileName) || {};
    markers.localInformation = oldMarkers.localInformation;

    try {
      nDB.set(troffData.fileName, markers);
    } catch (error) {
      return errorHandler.fileHandler_fetchAndSaveResponse(error, fileName);
    }

    log.d('importTroffDataToExistingSong_importNew: -> createSongAudio', {
      fileName: troffData.fileName,
    });
    await createSongAudio(troffData.fileName);
    this.selectSongInSongList(troffData.fileName);
  };

  importTroffDataToExistingSong_merge = async () => {
    const fileName = $('#importTroffDataToExistingSong_fileName').val() as string;
    const serverId = $('#importTroffDataToExistingSong_serverId').val() as string;

    this.showMarkersDownloadInProgressDialog(fileName);
    const hash = '#' + serverId + '&' + encodeURI(fileName);
    gtag('event', 'Download Markers', {
      event_category: 'Perform change',
      event_label: hash,
    });

    let markersFromServer;
    try {
      const troffDataFromServer = await backendService.getTroffData(serverId, fileName);
      markersFromServer = JSON.parse(troffDataFromServer.markerJsonString);

      this.saveDownloadLinkHistory(Number(serverId), fileName, troffDataFromServer);
    } catch (error) {
      return errorHandler.backendService_getTroffData(error, serverId, fileName);
    }

    log.d('importTroffDataToExistingSong_merge: -> createSongAudio', { fileName });
    await createSongAudio(fileName);
    this.selectSongInSongList(fileName);

    const aoStates: State_WithTime[] = [];
    for (let i = 0; i < markersFromServer.aStates.length; i++) {
      const parsedState = JSON.parse(markersFromServer.aStates[i]);
      aoStates.push(
        this.replaceMarkerIdWithMarkerTimeInState(parsedState, markersFromServer.markers)
      );
    }

    const oImport = {} as TroffManualImportExport;
    oImport.strSongInfo = markersFromServer.info;
    oImport.aoStates = aoStates;
    oImport.aoMarkers = markersFromServer.markers;

    $('#something').click((a, b) => {
      return b + 1;
    });

    setTimeout(() => {
      this.doImportStuff(oImport);
    }, 42);
  };

  importTroffDataToExistingSong_keepExisting = async () => {
    const fileName = $('#importTroffDataToExistingSong_fileName').val() as string;

    log.d('importTroffDataToExistingSong_keepExisting: -> createSongAudio', { fileName });
    await createSongAudio(fileName);
    this.selectSongInSongList(fileName);
  };

  saveDownloadLinkHistory = (
    serverTroffDataId: number,
    fileName: string,
    troffData: { markerJsonString: string }
  ) => {
    const fileNameUri = encodeURI(fileName);

    const markerObject = JSON.parse(troffData.markerJsonString);

    const fileData = markerObject.fileData;

    let displayName = fileName;
    const nrMarkers = markerObject.markers.length;
    const nrStates = markerObject.aStates ? markerObject.aStates.length : 0;
    const info = markerObject.info.substring(0, 99);
    let genre = '';
    let tags = '';

    if (fileData) {
      displayName = fileData.customName || fileData.choreography || fileData.title || displayName;
      genre = fileData.genre || genre;
      tags = fileData.tags || tags;
    }

    const serverSongs: TroffHistoryList[] = nDB.get(TROFF_TROFF_DATA_ID_AND_FILE_NAME);

    const troffDataIdObject = {
      troffDataId: serverTroffDataId,
      firstTimeLoaded: new Date().getTime(),
      displayName: displayName,
      nrMarkers: nrMarkers,
      nrStates: nrStates,
      infoBeginning: info,
      genre: genre,
      tags: tags,
    };

    const serverSong = {
      fileNameUri: fileNameUri,
      troffDataIdObjectList: [troffDataIdObject],
    };

    if (!serverSongs) {
      nDB.set(TROFF_TROFF_DATA_ID_AND_FILE_NAME, [serverSong]);
      updateUploadedHistory();
      return;
    }

    const existingServerSong = serverSongs.find((ss) => ss.fileNameUri == fileNameUri);

    if (!existingServerSong) {
      serverSongs.push(serverSong);
      nDB.set(TROFF_TROFF_DATA_ID_AND_FILE_NAME, serverSongs);
      updateUploadedHistory();
      return;
    }

    if (
      !existingServerSong.troffDataIdObjectList.some((td) => td.troffDataId == serverTroffDataId)
    ) {
      existingServerSong.troffDataIdObjectList.push(troffDataIdObject);
      nDB.set(TROFF_TROFF_DATA_ID_AND_FILE_NAME, serverSongs);
      updateUploadedHistory();
      return;
    }
  };

  showImportData = (fileName: string, serverId: string | number) => {
    'use strict';
    $('#importTroffDataToExistingSong_songName').text(fileName);
    $('#importTroffDataToExistingSong_fileName').val(fileName);
    $('#importTroffDataToExistingSong_serverId').val(serverId);
    $('#downloadSongFromServerInProgressDialog').addClass('hidden');
    $('#importTroffDataToExistingSongDialog').removeClass('hidden');
    IO.removeLoadScreen();
  };

  showMarkersDownloadInProgressDialog = (songName: string) => {
    $('.downloadSongFromServerInProgressDialog_songName').text(songName);
    $('#downloadSongFromServerInProgressDialog').removeClass('hidden');
    $('.downloadSongFromServerInProgressDialog_song').addClass('hidden');
    $('.downloadSongFromServerInProgressDialog_markers').removeClass('hidden');
  };

  showDownloadSongFromServerInProgress = (songName: string) => {
    'use strict';
    $('#downloadPercentDone').text(0);
    $('.downloadSongFromServerInProgressDialog_songName').text(songName);
    $('#downloadSongFromServerInProgressDialog').removeClass('hidden');
    $('.downloadSongFromServerInProgressDialog_song').removeClass('hidden');
    $('.downloadSongFromServerInProgressDialog_markers').addClass('hidden');
    IO.removeLoadScreen();
  };

  downloadSongFromServerButDataFromCacheExists = async (
    fileName: string,
    serverId: string,
    troffDataFromCache: TroffObjectLocal
  ) => {
    'use strict';

    const fileDoesExists = await fileHandler.doesFileExistInCache(fileName);

    if (fileDoesExists) {
      if (serverId == troffDataFromCache.serverId) {
        const currentSongTroffData = nDB.get(this.getCurrentSong());
        if (currentSongTroffData && currentSongTroffData.serverId == serverId) {
          return;
        }
        log.d('downloadSongFromServerButDataFromCacheExists: -> createSongAudio', { fileName });
        await createSongAudio(fileName);
        this.selectSongInSongList(fileName);
      } else {
        this.showImportData(fileName, serverId);
      }
      return;
    }

    this.showDownloadSongFromServerInProgress(fileName);
    const hash = '#' + serverId + '&' + encodeURI(fileName);
    gtag('event', 'Download Song', {
      event_category: 'Perform change',
      event_label: hash,
    });

    let troffData;
    try {
      troffData = await backendService.getTroffData(serverId, fileName);
    } catch (error) {
      return errorHandler.backendService_getTroffData(error, serverId, fileName);
    }

    this.saveDownloadLinkHistory(Number(serverId), fileName, troffData);

    try {
      await fileHandler.fetchAndSaveResponse(troffData.fileUrl, fileName);
    } catch (error) {
      return errorHandler.fileHandler_fetchAndSaveResponse(error, fileName);
    }

    if (serverId == troffDataFromCache.serverId) {
      log.d('downloadSongFromServerButDataFromCacheExists: -> createSongAudio', { fileName });
      await createSongAudio(fileName);
      addItem_NEW_2(fileName);

      $.notify(fileName + ' was successfully added');
    } else {
      this.showImportData(fileName, serverId);
    }
  };

  downloadSongFromServer = async (hash: string) => {
    'use strict';
    log.d('downloadSongFromServer -> hash:', hash);
    const [serverId, fileNameURI] = hash.substr(1).split('&');
    const fileName = decodeURI(fileNameURI);
    const troffDataFromCache = nDB.get(fileName);
    let troffData;

    if (troffDataFromCache != null) {
      return this.downloadSongFromServerButDataFromCacheExists(
        fileName,
        serverId,
        troffDataFromCache
      );
    }
    this.showDownloadSongFromServerInProgress(fileName);
    gtag('event', 'Download Song', {
      event_category: 'Perform change',
      event_label: hash,
    });

    try {
      troffData = await backendService.getTroffData(serverId, fileName);
    } catch (error) {
      return errorHandler.backendService_getTroffData(error, serverId, fileName);
    }
    this.saveDownloadLinkHistory(Number(serverId), fileName, troffData);

    const markers = JSON.parse(troffData.markerJsonString);
    markers.serverId = serverId;
    markers.fileUrl = troffData.fileUrl;

    try {
      await Promise.all([
        fileHandler.fetchAndSaveResponse(troffData.fileUrl, troffData.fileName),
        nDB.set(troffData.fileName, markers),
      ]);
    } catch (error) {
      return errorHandler.fileHandler_fetchAndSaveResponse(error, fileName);
    }

    log.d('downloadSongFromServer: -> createSongAudio', { fileName });
    await createSongAudio(troffData.fileName);
    this.askIfAddSongsToCurrentSongList(troffData.fileName);
    addItem_NEW_2(troffData.fileName);
    $.notify(troffData.fileName + ' was successfully added');
  };

  editSongDialogSave = () => {
    const key = $('#editSongFile').val() as string;
    const songObject = nDB.get(key);

    songObject.fileData.customName = $('#editSongCustomName').val();
    songObject.fileData.choreography = $('#editSongChoreography').val();
    songObject.fileData.choreographer = $('#editSongChoreographer').val();
    songObject.fileData.title = $('#editSongTitle').val();
    songObject.fileData.artist = $('#editSongArtist').val();
    songObject.fileData.album = $('#editSongAlbum').val();
    songObject.fileData.genre = $('#editSongGenre').val();
    songObject.fileData.tags = $('#editSongTags').val();

    IO.updateCellInDataTable('DISPLAY_NAME', $('#editSongDisplayName').val() as string, key);
    IO.updateCellInDataTable('CUSTOM_NAME', songObject.fileData.customName, key);
    IO.updateCellInDataTable('CHOREOGRAPHY', songObject.fileData.choreography, key);
    IO.updateCellInDataTable('CHOREOGRAPHER', songObject.fileData.choreographer, key);
    IO.updateCellInDataTable('TITLE', songObject.fileData.title, key);
    IO.updateCellInDataTable('ARTIST', songObject.fileData.artist, key);
    IO.updateCellInDataTable('ALBUM', songObject.fileData.album, key);
    IO.updateCellInDataTable('GENRE', songObject.fileData.genre, key);
    IO.updateCellInDataTable('TAGS', songObject.fileData.tags, key);

    nDB.set(key, songObject);
    ifGroupSongUpdateFirestore(key);
  };

  onEditUpdateName = () => {
    const displayName =
      $('#editSongCustomName').val() ||
      $('#editSongChoreography').val() ||
      $('#editSongTitle').val() ||
      this.pathToName($('#editSongFile').val() as string);
    $('#editSongDisplayName').val(displayName);
  };

  enterWritableField = () => {
    IO.setEnterFunction((event: KeyboardEvent) => {
      if (event.ctrlKey) {
        //Ctrl+Enter will exit
        blurHack();
        return false;
      }
      return true;
    });
  };

  exitWritableField = () => {
    IO.clearEnterFunction();
  };

  recallFloatingDialog = () => {
    const floatingDialog = nDB.get('TROFF_SETTING_SONG_LIST_FLOATING_DIALOG');
    if (floatingDialog) {
      moveSongPickerToFloatingState();
    } else {
      moveSongPickerToAttachedState();
    }
  };

  recallSongColumnToggle = (callback: () => void) => {
    const columnToggle = nDB.get(TROFF_SETTING_SONG_COLUMN_TOGGLE);
    if (columnToggle === undefined) {
      setTimeout(() => {
        this.recallSongColumnToggle(callback);
      }, 42);
      return;
    }

    DATA_TABLE_COLUMNS.list.forEach((v, i) => {
      if (v.hideFromUser) {
        const column = ($('#dataSongTable') as any)
          .DataTable()
          .column(DATA_TABLE_COLUMNS.getPos(v.id));
        column.visible(false);
        return;
      }

      $('#columnToggleParent').append(
        $('<input>')
          .attr('type', 'button')
          .attr('data-column', i)
          .addClass('stOnOffButton')
          .toggleClass('active', columnToggle[v.id])
          .val(v.header)
          .click(dataTableColumnPicker)
      );
    });
    callback();
  };

  toggleExtendedMarkerColor = () => {
    if ($('#markerList').hasClass('extended-color')) {
      $('#markerList').removeClass('extended-color');
      $('#toggleExtendedMarkerColor').removeClass('active');
      DB.saveVal(TROFF_SETTING_EXTENDED_MARKER_COLOR, false);
    } else {
      $('#markerList').addClass('extended-color');
      $('#toggleExtendedMarkerColor').addClass('active');
      DB.saveVal(TROFF_SETTING_EXTENDED_MARKER_COLOR, true);
    }
  };

  recallExtendedMarkerColor = () => {
    const extend = nDB.get(TROFF_SETTING_EXTENDED_MARKER_COLOR);
    if (extend) {
      $('#markerList').addClass('extended-color');
      $('#toggleExtendedMarkerColor').addClass('active');
    }
  };

  toggleExtraExtendedMarkerColor = () => {
    if ($('#markerList').hasClass('extra-extended')) {
      $('#markerList').removeClass('extra-extended');
      $('#toggleExtraExtendedMarkerColor').removeClass('active');
      DB.saveVal(TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR, false);
    } else {
      $('#markerList').addClass('extra-extended');
      $('#toggleExtraExtendedMarkerColor').addClass('active');
      DB.saveVal(TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR, true);
    }
  };

  recallExtraExtendedMarkerColor = () => {
    const extend = nDB.get(TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR);
    if (extend || extend === null) {
      $('#markerList').addClass('extra-extended');
      $('#toggleExtraExtendedMarkerColor').addClass('active');
    }
  };

  updateHrefForTheme = (theme: string) => {
    'use strict';
    $('body')
      .removeClassStartingWith('theme-')
      .addClass('theme-' + theme);
  };

  setTheme = (event: JQuery.ClickEvent) => {
    var $target = $(event.target),
      theme = $target.data('theme');
    $target.closest('#themePickerParent').find('.selected').removeClass('selected');
    $target.addClass('selected');
    this.updateHrefForTheme(theme);

    DB.saveVal(TROFF_SETTING_SET_THEME, theme);
  };

  recallGlobalSettings = () => {
    this.recallTheme();
    this.recallExtendedMarkerColor();
    this.recallExtraExtendedMarkerColor();
    this.recallSongColumnToggle(() => {
      this.recallFloatingDialog();
    });
  };

  recallTheme = () => {
    const theme = nDB.get(TROFF_SETTING_SET_THEME) || 'col1';
    $('#themePickerParent')
      .find('[data-theme="' + theme + '"]')
      .addClass('selected');
    this.updateHrefForTheme(theme);
  };

  closeSettingsDialog = () => {
    $('#outerSettingPopUpSquare').addClass('hidden');
  };
  openSettingsDialog = () => {
    $('#outerSettingPopUpSquare').removeClass('hidden');
    gtag('event', 'Open Settings', {
      event_category: 'Clicking Button',
      event_label: 'Settings Dialog',
    });
  };

  //Public variables:
  dontShowZoomInstructions = false;

  firstTimeUser = () => {
    $('#firstTimeUserDialog').removeClass('hidden');
  };

  // this is regarding the "play in fullscreen" - button
  setPlayInFullscreen = (bPlayInFullscreen: boolean) => {
    if (bPlayInFullscreen) {
      $('#playInFullscreenButt').addClass('active');
    } else {
      $('#playInFullscreenButt').removeClass('active');
    }
  };

  setMirrorImage = (bMirrorImage: boolean) => {
    if (bMirrorImage) {
      $('#mirrorImageButt').addClass('active');
      $('#videoBox').addClass('flip-horizontal');
    } else {
      $('#mirrorImageButt').removeClass('active');
      $('#videoBox').removeClass('flip-horizontal');
    }
  };

  // this is regarding the "play in fullscreen" - button
  playInFullscreenChanged = () => {
    var butt = document.querySelector('#playInFullscreenButt');

    if (!butt) return;
    butt.classList.toggle('active');

    var bFullScreen = butt.classList.contains('active');
    nDB.setOnSong(this.strCurrentSong, 'bPlayInFullscreen', bFullScreen);

    blurHack();
  };

  mirrorImageChanged = (event: JQuery.ClickEvent) => {
    var bMirrorImage = !$(event.target).hasClass('active');
    nDB.setOnSong(this.strCurrentSong, 'bMirrorImage', bMirrorImage);
    this.setMirrorImage(bMirrorImage);

    blurHack();
  };

  setImageLayout = () => {
    $('body').addClass('pictureActive');
  };
  setAudioVideoLayout = () => {
    $('body').removeClass('pictureActive');
  };

  // this is regarding the f-key, IE- the actual fullscreen
  forceFullscreenChange = () => {
    var videoBox = document.querySelector('#videoBox');
    if (!videoBox) return;
    //		var infoSection = document.querySelector('#infoSection');
    if (videoBox.classList.contains('fullscreen')) {
      videoBox.classList.remove('fullscreen');
    } else {
      videoBox.classList.add('fullscreen');
    }
  };

  // this is regarding the f/esc-key, IE- the actual fullscreen
  forceNoFullscreen = () => {
    var videoBox = document.querySelector('#videoBox');
    if (!videoBox) return;
    videoBox.classList.remove('fullscreen');
  };

  /* this funciton is called when the full song/video is loaded,
   * it should thus do the things that conect player to this...
   */
  setMetadata = (media: HTMLMediaElement) => {
    const key = this.getCurrentSong();

    let songObject = nDB.get(key);

    if (songObject == null) {
      songObject = DB.fixSongObject();
    }
    if (songObject.fileData == null) {
      songObject.fileData = {};
    }
    if (songObject.fileData.duration == null) {
      songObject.fileData.duration = media.duration;
      nDB.set(key, songObject);
      IO.updateCellInDataTable(
        'DURATION',
        sortAndValue(media.duration, this.secToDisp(media.duration))
      );
    }
    log.d('setMetadata timeBar sync', {
      timeBarValue: $('#timeBar').val(),
      currentTime: media.currentTime,
      max: media.duration,
    });
    (document.getElementById('timeBar') as any).max = media.duration;
    $('#maxTime')[0].innerHTML = this.secToDisp(media.duration);

    // TODO: Flytta allt i getSongMedaDataOf hit, där det hör hemma, jag har ju lixom songObject!
    DB.getSongMetaDataOf(key);

    $('#currentArtist').text(songObject.fileData.choreographer || songObject.fileData.artist);
    $('#currentSong').text(
      songObject.fileData.customName ||
        songObject.fileData.choreography ||
        songObject.fileData.title ||
        this.pathToName(key)
    );
    $('#currentAlbum').text(songObject.fileData.album);

    media.addEventListener('timeupdate', this.timeupdateAudio);
    IO.removeLoadScreen();
  };

  setMetadataImage = () => {
    IO.removeLoadScreen();
    DB.getImageMetaDataOf(this.getCurrentSong());
  };

  getStandardMarkerInfo = () => {
    return (
      'This text is specific for every selected marker. ' +
      'Notes written here will be automatically saved.' +
      '\n\nUse this area for things regarding this marker.'
    );
  };

  getWaitBetweenLoops = (): number => {
    if (!$('#buttWaitBetweenLoops').hasClass('active')) return 0;
    return Number($('#waitBetweenLoops').val());
  };

  getNewMarkerId = () => {
    return this.getNewMarkerIds(1)[0];
  };

  getNewMarkerIds = (iNrOfIds: number) => {
    var a: number[] = [];
    var aRet: string[] = [];
    var nr = 0;
    for (var i = 0; i < iNrOfIds; i++) {
      while ($('#markerNr' + nr).length > 0 || a.indexOf(nr) != -1) {
        nr++;
      }
      a[i] = nr;
      aRet[i] = 'markerNr' + nr;
    }
    return aRet;
  };

  updateStartBefore = () => {
    var goToMarker = $('#' + TROFF_SETTING_ON_SELECT_MARKER_GO_TO_MARKER).hasClass('active');
    if (($('audio, video')[0] as HTMLMediaElement).paused && goToMarker) this.goToStartMarker();
    this.setAppropriateActivePlayRegion();
  };

  speedUpdate = () => {
    var sliderVal = (document.getElementById('speedBar') as HTMLInputElement).value as unknown;
    $('#speed, #speedDemo').html(sliderVal as string);
    ($('audio, video')[0] as HTMLMediaElement).playbackRate = (sliderVal as number) / 100;
  };

  setSpeed = (speed: number) => {
    $('#speedBar').val(speed);
    $('#speedBar')[0].dispatchEvent(new Event('input'));
    gtag('event', 'Change Speed', {
      event_category: 'Perform change',
      event_label: speed,
    });
  };

  volumeUpdate = () => {
    var sliderVal = (document.getElementById('volumeBar') as HTMLInputElement).value as unknown;
    $('#volume').html(sliderVal as string);
    ($('audio, video')[0] as HTMLMediaElement).volume = (sliderVal as number) / 100;
  };

  setVolume = (volume: number) => {
    $('#volumeBar').val(volume);
    $('#volumeBar')[0].dispatchEvent(new Event('input'));
  };

  /* This is used when the value of the slider is changed,
   * to update the audio / video
   */
  timeUpdate = () => {
    var sliderVal = Number((document.getElementById('timeBar') as HTMLInputElement).value);
    $('#time').html(this.secToDisp(sliderVal));

    if (sliderVal > this.getStopTime()) {
      var aFirstAndLast = this.getFirstAndLastMarkers();
      var lastMarkerId = aFirstAndLast[1] + 'S';

      if (sliderVal < ($('#' + lastMarkerId)[0] as any).timeValue)
        this.selectStopMarker(lastMarkerId);
      else {
        IO.confirm(
          'Out of range',
          'You pressed outside the playing region, ' +
            'do you want to add a marker to the end of the song?',
          () => {
            var songLength = Number((document.getElementById('timeBar') as HTMLInputElement).max);

            var oMarker = {} as TroffMarker;
            oMarker.name = 'End';
            oMarker.time = songLength;
            oMarker.info = '';
            oMarker.id = this.getNewMarkerId();

            const aMarkers = [oMarker];
            this.addMarkers(aMarkers); // adds marker to html
            DB.saveMarkers(this.getCurrentSong()); // saves end marker to DB

            var aFirstAndLast = this.getFirstAndLastMarkers();
            var lastMarkerId = aFirstAndLast[1] + 'S';
            this.selectStopMarker(lastMarkerId);
            log.d('timeUpdate in if before seek', {
              readyState: (document.querySelector('audio, video') as any).readyState,
              sliderVal: sliderVal,
            });
            (document.querySelector('audio, video') as any).currentTime = sliderVal;
            log.d('timeUpdate in if after seek', {
              readyState: (document.querySelector('audio, video') as any).readyState,
              currentTime: (document.querySelector('audio, video') as any).currentTime,
            });
          }
        );
      }
    } // end if

    log.d('timeUpdate before seek', {
      readyState: (document.querySelector('audio, video') as any).readyState,
      sliderVal: sliderVal,
    });
    (document.querySelector('audio, video') as any).currentTime = sliderVal;
    log.d('timeUpdate after seek', {
      readyState: (document.querySelector('audio, video') as any).readyState,
      currentTime: (document.querySelector('audio, video') as any).currentTime,
    });
  }; // end timeUpdate

  getStopTime = () => {
    var extraTime = '0';

    if ($('audio, video').length === 0) {
      return 0;
    }

    if ($('#buttStopAfter').hasClass('active'))
      extraTime = $('#stopAfter').val() ? ($('#stopAfter').val() as string) : '0';
    if ($('.currentStopMarker')[0])
      return Math.min(
        parseFloat(($('.currentStopMarker')[0] as any).timeValue) + parseFloat(extraTime),
        ($('audio, video')[0] as any).duration
      );
    else return ($('audio, video')[0] as any).duration;
  };

  getStartTime = () => {
    if ($('.currentMarker')[0]) {
      //if there is a start marker
      var extraTime = '0';
      if ($('#buttStartBefore').hasClass('active'))
        extraTime = $('#startBefore').val() ? ($('#startBefore').val() as string) : '0';
      return Math.max(
        parseFloat(($('.currentMarker')[0] as any).timeValue) - parseFloat(extraTime),
        0
      );
    }
    return 0;
  };

  setLoopTo = (number: string | number) => {
    if (number === undefined) {
      number = $('#TROFF_SETTING_SONG_DEFAULT_NR_LOOPS_INFINIT_IS_ON').hasClass('active')
        ? '0'
        : ($('#TROFF_SETTING_SONG_DEFAULT_NR_LOOPS_VALUE').val() as string);
    }

    if (number === 0) number = 'Inf';

    $('.currentLoop').removeClass('currentLoop');
    if (number) {
      $('#buttLoop' + number).addClass('currentLoop');
    } else {
      $(this).addClass('currentLoop');
    }
    this.updateLoopTimes();
  };

  setLoop = (mode: JQuery.ClickEvent) => {
    $('.currentLoop').removeClass('currentLoop');
    $(mode.currentTarget).addClass('currentLoop');
    gtag('event', 'Change loop', {
      event_category: 'Perform change',
      event_label: $(mode.target).val(),
    });

    this.updateLoopTimes();
    blurHack();
  };

  updateLoopTimes = () => {
    var dbLoop = '';
    if ($('#buttLoopInf').hasClass('currentLoop')) dbLoop = 'Inf';
    else dbLoop = $('.currentLoop').val() as string;

    if (this.strCurrentSong) nDB.setOnSong(this.strCurrentSong, 'loopTimes', dbLoop);

    IO.loopTimesLeft($('.currentLoop').val() as string);
  }; // end updateLoopTimes

  getMood = () => {
    if ($('#infoSection').hasClass('pause')) return 'pause';
    if ($('#infoSection').hasClass('wait')) return 'wait';
    if ($('#infoSection').hasClass('play')) return 'play';
    log.e('infoSection hase not correct class!');
  };

  /* this is used every time the time changes in the audio / video */
  timeupdateAudio = () => {
    var audio = document.querySelector('audio, video') as any;
    var dTime = audio.currentTime;
    log.d('timeupdateAudio', { timeBarValue: $('#timeBar').val(), currentTime: audio.currentTime });

    if (dTime >= this.getStopTime()) {
      this.atEndOfLoop();
    }

    $('#time').html(this.secToDisp(dTime));
    (document.getElementById('timeBar') as HTMLInputElement).value = dTime;
  }; // end timeupdateAudio

  atEndOfLoop = () => {
    var audio = document.querySelector('audio, video') as HTMLMediaElement;
    this.goToStartMarker();
    audio.pause();

    if (this.isLoopInfinite()) {
      this.doIncrementSpeed();
      this.playSong(this.getWaitBetweenLoops() * 1000);
    } else {
      if (Number(IO.loopTimesLeft()) > 1) {
        IO.loopTimesLeft('-1');
        this.doIncrementSpeed();
        this.playSong(this.getWaitBetweenLoops() * 1000);
      } else {
        IO.loopTimesLeft($('#loopTimes').val() as string);
        this.pauseSong();
      }
    } // end else
  }; // end atEndOfLoop

  //	this.isLoopOn = function(){
  //		return !$('#buttLoopOff').hasClass('currentLoop');
  //	};

  isLoopInfinite = () => {
    return $('#buttLoopInf').hasClass('currentLoop');
  };

  doIncrementSpeed = () => {
    if (!$('#buttIncrementUntil').hasClass('active')) {
      return;
    }

    var loopTimesLeft,
      speedDiffLeft,
      incrementSpeedBy,
      incrementUntill = parseInt($('#incrementUntilValue').val() as string),
      currentSpeed = ($('audio, video')[0] as HTMLMediaElement).playbackRate * 100;

    speedDiffLeft = incrementUntill - currentSpeed;

    if (this.isLoopInfinite()) {
      if (speedDiffLeft == 0) {
        incrementSpeedBy = 0;
      } else {
        incrementSpeedBy = speedDiffLeft > 0 ? 1 : -1;
      }

      $('#speedBar').val(currentSpeed + incrementSpeedBy);
    } else {
      loopTimesLeft = parseInt(IO.loopTimesLeft() as string);
      incrementSpeedBy = speedDiffLeft / loopTimesLeft;

      $('#speedBar').val(currentSpeed + incrementSpeedBy);
    }

    this.speedUpdate();
  };

  // goToStartMarker används när man updaterar startBefore / trycker på StartBefore  / trycker på en marker???
  goToStartMarker = () => {
    log.d('goToStartMarker', {
      readystate: document.querySelector('audio, video') as HTMLMediaElement,
      startTime: this.getStartTime(),
    });
    (document.querySelector('audio, video') as HTMLMediaElement).currentTime = this.getStartTime();
    log.d('goToStartMarker', {
      readyState: (document.querySelector('audio, video') as HTMLMediaElement).readyState,
      currentTime: (document.querySelector('audio, video') as HTMLMediaElement).currentTime,
    });
  }; // end goToStartMarker

  enterKnappen = () => {
    var goToMarker = $('#' + TROFF_SETTING_ENTER_GO_TO_MARKER_BEHAVIOUR).hasClass('active'),
      updateLoopTimes = $('#' + TROFF_SETTING_ENTER_RESET_COUNTER).hasClass('active'),
      useTimer = $('#' + TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR).hasClass('active');
    this.spaceOrEnter(goToMarker, useTimer, updateLoopTimes);
  }; // end enterKnappen

  space = () => {
    var goToMarker = $('#' + TROFF_SETTING_SPACE_GO_TO_MARKER_BEHAVIOUR).hasClass('active'),
      updateLoopTimes = $('#' + TROFF_SETTING_SPACE_RESET_COUNTER).hasClass('active'),
      useTimer = $('#' + TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR).hasClass('active');
    this.spaceOrEnter(goToMarker, useTimer, updateLoopTimes);
  }; // end space()

  playUiButton = async () => {
    log.d('playUiButton', { isSafari: isSafari, iOSHasLoadedSong: this.iOSHasLoadedSong });
    if (isSafari && !this.iOSHasLoadedSong) {
      log.d('playUiButton: -> createSongAudio', { songKey: this.getCurrentSong() });
      await createSongAudio(this.getCurrentSong());
      this.iOSHasLoadedSong = true;
    }
    var goToMarker = $('#' + TROFF_SETTING_PLAY_UI_BUTTON_GO_TO_MARKER_BEHAVIOUR).hasClass(
        'active'
      ),
      updateLoopTimes = $('#' + TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER).hasClass('active'),
      useTimer = $('#' + TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR).hasClass('active');
    this.spaceOrEnter(goToMarker, useTimer, updateLoopTimes);
  };

  spaceOrEnter = (goToMarker: boolean, useTimer: boolean, updateLoopTimes: boolean) => {
    var audio = document.querySelector('audio, video');
    if (!audio) {
      log.e('no song loaded');
      return;
    }

    if (goToMarker) {
      this.goToStartMarker();
    }
    if (this.getMood() == 'pause') {
      if (useTimer && $('#buttPauseBefStart').hasClass('active')) {
        this.playSong(($('#pauseBeforeStart').val() as number) * 1000);
      } else {
        this.playSong();
      }
    } else {
      this.pauseSong(updateLoopTimes);
    }
    blurHack();
  }; // end spaceOrEnter()

  playSong = (wait?: number) => {
    wait = wait || 0;
    var audio = document.querySelector('audio, video') as HTMLMediaElement;
    if (!audio) return;
    log.d('play button pressed', { currentTime: audio.currentTime });
    setTimeout(
      () =>
        log.d('play after delay', {
          readyState: (document.querySelector('audio, video') as HTMLMediaElement).readyState,
          currentTime: (document.querySelector('audio, video') as HTMLMediaElement).currentTime,
        }),
      100
    );

    gtag('event', 'Start song', { event_category: 'Perform change', event_label: 'Play song' });

    var secondsLeft = wait / 1000;
    $('.secondsLeft').html('' + secondsLeft);

    if (this.stopTimeout) clearInterval(this.stopTimeout);
    this.setMood('wait');

    const localPlayAndSetMood = () => {
      log.d('localPlayAndSetMood', { mood: this.getMood() });
      if (this.getMood() == 'pause') return;
      log.d('play handler before play', { currentTimeBefore: audio.currentTime });

      audio.play();
      log.d('play handler after play', { currentTimeAfter: audio.currentTime });
      this.setMood('play');
    };

    log.d('playSong', { wait, isSafari });
    if (wait > 0) {
      // Hack to force Safari to play the sound after the timeout:
      if (isSafari) {
        audio.play();
        audio.pause();
        log.d('playSong, did a play/pause hack');
      }
      this.stopTimeout = setTimeout(localPlayAndSetMood, wait);
    } else {
      log.d('playSong, in else: did not wait and did not do a play/pause hack');
      localPlayAndSetMood();
    }

    // stopInterval is the counter
    if (this.stopInterval) clearInterval(this.stopInterval);
    this.stopInterval = setInterval(() => {
      if (this.getMood() == 'wait') {
        //audio.isPaused) {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
          $('.secondsLeft').html('0');
          clearInterval(this.stopInterval);
        } else {
          $('.secondsLeft').html('' + secondsLeft);
        }
      } else {
        clearInterval(this.stopInterval);
        $('.secondsLeft').html('0');
      }
    }, 1000);
  }; // end playSong

  pauseSong = (updateLoopTimes?: boolean) => {
    updateLoopTimes = updateLoopTimes !== undefined ? updateLoopTimes : true;
    var audio = document.querySelector('audio, video') as HTMLMediaElement;
    if (audio) audio.pause();
    this.setMood('pause');
    if (updateLoopTimes) {
      this.updateLoopTimes();
    }

    if (this.stopTimeout) clearInterval(this.stopTimeout);
    if (this.stopInterval) clearInterval(this.stopInterval);
  };

  updateSecondsLeft = () => {
    if (this.getMood() != 'pause') {
      return;
    }
    if ($('#buttPauseBefStart').hasClass('active'))
      $('.secondsLeft').html($('#pauseBeforeStart').val() as string);
    else $('.secondsLeft').html('0');
  };

  setMood = (mood: string) => {
    const infoSectionClasses =
      'overFilm bg-transparent position-absolute align-items-center w-100 flexCol';
    $('#infoSection, .moodColorizedText').removeClass('play pause wait').addClass(mood);
    if ($('#playInFullscreenButt').hasClass('active')) {
      $('#videoBox').toggleClass('fullscreen', mood != 'pause');
    }
    $('#infoSection').toggleClass(
      infoSectionClasses,
      mood == 'wait' && $('#videoBox').hasClass('fullscreen')
    );
    $('#buttPlayUiButtonPlay').toggleClass('hidden', mood != 'pause');
    $('#buttPlayUiButtonPause').toggleClass('hidden', mood == 'pause');
    this.updateSecondsLeft();
  };
  // this. ...
  setCurrentSongStrings = (currentSong: string, currentGalleryId: string) => {
    this.strCurrentSong = currentSong;
    this.strCurrentGalleryId = currentGalleryId;
  };
  getCurrentSong = () => {
    return this.strCurrentSong;
  };
  getCurrentGalleryId = () => {
    return this.strCurrentGalleryId;
  };

  setWaitForLoad = (path: string, strGalleryId: string) => {
    if (this.strCurrentSong) {
      this.pauseSong(false);
      this.clearAllMarkers();
      this.clearAllStates();
    }
    this.setAreas([false, false, false, false]);
    this.strCurrentSong = path;
    this.strCurrentGalleryId = strGalleryId;

    $('#currentSong').text('Wait for song to load');
    $('#currentArtist, #currentAlbum').text('');
  };

  setCurrentSongInDB = () => {
    DB.setCurrentSong(this.strCurrentSong, this.strCurrentGalleryId);
  }; // end SetCurrentSong

  pathToName = (filepath: string) => {
    const lastIndex = filepath.lastIndexOf('.');
    if (lastIndex == -1) {
      return filepath;
    }
    return filepath.substr(0, lastIndex);
  };

  getCurrentStates = () => {
    return $('#stateList').children();
  };

  getCurrentMarkers = (bGetStopMarkers?: boolean) => {
    if (bGetStopMarkers) {
      return $('#markerList li input:nth-child(4)');
    }
    return $('#markerList li input:nth-child(3)');
  };

  /*
    exportStuff, gets current song markers to the clippboard
*/
  exportStuff = () => {
    this.toggleImportExport();
    DB.getMarkers(this.strCurrentSong, (aoMarkers) => {
      var oExport = {} as TroffManualImportExport;
      oExport.aoMarkers = [];
      for (var i = 0; i < aoMarkers.length; i++) {
        var oTmp = {} as TroffMarker;
        oTmp.name = aoMarkers[i].name;
        oTmp.time = aoMarkers[i].time;
        oTmp.info = aoMarkers[i].info;
        oTmp.color = aoMarkers[i].color;
        oExport.aoMarkers[i] = oTmp;
      }
      var aState = $('#stateList').children();
      oExport.aoStates = [];
      for (i = 0; i < aState.length; i++) {
        var oState = JSON.parse(aState.eq(i).attr('strstate') as string);
        oExport.aoStates[i] = this.replaceMarkerIdWithMarkerTimeInState(oState, aoMarkers);
      }
      oExport.strSongInfo = $('#songInfoArea').val() as string;
      var sExport = JSON.stringify(oExport);

      IO.prompt('Copy the marked text to export your markers', sExport);
    });
  }; // end exportStuff

  /*
    importStuff, prompts for a string with markers
*/
  importStuff = () => {
    this.toggleImportExport();
    IO.prompt(
      'Please paste the text you received to import the markers',
      'Paste text here',
      (sImport) => {
        var oImport = JSON.parse(sImport as string);
        if (
          oImport.strSongInfo !== undefined &&
          oImport.aoStates !== undefined &&
          oImport.aoMarkers !== undefined
        ) {
          if ($('#markerList').children().length > 2) {
            IO.confirm(
              'Delete existing markers?',
              'Do you want to delete the existing markers before the import,<br />' +
                'or do you want to merge the new markers with the existing ones?',
              () => {
                this.deleteAllMarkers();
                this.doImportStuff(oImport);
              },
              () => {
                this.doImportStuff(oImport);
              },
              'Delete existing markers',
              'Merge markers'
            );
          } else {
            this.doImportStuff(oImport);
          }
        } else {
          //This else is here to allow for imports of 0.5 and earlier
          var aMarkersTmp = oImport;
          this.importMarker(aMarkersTmp);
        }
      }
    );
  };

  replaceMarkerIdWithMarkerTimeInState = (
    oOriginalState: State,
    aoMarkers: TroffMarker[]
  ): State_WithTime => {
    const oState: State_WithTime = oOriginalState as State_WithTime; // to not change the original state-object
    for (let i = 0; i < aoMarkers.length; i++) {
      if (oState.currentMarker == aoMarkers[i].id) {
        oState.currentMarkerTime = aoMarkers[i].time;
      }
      if (oState.currentStopMarker == aoMarkers[i].id + 'S') {
        oState.currentStopMarkerTime = aoMarkers[i].time;
      }
      if (oState.currentMarkerTime !== undefined && oState.currentStopMarkerTime !== undefined) {
        break;
      }
    }
    delete oState.currentMarker;
    delete oState.currentStopMarker;
    return oState;
  };

  importMarker = (aMarkers: TroffMarker[]) => {
    var aMarkerId = this.getNewMarkerIds(aMarkers.length);

    for (var i = 0; i < aMarkers.length; i++) {
      // these 5 lines are here to allow for import of markers
      //from version 0.3.0 and earlier:
      var tmpName = Object.keys(aMarkers[i])[0];
      aMarkers[i].name = aMarkers[i].name || tmpName;
      aMarkers[i].time = aMarkers[i].time || Number((aMarkers[i] as any)[tmpName]) || 0;
      aMarkers[i].info = aMarkers[i].info || '';
      aMarkers[i].color = aMarkers[i].color || 'None';
      //:allow for version 0.3.0 end here

      aMarkers[i].id = aMarkerId[i];
    }
    this.addMarkers(aMarkers); // adds marker to html
  };

  doImportStuff = (oImport: TroffManualImportExport) => {
    const self = this;
    this.importMarker(oImport.aoMarkers);
    importSonginfo(oImport.strSongInfo);
    importStates(oImport.aoStates);

    DB.saveMarkers(this.getCurrentSong());

    DB.saveStates(this.getCurrentSong());
    this.updateSongInfo();

    function importSonginfo(strSongInfo: string) {
      $('#songInfoArea').val($('#songInfoArea').val() + strSongInfo);
    }

    function importStates(aoStates: State_WithTime[]) {
      for (var i = 0; i < aoStates.length; i++) {
        var strTimeStart = aoStates[i].currentMarkerTime;
        var strTimeStop = aoStates[i].currentStopMarkerTime;
        delete aoStates[i].currentMarkerTime;
        delete aoStates[i].currentStopMarkerTime;
        aoStates[i].currentMarker = getMarkerFromTime(strTimeStart);
        aoStates[i].currentStopMarker = getMarkerFromTime(strTimeStop) + 'S';
      }

      function getMarkerFromTime(strTime: string) {
        var aCurrMarkers = $('#markerList').children();
        for (var i = 0; i < aCurrMarkers.length; i++) {
          var currMarker = aCurrMarkers.eq(i).children().eq(2);
          if ((currMarker[0] as any).timeValue == strTime) {
            return currMarker.attr('id');
          }
        }

        log.e('Could not find a marker at the time ' + strTime + '; returning the first marker');
        return aCurrMarkers.eq(0).children().eq(2).attr('id');
      }

      aoStates.map((s) => {
        self.addButtonsOfStates([JSON.stringify(s)]);
      });
    }
  };

  /*
    createMarker, all, figure out the time and name,
    will then call the add- and save- Marker
 */
  createMarker = () => {
    var quickTimeout = setTimeout(() => {
      var oFI = {} as IOInput;
      oFI.strHead = 'Please enter the marker name here';
      var iMarkers = $('#markerList li').length + 1;
      oFI.strInput = 'marker nr ' + iMarkers;
      oFI.bDouble = true;
      oFI.strTextarea = '';
      oFI.strTextareaPlaceholder = 'Add extra info about the marker here.';

      IO.promptEditMarker(false, (newMarkerName, newMarkerInfo, newMarkerColor, newTime) => {
        if (newMarkerName === '') return;

        var oMarker = {} as TroffMarker;
        oMarker.name = newMarkerName;
        oMarker.time = newTime;
        oMarker.info = newMarkerInfo || '';
        oMarker.color = newMarkerColor;
        oMarker.id = this.getNewMarkerId();

        var markers = [oMarker];
        this.addMarkers(markers); // adds marker to html
        DB.saveMarkers(this.getCurrentSong());
        gtag('event', 'Add Marker', {
          event_category: 'Adding Button',
          event_label: newMarkerName,
        });
      });
      clearInterval(quickTimeout);
    }, 0);
  }; // end createMarker   ********/

  toggleImportExport = () => {
    $('#outerImportExportPopUpSquare').toggleClass('hidden');
    blurHack();
  };

  toggleArea = (event: JQuery.ClickEvent) => {
    blurHack();

    var sectionToHide = $(event.target).attr('section-to-hide');

    if (sectionToHide) {
      event.target.classList.toggle('active');
      $(sectionToHide).toggleClass('hidden');
      DB.setCurrentAreas(this.getCurrentSong());
    }
  };

  setAreas = (abAreas: boolean[]) => {
    $('#statesTab').toggleClass('active', abAreas[0]);
    $('#stateSection').toggleClass('hidden', !abAreas[0]);
    $('#settingsTab').toggleClass('active', abAreas[1]);
    $('#timeSection').toggleClass('hidden', !abAreas[1]);
    $('#infoTab').toggleClass('active', abAreas[2]);
    $('#userNoteSection').toggleClass('hidden', !abAreas[2]);
    $('#countTab').toggleClass('active', abAreas[3]);
    $('#infoSection').toggleClass('hidden', !abAreas[3]);
    $('#infoSectionSmall').toggleClass('hidden', abAreas[3]);
  };

  setInfo = (info: string) => {
    $('#songInfoArea').val(info);
  };

  setSonglists_NEW = (aoSonglists: TroffFirebaseGroupIdentifyer[]) => {
    for (var i = 0; i < aoSonglists.length; i++) {
      this.addSonglistToHTML_NEW(aoSonglists[i]);
    }
  };

  setSonglistIcon = (event: JQuery.ClickEvent) => {
    const button = event.target.tagName == 'I' ? event.target.parentElement : event.target;

    const element = button.firstElementChild;

    const icon = [...element.classList].find((o) => o.startsWith('fa-'));

    $('#songlistIconPicker').find('button').removeClass('selected');

    button.classList.add('selected');

    $('#groupDialogSonglistIcon').removeClassStartingWith('fa-').addClass(icon);

    $('#groupDialogIcon').val(icon);
  };

  setSonglistColor = (event: JQuery.ClickEvent) => {
    const element = event.target;
    const color = [...element.classList].find((o) => o.startsWith('bg-'));

    const dialog = $('#groupDialog').find('.innerDialog')[0];

    $(dialog).find('.colorPickerSelected').removeClass('colorPickerSelected');

    $(dialog).removeClassStartingWith('bg-');

    element.classList.add('colorPickerSelected');
    dialog.classList.add(color);

    $(dialog).find('#groupDialogColor').val(color);
  };

  leaveGroup = async () => {
    $('#groupDialog').addClass('hidden');
    const groupDocId = $('#groupDialogName').data('groupDocId');
    const groupData = getFirebaseGroupDataFromDialog(false);

    groupData.owners = groupData.owners.filter((o) => o != firebaseUser?.email);

    if (groupData.owners.length == 0) {
      this.removeGroup();
      return;
    }

    emptyGroupDialog();
    await setDoc(doc(db, 'Groups', groupDocId), groupData);
  };

  onClickShareSonglist = () => {
    if (!firebaseUser) {
      $('#shareInstructionDialog').removeClass('hidden');
      return;
    }

    $('#shareSonglist').addClass('hidden');
    $('.showOnSharedSonglist').removeClass('hidden');
    $('#groupDialogIsGroup').prop('checked', true);
    $('#defaultIcon').click();
    $('#songlistColorPicker .backgroundColorNone').click();
    addGroupOwnerRow(firebaseUser?.email || undefined);
  };

  onClickLeaveGroup = () => {
    IO.confirm(
      'Stop sharing this songlist',
      'Are you sure you want to stop sharing this songlist? Updates that you do will no longer be shared to the other members of this songlist.',
      async () => {
        this.leaveGroup();
      },
      () => {},
      'Yes, stop share',
      'No, I want to continue sharing!'
    );
  };

  removeGroup = async () => {
    $('#groupDialog').addClass('hidden');
    const groupDocId = $('#groupDialogName').data('groupDocId');

    const folderRef = ref(storage, `Groups/${groupDocId}`);

    const { items, prefixes } = await listAll(folderRef);

    // delete all objects in this folder
    await Promise.all(items.map((itemRef) => deleteObject(itemRef)));

    // OPTIONAL: if you might have subfolders, recurse into prefixes
    for (const p of prefixes) {
      const { items: subItems } = await listAll(p);
      await Promise.all(subItems.map((r) => deleteObject(r)));
    }

    const songDocIds: string[] = [];
    $('#groupSongParent')
      .find('.groupDialogSong')
      .each((i, s) => {
        songDocIds.push($(s).data('firebaseSongDocId'));
      });

    emptyGroupDialog();

    const removeDataPromise: Promise<void>[] = [];
    songDocIds.forEach((songDocId) => {
      removeDataPromise.push(removeSongDataFromFirebaseGroup(groupDocId, songDocId));
    });
    await Promise.all(removeDataPromise);

    await deleteDoc(doc(db, 'Groups', groupDocId));
  };

  IO_removeSonglist = async () => {
    const isGroup = $('#groupDialogIsGroup').is(':checked');
    const songListObjectId = $('#groupDialogName').data('songListObjectId');

    if (isGroup) {
      await this.leaveGroup();
    }

    this.removeSonglist_NEW(songListObjectId);
    emptyGroupDialog();
    $('#groupDialog').addClass('hidden');
  };

  onClickremoveSonglist = async () => {
    const isGroup = $('#groupDialogIsGroup').is(':checked');
    if (!isGroup) {
      this.IO_removeSonglist();
      return;
    }
    IO.confirm(
      'Remove Songlist?',
      'This will remove this songlist and updates to songs will no longer be shared to the rest of the owners for this songlist',
      this.IO_removeSonglist,
      () => {},
      'Yes, remove songlist',
      'No, I like this songlist!'
    );
  };

  removeSonglist_NEW = (songListId: number) => {
    const songListObject = JSON.parse(nDB.get('straoSongLists')).filter(
      (sl: TroffFirebaseGroupIdentifyer) => sl.id == songListId
    )[0];

    $('#songListList').find(`[data-songlist-id="${songListId}"]`).closest('li').remove();
    $('#songListSelector').find(`[value="${songListId}"]`).remove();

    DB.saveSonglists_new();
    if (songListObject == undefined) {
      log.w(`Trying to remove songList with id ${songListId}, but it is not in the Local dataBase`);
      return;
    }
    notifyUndo('The songlist "' + songListObject.name + '" was removed', () => {
      this.addSonglistToHTML_NEW(songListObject);
      DB.saveSonglists_new();
    });
  };

  /**
   * Denna funktion används när en låtlista uppdateras automatiskt
   * tex, när firebase uppdaterar låtlista,
   * eller när groupDialog sparas.
   * Den används INTE vid drag and dropp, eller selecten!
   * @param {Object of Songlist} songListObject
   * @param {jQuery button} $target
   */
  updateSongListInHTML = (songListObject: TroffFirebaseGroupIdentifyer) => {
    var $target = $('#songListList').find('[data-songlist-id="' + songListObject.id + '"]');
    if (songListObject.id == undefined) {
      const groupId = songListObject.firebaseGroupDocId;
      $target = $('#songListList').find(`[data-firebase-group-doc-id="${groupId}"]`);
      songListObject.id = $target.data('songlistId');
    }

    $target.text(songListObject.name as string);
    $target.data('songList', songListObject);

    if (songListObject.firebaseGroupDocId != undefined) {
      $target.attr('data-firebase-group-doc-id', songListObject.firebaseGroupDocId);
      $target.addClass('groupIndication');
    } else {
      songListObject.color = '';
      songListObject.icon = 'fa-pencil';
    }

    $target
      .parent()
      .find('.editSongList')
      .removeClassStartingWith('bg-')
      .addClass(songListObject.color as string);

    $target
      .parent()
      .find('.editSongList')
      .find('i')
      .removeClassStartingWith('fa-')
      .addClass(songListObject.icon || 'fa-users');

    if ($target.hasClass('selected')) {
      $target.click();
    }
    if ($target.hasClass('active')) {
      $target.click();
      $target.click();
    }
  };

  addSonglistToHTML_NEW = (oSongList: TroffFirebaseGroupIdentifyer) => {
    if (oSongList.id == undefined) {
      oSongList.id = this.getUniqueSonglistId();
    }

    const groupDocId = oSongList.firebaseGroupDocId;
    const groupClass = groupDocId ? 'groupIndication' : '';
    const groupLogo = oSongList.icon || 'fa-pencil';

    $('#songListList').append(
      $('<li>')
        .addClass('py-1')
        .append(
          $('<div>')
            .addClass('flex-display')
            .addClass('pr-2')
            .append(
              $('<button>')
                .addClass('small')
                .addClass('regularButton')
                .addClass('editSongList')
                .addClass(oSongList.color as string)
                .addClass('mr-2')
                .append($('<i>').addClass('fa').addClass(groupLogo))
                .on('click', songListDialogOpenExisting)
            )
            .append(
              $('<button>')
                .addClass('songlist')
                .addClass(groupClass)
                .addClass('stOnOffButton')
                .addClass('flex-one')
                .addClass('text-left')
                .data('songList', oSongList)
                .attr('data-songlist-id', oSongList.id)
                //  workaround to be able to select by for example $(" [data-songlist-id]")
                .attr('data-firebase-group-doc-id', groupDocId as string)
                .text(oSongList.name as string)
                .click(clickSongList_NEW)
            )
        )
        .on('drop', dropSongOnSonglist as any)
        .on('dragover', allowDrop as any)
        .on('dragleave', onDragleave)
    );

    var oAdd = $('<option>')
      .text('Add to ' + oSongList.name)
      .val(oSongList.id);
    $('#songListSelectorAddToSonglist').append(oAdd);
    var oRemove = $('<option>')
      .text('Remove from ' + oSongList.name)
      .val(oSongList.id);
    $('#songListSelectorRemoveFromSonglist').append(oRemove);
  };

  recallCurrentStateOfSonglists = () => {
    const isAdditiveSelect = nDB.get('TROFF_SETTING_SONG_LIST_ADDITIVE_SELECT') as boolean;
    const o: TroffStateOfSonglists = nDB.get(
      TROFF_CURRENT_STATE_OF_SONG_LISTS
    ) as TroffStateOfSonglists;
    var indicatorClass = isAdditiveSelect ? 'active' : 'selected';

    $('#songListAll').removeClass('selected');

    o.directoryList.forEach((v) => {
      $('#directoryList')
        .find('[data-gallery-id=' + v.galleryId + ']')
        .each((inner_index, inner_value) => {
          if ($(inner_value).data('full-path') == v.fullPath) {
            $(inner_value).addClass(indicatorClass);
            $('#songListAll').removeClass('selected');
          }
        });
    });
    o.galleryList.forEach((v) => {
      $('#galleryList')
        .find('[data-gallery-id=' + v + ']')
        .addClass(indicatorClass);
      $('#songListAll').removeClass('selected');
    });
    o.songListList.forEach((v) => {
      $('#songListList')
        .find('[data-songlist-id=' + v + ']')
        .addClass(indicatorClass);
      $('#songListAll').removeClass('selected');

      if (!isAdditiveSelect) {
        const songListData = $('#songListList')
          .find('[data-songlist-id=' + v + ']')
          .data('songList');
        if (songListData != undefined) {
          $('#headArea').addClass(songListData.color);
          $('#songlistIcon').addClass(songListData.icon);
          $('#songlistName').text(songListData.name);
          $('#songlistInfo').removeClass('hidden').text(songListData.info);
        }
      }
    });

    filterSongTable(getFilterDataList());
  };

  saveCurrentStateOfSonglists = () => {
    var o = {} as TroffStateOfSonglists,
      songListList: string[] = [],
      galleryList: string[] = [],
      directoryList: DirectoryListObject[] = [];
    $('#songListList')
      .find('.active, .selected')
      .each((i, v) => {
        songListList.push($(v).attr('data-songlist-id') as string);
      });
    o.songListList = songListList;

    $('#galleryList')
      .find('.active, .selected')
      .each((i, v) => {
        galleryList.push($(v).attr('data-gallery-id') as string);
      });
    o.galleryList = galleryList;

    $('#directoryList')
      .find('.active, .selected')
      .each((i, v) => {
        directoryList.push({
          galleryId: $(v).attr('data-gallery-id') as string,
          fullPath: $(v).attr('data-full-path') as string,
        });
      });
    o.directoryList = directoryList;

    DB.saveVal(TROFF_CURRENT_STATE_OF_SONG_LISTS, o);
  };

  getUniqueSonglistId = () => {
    var iSonglistId = 1;
    var bFinniched = false;

    var aDOMSonglist = $('#songListList').find('button[data-songlist-id]');
    while (true) {
      bFinniched = true;
      for (var i = 0; i < aDOMSonglist.length; i++) {
        if (aDOMSonglist.eq(i).data('songList').id == iSonglistId) {
          iSonglistId++;
          bFinniched = false;
        }
      }
      if (bFinniched) return iSonglistId;
    }
  };

  enterSongInfo = () => {
    $('#songInfoArea').addClass('textareaEdit');
    IO.setEnterFunction((event) => {
      if (event.ctrlKey) {
        //Ctrl+Enter will exit
        blurHack();
        return false;
      }
      return true;
    });
  };

  exitSongInfo = () => {
    $('#songInfoArea').removeClass('textareaEdit');
    IO.clearEnterFunction();
  };

  updateSongInfo = () => {
    const strInfo = ($('#songInfoArea')[0] as HTMLTextAreaElement).value;
    const songId = this.getCurrentSong();
    DB.setCurrentSongInfo(strInfo, songId);
  };

  rememberCurrentState = () => {
    if ($('#statesTab').hasClass('hidden')) return;

    blurHack();
    var nrStates = $('#stateList').children().length + 1;
    IO.prompt(
      'Remember state of settings to be recalled later',
      'State ' + nrStates,
      (stateName) => {
        if (stateName === '') return;

        var state = {} as State;
        state.name = stateName;
        state.currentLoop = $('.currentLoop').attr('id') as string;
        state.currentMarker = $('.currentMarker').attr('id') as string;
        state.currentStopMarker = $('.currentStopMarker').attr('id') as string;

        $('[data-save-on-song-toggle-class]').each((i, element) => {
          const $target = $(element),
            id = $target.attr('id'),
            classToToggleAndSave = $target.data('save-on-song-toggle-class');
          if (id == undefined) {
            log.e("''id'' is required for elements with [data-save-on-song-toggle-class]");
            return;
          }

          (state as any)[id] = $target.hasClass(classToToggleAndSave);
        });
        $('[data-save-on-song-value]').each((i, element) => {
          const $target = $(element),
            id = $target.attr('id'),
            value = $target.val();

          if (id == undefined) {
            log.e("''id'' is required for elements with [data-save-on-song-value]");
            return;
          }

          (state as any)[id] = value;
        });

        this.addButtonsOfStates([JSON.stringify(state)]);
        DB.saveStates(this.getCurrentSong());
        gtag('event', 'Remember State', {
          event_category: 'Adding Button',
          event_label: stateName,
        });
      }
    );
  };

  addButtonsOfStates = (astrState: string[]) => {
    for (var i = 0; i < astrState.length; i++) {
      var oState = JSON.parse(astrState[i]);

      $('<div class="flexRow">')
        .append(
          $('<button>')
            .attr('type', 'button')
            .addClass('small regularButton')
            .append($('<i>').addClass('fa-trash'))
            .click(this.removeState)
        )
        .append(
          $('<input>')
            .attr('type', 'button')
            .addClass('regularButton flex-one text-left')
            .val(oState.name)
            .click(this.setState)
        )
        .attr('strState', astrState[i])
        .appendTo('#stateList');
    }
    if (astrState.length !== 0) $('#statesHelpText').hide();
  };

  setState = (stateWrapper: JQuery.ClickEvent) => {
    var strState = $(stateWrapper.target).parent().attr('strState');
    var oState = JSON.parse(strState as string);
    $('#' + oState.currentLoop).click();
    $('[data-save-on-song-toggle-class]').each((i, element) => {
      const $target = $(element),
        id = $target.attr('id'),
        classToToggleAndSave = $target.data('save-on-song-toggle-class');
      if (id == undefined) {
        log.e("''id'' is required for elements with [data-save-on-song-toggle-class]");
        return;
      }
      if (oState[id] == undefined) {
        return;
      }

      if ($target.hasClass(classToToggleAndSave) != oState[id]) {
        $target.trigger('click');
      }
    });
    $('[data-save-on-song-value]').each((i, element) => {
      const $target = $(element),
        id = $target.attr('id');

      if (id == undefined) {
        log.e("''id'' is required for elements with [data-save-on-song-value]");
        return;
      }
      if (oState[id] == undefined) {
        return;
      }

      $target.val(oState[id]);
      $target[0].dispatchEvent(new Event('input'));
    });

    $('#' + oState.currentMarker).click();
    $('#' + oState.currentStopMarker).click();
  };

  onSearchKeyup = (event?: JQuery.KeyUpEvent) => {
    if (event != undefined && [37, 38, 39, 40].indexOf(event.keyCode) != -1) {
      return;
    }
    var tBody = $('#dataSongTable').find('tbody'),
      importantEl = tBody.find('tr').filter('.important');

    if (importantEl.length === 0) {
      tBody.find('tr').eq(0).addClass('important');
    } else {
      importantEl.slice(1).removeClass('important');
    }
  };

  enterSerachDataTableSongList = (event: JQuery.ClickEvent) => {
    const $input = $(event.target);
    $input.addClass('textareaEdit');

    if (!$input.is(':focus')) {
      $input.focus();
    }

    this.onSearchKeyup(undefined);

    IO.setEnterFunction(
      (event) => {
        if (event.ctrlKey) {
          //Ctrl+Enter will exit
          $input.val('').trigger('click');
          blurHack();
          return false;
        }

        ($('#dataSongTable') as any).DataTable().rows('.important').nodes().to$().trigger('click');
        ($('#dataSongTable') as any)
          .DataTable()
          .rows('.important')
          .nodes()
          .to$()
          .removeClass('important');

        blurHack();
        return true;
      },
      (event) => {
        var element = $('#dataSongTable').find('tbody').find('tr').filter('.important'),
          next;

        if (event.keyCode == 37 || event.keyCode == 39) return;
        event.preventDefault();

        if (event.keyCode == 40) {
          next = element.next();
        } else {
          next = element.prev();
        }

        if (next.length) {
          element.removeClass('important');
          next.addClass('important');
        }
      }
    );
  };

  exitSerachDataTableSongList = () => {
    ($('#dataSongTable') as any)
      .DataTable()
      .rows('.important')
      .nodes()
      .to$()
      .removeClass('important');

    IO.clearEnterFunction();
    blurHack();
  };

  showSearchAndActivate = () => {
    if (!$('#buttSongsDialog').hasClass('active')) {
      $('#buttSongsDialog').trigger('click').select();
    }

    if (!$('[data-st-css-selector-to-hide="#dataSongTable_filter"]').hasClass('active')) {
      $('[data-st-css-selector-to-hide="#dataSongTable_filter"]').trigger('click').select();
    }

    $('#dataSongTable_filter').find('input').trigger('click').select();
  };

  enterMarkerInfo = () => {
    $('#markerInfoArea').addClass('textareaEdit');
    IO.setEnterFunction((event) => {
      if (event.ctrlKey) {
        //Ctrl+Enter will exit
        blurHack();
        return false;
      }
      return true;
    });
  };
  exitMarkerInfo = () => {
    $('#markerInfoArea').removeClass('textareaEdit');
    IO.clearEnterFunction();
  };

  updateMarkerInfo = () => {
    var strInfo = ($('#markerInfoArea')[0] as any).value;
    var color = ($('.currentMarker')[0] as any).color;
    var markerId = $('.currentMarker').attr('id') as string;
    var time = ($('.currentMarker')[0] as any).timeValue;
    var markerName = $('.currentMarker').val() as string;
    var songId = this.getCurrentSong();

    ($('.currentMarker')[0] as any).info = strInfo;

    DB.updateMarker(markerId, markerName, strInfo, color, time, songId);
  };

  addMarkers = (aMarkers: TroffMarker[]) => {
    var startM = (event: MouseEvent) => {
      this.selectMarker((event.currentTarget as HTMLInputElement).id);
      blurHack();
    };
    var stopM = (event: MouseEvent) => {
      this.selectStopMarker((event.currentTarget as HTMLInputElement).id);
      blurHack();
    };
    var editM = (event: MouseEvent) => {
      this.editMarker((event.currentTarget as HTMLInputElement).id.slice(0, -1));
      blurHack();
    };

    for (var i = 0; i < aMarkers.length; i++) {
      var oMarker = aMarkers[i];
      var name = oMarker.name;
      var time = Number(oMarker.time);
      var info = oMarker.info;
      var color = oMarker.color || 'None';
      var nameId = oMarker.id;

      var maxTime = Number((document.getElementById('timeBar') as HTMLInputElement).max);

      if (oMarker.time == 'max' || time > maxTime) {
        time = maxTime;
      }

      var button = document.createElement('input') as any;
      button.type = 'button';
      button.id = nameId;
      button.value = name;
      button.classList.add('onOffButton');
      button.timeValue = time;
      button.info = info;
      button.color = color;

      var buttonS = document.createElement('input') as any;
      buttonS.type = 'button';
      buttonS.id = nameId + 'S';
      buttonS.value = 'Stop';
      buttonS.classList.add('onOffButton');
      buttonS.timeValue = time;

      var buttonE = $('<button>')
        .addClass('small')
        .addClass('regularButton')
        .attr('id', nameId + 'E')
        .append($('<i>').addClass('fa-pencil'));

      var p = document.createElement('b');
      p.innerHTML = this.secToDisp(time);

      var docMarkerList = document.getElementById('markerList') as HTMLUListElement;
      var listElement = document.createElement('li');

      listElement.appendChild(buttonE[0]);
      listElement.appendChild(p);
      listElement.appendChild(button);
      listElement.appendChild(buttonS);
      $(listElement).addClass(MARKER_COLOR_PREFIX + color);

      var child = $('#markerList li:first-child')[0] as any;
      var bInserted = false;
      var bContinue = false;
      while (child) {
        var childTime = parseFloat(child.childNodes[2].timeValue);
        if (childTime !== undefined && Math.abs(time - childTime) < 0.001) {
          var markerId = child.childNodes[2].id;

          if (child.childNodes[2].info != info) {
            var newMarkerInfo = child.childNodes[2].info + '\n\n' + info;
            ($('#' + markerId)[0] as any).info = newMarkerInfo;
            if ($('.currentMarker')[0].id == child.childNodes[2].id)
              $('#markerInfoArea').val(newMarkerInfo);
          }
          if (child.childNodes[2].value != name) {
            var newMarkerName = child.childNodes[2].value + ', ' + name;
            $('#' + markerId).val(newMarkerName);
          }

          bContinue = true;
          break;
        } else if (time < childTime) {
          $('#markerList')[0].insertBefore(listElement, child);
          bInserted = true;
          break;
        } else {
          child = child.nextSibling;
        }
      } // end while

      if (bContinue) continue;
      if (!bInserted) {
        docMarkerList.appendChild(listElement);
      }

      (document.getElementById(nameId) as HTMLInputElement).addEventListener('click', startM);
      (document.getElementById(nameId + 'S') as HTMLInputElement).addEventListener('click', stopM);
      (document.getElementById(nameId + 'E') as HTMLInputElement).addEventListener('click', editM);
    } //end for-loop
    this.setAppropriateMarkerDistance();
    this.fixMarkerExtraExtendedColor();
  }; // end addMarker ****************/

  /*
   * returns the id of the earliest and latest markers.
   * (note: latest marker without the 'S' for stop-id)
   */
  getFirstAndLastMarkers = (): string[] => {
    var aOMarkers = $('#markerList > li > :nth-child(3)');
    if (aOMarkers.length == 0) {
      throw new Error('No markers found');
    }
    var max = parseFloat((aOMarkers[0] as any).timeValue);
    var min = parseFloat((aOMarkers[0] as any).timeValue);
    var iMaxIndex = 0;
    var iMinIndex = 0;
    var aMarkers: string[] = [];
    for (var i = 0; i < aOMarkers.length; i++) {
      var tv = (aOMarkers[i] as any).timeValue;
      aMarkers[i] = tv;

      if (parseFloat(aMarkers[i]) > max) {
        iMaxIndex = i;
        max = parseFloat(aMarkers[i]);
      }
      if (parseFloat(aMarkers[i]) < min) {
        iMinIndex = i;
        min = parseFloat(aMarkers[i]);
      }
    }
    return [aOMarkers[iMinIndex].id, aOMarkers[iMaxIndex].id];
  };

  unselectMarkers = () => {
    var aFirstAndLast = this.getFirstAndLastMarkers();
    var startMarkerId = aFirstAndLast?.[0];
    var stopMarkerId = aFirstAndLast?.[1] + 'S';

    $('.currentMarker').removeClass('currentMarker');
    $('#' + startMarkerId).addClass('currentMarker');
    $('#markerInfoArea').val(($('#' + startMarkerId)[0] as any).info);
    $('.currentStopMarker').removeClass('currentStopMarker');
    $('#' + stopMarkerId).addClass('currentStopMarker');

    this.setAppropriateActivePlayRegion();
    blurHack();

    if (!startMarkerId || !stopMarkerId) return;

    DB.setCurrentStartAndStopMarker(startMarkerId, stopMarkerId, this.strCurrentSong);
  };

  unselectStartMarker = () => {
    var aFirstAndLast = this.getFirstAndLastMarkers();
    var startMarkerId = aFirstAndLast?.[0];

    $('.currentMarker').removeClass('currentMarker');
    $('#' + startMarkerId).addClass('currentMarker');
    $('#markerInfoArea').val(($('#' + startMarkerId)[0] as any).info);

    this.setAppropriateActivePlayRegion();
    blurHack();
    if (!startMarkerId) return;
    DB.setCurrentStartMarker(startMarkerId, this.strCurrentSong);
  };

  unselectStopMarker = () => {
    var aFirstAndLast = this.getFirstAndLastMarkers();
    var stopMarkerId = aFirstAndLast?.[1] + 'S';

    $('.currentStopMarker').removeClass('currentStopMarker');
    $('#' + stopMarkerId).addClass('currentStopMarker');

    this.setAppropriateActivePlayRegion();
    blurHack();
    DB.setCurrentStopMarker(stopMarkerId, this.strCurrentSong);
  };

  /*
        selectMarker - All, sets new Marker, sets playtime to markers playtime
    */
  selectMarker = (markerId: string) => {
    var startTime = Number(($('#' + markerId)[0] as any).timeValue);
    var stopTime = this.getStopTime();

    // if stopMarker befor Marker - unselect stopMarker:
    if (stopTime <= startTime + 0.5) {
      $('.currentStopMarker').removeClass('currentStopMarker');
      var aFirstAndLast = this.getFirstAndLastMarkers();
      var lastMarkerId = aFirstAndLast?.[1] + 'S';

      $('#' + lastMarkerId).addClass('currentStopMarker');
    }
    var stopMarker = $('.currentStopMarker').attr('id');
    stopMarker = stopMarker ? stopMarker : '0';

    //marks selected Marker:
    $('.currentMarker').removeClass('currentMarker');
    $('#' + markerId).addClass('currentMarker');
    $('#markerInfoArea').val(($('#' + markerId)[0] as any).info);

    if ($('#' + TROFF_SETTING_ON_SELECT_MARKER_GO_TO_MARKER).hasClass('active')) {
      this.goToStartMarker();
    }

    this.setAppropriateActivePlayRegion();

    DB.setCurrentStartAndStopMarker(markerId, stopMarker, this.strCurrentSong);
  }; // end selectMarker

  /*
        selectStopMarker - All, selects a marker to stop playing at
    */
  selectStopMarker = (markerId: string) => {
    var stopTime = Number(($('#' + markerId)[0] as any).timeValue);
    var startTime = this.getStartTime();

    // if startMarker after stopMarker -> unselect startMarker:
    if (startTime + 0.5 >= stopTime) {
      var aFirstAndLast = this.getFirstAndLastMarkers();
      var firstMarkerId = aFirstAndLast?.[0];

      $('.currentMarker').removeClass('currentMarker');
      $('#' + firstMarkerId).addClass('currentMarker');
      $('#markerInfoArea').val(($('#' + firstMarkerId)[0] as any).info);
    }

    var startMarker = $('.currentMarker').attr('id');
    startMarker = startMarker ? startMarker : '0';

    //marks selected StopMarker:
    $('.currentStopMarker').removeClass('currentStopMarker');
    $('#' + markerId).addClass('currentStopMarker');

    this.setAppropriateActivePlayRegion();
    DB.setCurrentStartAndStopMarker(startMarker, markerId, this.strCurrentSong);
  }; // end selectStopMarker

  removeState = (event: JQuery.ClickEvent) => {
    // $().closest(".outerDialog ");
    // var that = this;
    IO.confirm('Remove state', 'This action can not be undone', () => {
      $(event.currentTarget).parent().remove();
      DB.saveStates(this.getCurrentSong());
      if ($('#stateList >').length === 0) $('#statesHelpText').show();
    });
  };

  /*
        removeMarker, all, Tar bort en markÃ¶r frÃ¥n html och DB
    */
  removeMarker = (markerIdWithoutHash: string) => {
    const markerId = markerIdWithoutHash.startsWith('#')
      ? markerIdWithoutHash
      : '#' + markerIdWithoutHash;

    var oMarker = {} as TroffMarker;
    oMarker.id = markerIdWithoutHash;
    oMarker.name = $(markerId).val() as string;
    oMarker.time = Number(($(markerId)[0] as any).timeValue);
    oMarker.info = ($(markerId)[0] as any).info as string;
    oMarker.color = ($(markerId)[0] as any).color as string;

    notifyUndo('Marker ' + oMarker.name + ' was removed', () => {
      const aMarkers = [oMarker];
      this.addMarkers(aMarkers);
      DB.saveMarkers(this.getCurrentSong()); // saves end marker to DB
    });

    // Remove Marker from HTML
    $(markerId).closest('li').remove();
    this.setAppropriateMarkerDistance();

    // remove from DB
    DB.saveMarkers(this.getCurrentSong());
  }; // end removeMarker ******/

  toggleMoveMarkersMoreInfo = () => {
    $('#moveMarkersMoreInfoDialog').toggleClass('hidden');
    blurHack();
  };

  /*
        show the move markers pop up dialog.
    */
  showMoveMarkers = () => {
    IO.setEnterFunction(() => {
      this.moveMarkers(false, false);
    });
    $('#moveMarkersDialog').removeClass('hidden');
    $('#moveMarkersNumber').select();
  };

  /*
        hide the delete markers pop up dialog.
    */
  hideDeleteMarkersDialog = () => {
    $('#deleteMarkersDialog').addClass('hidden');
    IO.clearEnterFunction();
  };

  /*
        hide the move markers pop up dialog.
    */
  hideMoveMarkers = () => {
    $('#moveMarkersDialog').addClass('hidden');
    $('#moveMarkersMoreInfoDialog').addClass('hidden');
    //$('#moveMarkersMoreInfoDialog').hide();
    $('#moveMarkersNumber').val(0);
    IO.clearEnterFunction();
  };

  deleteAllMarkers = () => {
    this.deleteMarkers(false);
  };

  deleteSelectedMarkers = () => {
    this.deleteMarkers(true);
  };

  stretchSelectedMarkers = () => {
    var aAllMarkers = this.getCurrentMarkers(),
      startNumber,
      endNumber;

    [startNumber, endNumber] = this.getStartAndEndMarkerNr(0, 1);

    this.stretchMarkers(
      $('#stretchMarkersNumber').val() as number,
      (aAllMarkers[startNumber] as any).timeValue,
      startNumber,
      endNumber
    );
  };

  stretchAllMarkers = () => {
    var baseValue = 0,
      startNumber = 0,
      endNumber = this.getCurrentMarkers().length;

    this.stretchMarkers(
      $('#stretchMarkersNumber').val() as number,
      baseValue,
      startNumber,
      endNumber
    );
  };

  stretchMarkers = (stretchProcent: number, baseValue: number, startNr: number, endNr: number) => {
    var i,
      maxTime = Number((document.getElementById('timeBar') as HTMLInputElement).max),
      aAllMarkers = this.getCurrentMarkers(),
      newTime,
      markerId,
      calculatetTime;

    if (stretchProcent == 100) {
      IO.alert(
        '100% will not change markers',
        'Stretching the markers to 100% of there original position will not change the marker position.<br /><br />' +
          '<span class="small">Please change the %-value or close the Stretch markers dialog</span>.'
      );
      return;
    }

    for (i = startNr; i < endNr; i++) {
      markerId = aAllMarkers[i].id;

      calculatetTime =
        (((aAllMarkers[i] as any).timeValue - baseValue) * stretchProcent) / 100 + baseValue;
      newTime = Math.max(0, Math.min(maxTime, calculatetTime));

      this.checkIfMarkerIndexHasSameTimeAsOtherMarkers(i, markerId, aAllMarkers, newTime);

      ($('#' + markerId)[0] as any).timeValue = newTime;
      ($('#' + markerId + 'S')[0] as any).timeValue = newTime;
      $('#' + markerId)
        .prev()
        .html(this.secToDisp(newTime));
    }

    this.setAppropriateMarkerDistance();
    DB.saveMarkers(this.getCurrentSong());
    $('#stretchMarkersDialog').addClass('hidden');
    $('#stretchMarkersNumber').val(100);
  };

  /*
        copyMarkers
    */
  openCopyMarkersDialog = () => {
    $('#copyMarkersNumber').val(
      (document.querySelector('audio, video') as HTMLMediaElement).currentTime
    );
    $('#copyMarkersNrOfMarkers').text(this.getNrOfSelectedMarkers());
    $('#copyMarkersNumber').select();
    IO.setEnterFunction(() => {
      blurHack();
      this.copyMarkers();
      return false;
    });
  };

  copyMarkers = () => {
    const aAllMarkers = nDB.get(this.getCurrentSong()).markers,
      timeForFirstMarker = Number($('#copyMarkersNumber').val());
    let i, newMarker;
    const strMarkersBeforeCopy = JSON.stringify(aAllMarkers);
    const [startNumber, endNumber] = this.getStartAndEndMarkerNr(0, 1);
    const timeToAddToMarkers = timeForFirstMarker - aAllMarkers[startNumber].time;

    for (i = startNumber; i < endNumber; i++) {
      newMarker = aAllMarkers[i];
      newMarker.time += timeToAddToMarkers;
      newMarker.id = this.getNewMarkerId();
      this.addMarkers([newMarker]); // adds marker to html
    }
    DB.saveMarkers(this.getCurrentSong());
    gtag('event', 'Copy Markers', { event_category: 'Adding Button', event_label: 'Copy Markers' });

    $('#copyMarkersDialog').addClass('hidden');
    IO.clearEnterFunction();

    notifyUndo('Copied ' + (endNumber - startNumber) + ' markers', () => {
      const oldMarkers = JSON.parse(strMarkersBeforeCopy);
      const startId = oldMarkers[startNumber].id;
      const endId = oldMarkers[endNumber - 1].id;
      $('#markerList').children().remove(); // removes all marker from html
      this.addMarkers(oldMarkers); // adds marker to html
      this.selectMarker(startId);
      this.selectStopMarker(endId + 'S');
      DB.saveMarkers(this.getCurrentSong());
    });
  };

  /*
        move all or some markers.
    */
  moveAllMarkersUp = () => {
    $('#moveMarkersNumber').val(-($('#moveMarkersNumber').val() as number));
    this.moveMarkers(false, false);
  };
  moveAllMarkersDown = () => {
    this.moveMarkers(false, false);
  };
  moveSomeMarkersUp = () => {
    $('#moveMarkersNumber').val(-($('#moveMarkersNumber').val() as number));
    this.moveMarkers(true, false);
  };
  moveSomeMarkersDown = () => {
    this.moveMarkers(true, false);
  };

  moveOneMarkerDown = (val: number) => {
    $('#moveMarkersNumber').val(val);
    this.moveMarkers(true, true);
  };

  getNrOfSelectedMarkers = () => {
    const [startMarkerNr, endMarkerNr] = this.getStartAndEndMarkerNr(0, 1);
    return endMarkerNr - startMarkerNr;
  };

  getStartAndEndMarkerNr = (addToStartNr: number, addToEndNr: number) => {
    addToStartNr = addToStartNr || 0;
    addToEndNr = addToEndNr || 0;

    var aAllMarkers = this.getCurrentMarkers(),
      startNr = 0,
      endNr = aAllMarkers.length,
      selectedId = $('.currentMarker').attr('id'),
      selectedStopId = $('.currentStopMarker').attr('id');

    for (var k = 0; k < aAllMarkers.length; k++) {
      if (selectedId == aAllMarkers.eq(k).attr('id')) startNr = k;

      if (selectedStopId == aAllMarkers.eq(k).next().attr('id')) endNr = k;
    }
    return [startNr + addToStartNr, endNr + addToEndNr];
  };

  deleteMarkers = (bDeleteSelected: boolean) => {
    var i,
      markerId,
      startNumber = 1,
      markers = $('#markerList').children(),
      endNumber = markers.length - 1;

    if (bDeleteSelected) {
      [startNumber, endNumber] = this.getStartAndEndMarkerNr(0, 1);
    }

    if (markers.length - (endNumber - startNumber) < 2) {
      IO.alert('You must have at least 2 markers left');
      return;
    }

    for (i = startNumber; i < endNumber; i++) {
      markerId = markers.eq(i).find('input').attr('id') as string;
      this.removeMarker(markerId);
    }
    this.hideDeleteMarkersDialog();
  };

  /*
        move all markers.
    */
  moveMarkers = (bMoveSelected: boolean, bOneMarker: boolean) => {
    $('#moveMarkersDialog').addClass('hidden');
    IO.clearEnterFunction();

    var value = $('#moveMarkersNumber').val();
    $('#moveMarkersNumber').val(0);

    var aAllMarkers = this.getCurrentMarkers();

    var startNumber = 0;
    var endNumber = aAllMarkers.length;

    if (bOneMarker) {
      aAllMarkers = $('.currentMarker');
      endNumber = 1;
    } else if (bMoveSelected) {
      [startNumber, endNumber] = this.getStartAndEndMarkerNr(0, 1);
    }

    for (var i = startNumber; i < endNumber; i++) {
      var markerId = aAllMarkers[i].id;

      var markerTime = Number((aAllMarkers[i] as any).timeValue) + Number(value);
      var maxTime = Number((document.getElementById('timeBar') as HTMLInputElement).max);
      var newTime = Math.max(0, Math.min(maxTime, markerTime));

      this.checkIfMarkerIndexHasSameTimeAsOtherMarkers(i, markerId, aAllMarkers, newTime);

      ($('#' + markerId)[0] as any).timeValue = newTime;
      ($('#' + markerId + 'S')[0] as any).timeValue = newTime;
      $('#' + markerId)
        .prev()
        .html(this.secToDisp(newTime));
    }

    this.setAppropriateMarkerDistance();
    DB.saveMarkers(this.getCurrentSong());
  };

  checkIfMarkerIndexHasSameTimeAsOtherMarkers = (
    markerIndex: number,
    markerId: string,
    aAllMarkers: JQuery<HTMLElement>,
    newTime: number
  ) => {
    for (var j = 0; j < markerIndex; j++) {
      if (Number((aAllMarkers[j] as any).timeValue) == newTime) {
        var newMarkerName = $('#' + markerId).val() as string;
        if (newMarkerName != aAllMarkers.eq(j).val())
          newMarkerName += ', ' + aAllMarkers.eq(j).val();
        $('#' + markerId).val(newMarkerName);

        var newMarkerInfo = ($('#' + markerId)[0] as any).info as string;
        if (newMarkerInfo != (aAllMarkers[j] as any).info)
          newMarkerInfo += '\n\n' + (aAllMarkers[j] as any).info;
        ($('#' + markerId)[0] as any).info = newMarkerInfo;
        if ($('#' + markerId).hasClass('currentMarker')) $('#markerInfoArea').val(newMarkerInfo);

        aAllMarkers.eq(j).parent().remove();
      }
    }
  };

  /*
        editMarker, all, Editerar en markÃ¶r i bÃ¥de html och DB
    */
  editMarker = (markerId: string) => {
    var oldName = $('#' + markerId).val() as string;
    var oldTime = Number(($('#' + markerId)[0] as any).timeValue);
    var oldMarkerInfo = ($('#' + markerId)[0] as any).info;
    var oldMarkerColor = ($('#' + markerId)[0] as any).color;
    var oldMarkerClass = MARKER_COLOR_PREFIX + oldMarkerColor;

    IO.promptEditMarker(markerId, (newMarkerName, newMarkerInfo, newMarkerColor, newTime) => {
      if (newMarkerName === null || newMarkerName === '' || newTime === null) {
        return;
      }

      if (newTime < 0) newTime = 0;
      if (newTime > ($('audio, video')[0] as HTMLMediaElement).duration)
        newTime = ($('audio, video')[0] as HTMLMediaElement).duration;

      var updated = false;

      // Update HTML Name
      if (newMarkerName != oldName) {
        updated = true;
        $('#' + markerId).val(newMarkerName);
      }

      // update HTML Info
      if (newMarkerInfo != oldMarkerInfo) {
        updated = true;
        ($('#' + markerId)[0] as any).info = newMarkerInfo;

        if ($('#' + markerId).hasClass('currentMarker')) $('#markerInfoArea').val(newMarkerInfo);
      }
      if (newMarkerColor != oldMarkerColor) {
        updated = true;
        ($('#' + markerId)[0] as any).color = newMarkerColor;
        $('#' + markerId)
          .parent()
          .removeClass(oldMarkerClass);
        $('#' + markerId)
          .parent()
          .addClass(MARKER_COLOR_PREFIX + newMarkerColor);
      }

      // update HTML Time
      if (newTime != oldTime) {
        updated = true;

        ($('#' + markerId)[0] as any).timeValue = newTime;
        ($('#' + markerId + 'S')[0] as any).timeValue = newTime;
        this.setAppropriateMarkerDistance();

        var startTime = Number(($('.currentMarker')[0] as any).timeValue);
        var stopTime = Number(($('.currentStopMarker')[0] as any).timeValue);

        if (startTime >= stopTime) {
          $('.currentStopMarker').removeClass('currentStopMarker');
          this.setAppropriateActivePlayRegion();
        }
        $('#' + markerId)
          .prev()
          .html(this.secToDisp(newTime));
      }

      // update name and time and info and color in DB, if nessessarry
      if (updated) {
        DB.updateMarker(
          markerId,
          newMarkerName,
          newMarkerInfo,
          newMarkerColor,
          Number(newTime),
          this.strCurrentSong
        );
        this.fixMarkerExtraExtendedColor();
        /*
            note: DB.updateMarker will also update the "currentStartMarker" and the
            currentStopMarker, if the updated marker is the start or stop marker.
            */
      }
    }); // end prompt-Function
  }; // end editMarker ******/

  /*
        clearAllStates - HTML, clears states
    */
  clearAllStates = () => {
    $('#stateList').empty();
    $('#statesHelpText').show();
  }; // end clearAllStates

  /*
        clearAllMarkers - HTML, clears markers
    */
  clearAllMarkers = () => {
    $('#markerSection').css('height', '100%');
    $('#markerSection').css('margin-top', 0);
    var docMarkerList = document.getElementById('markerList');
    if (docMarkerList) {
      while (docMarkerList.firstChild) {
        docMarkerList.removeChild(docMarkerList.firstChild);
      }
    }
  }; // end clearAllMarkers

  setAppropriateActivePlayRegion = () => {
    var aFirstAndLast = this.getFirstAndLastMarkers();

    if (aFirstAndLast === null || aFirstAndLast === undefined) {
      setTimeout(this.setAppropriateActivePlayRegion, 200);
      return;
    }

    var firstMarkerId = aFirstAndLast[0];
    var lastMarkerId = aFirstAndLast[1] + 'S';
    if ($('.currentMarker').length === 0) {
      $('#' + firstMarkerId).addClass('currentMarker');
      $('#markerInfoArea').val(($('#' + firstMarkerId)[0] as any).info);
    }
    if ($('.currentStopMarker').length === 0) $('#' + lastMarkerId).addClass('currentStopMarker');

    var timeBarHeight = ($('#timeBar').height() as number) - 12;
    var barMarginTop = parseInt($('#timeBar').css('margin-top')) + 6;

    var startTime = this.getStartTime();
    var stopTime = this.getStopTime();
    var songTime = ($('audio, video')[0] as HTMLMediaElement).duration;

    var height = ((stopTime - startTime) * timeBarHeight) / songTime;
    var top = (startTime * timeBarHeight) / songTime + barMarginTop;

    $('#activePlayRegion').height(height);
    $('#activePlayRegion').css('margin-top', top + 'px');
  }; // end setAppropriateActivePlayRegion

  setAppropriateMarkerDistance = () => {
    $('#markerSection').removeClass('hidden');
    var child = $('#markerList li:first-child')[0];

    var timeBarHeight = ($('#timeBar').height() as number) - 10;
    var totalDistanceTop = 4;

    var barMarginTop = parseInt($('#timeBar').css('margin-top'));
    var audioVideo = document.querySelector('audio, video');
    if (audioVideo == null) {
      log.e('there is no audio or video tag');
      return;
    }
    var songTime = (audioVideo as HTMLMediaElement).duration;

    if (!isFinite(songTime)) {
      const troffData = nDB.get(this.getCurrentSong());
      if (troffData.fileData != undefined && troffData.fileData.duration != undefined) {
        songTime = troffData.fileData.duration;
      } else {
        songTime = Number(($('#markerList li:last-child')[0].childNodes[2] as any).timeValue);
      }
    }

    while (child) {
      var markerTime = Number((child.childNodes[2] as any).timeValue);
      var myRowHeight = child.clientHeight;

      var freeDistanceToTop = (timeBarHeight * markerTime) / songTime;

      var marginTop = freeDistanceToTop - totalDistanceTop + barMarginTop;
      totalDistanceTop = freeDistanceToTop + myRowHeight + barMarginTop;

      if (marginTop > 0) {
        $(child).css('border-top-width', marginTop + 'px');
        $(child).css('border-top-style', 'solid');
        $(child).css('margin-top', '');
      } else {
        $(child).css('border-top-width', '');
        $(child).css('border-top-style', '');
        $(child).css('margin-top', marginTop + 'px');
      }
      child = child.nextSibling as HTMLElement;
    }
    this.setAppropriateActivePlayRegion();
  }; // end setAppropriateMarkerDistance

  selectNext = (reverse: boolean) => {
    var markers = $('#markerList').children();

    var currentMarkerTime = Number(($('.currentMarker')[0] as any).timeValue);
    var currentStopTime = Number(($('.currentStopMarker')[0] as any).timeValue);
    (markers as any).sort((a: HTMLElement, b: HTMLElement) => {
      return (
        Number((a.childNodes[2] as any).timeValue) - Number((b.childNodes[2] as any).timeValue)
      );
    });

    var bSelectNext = false;
    var bSelectNextStop = false;

    if (reverse) {
      for (var i = markers.length - 1; i > -1; i--) {
        checkOrSelect(i);
      }
    } else {
      for (var j = 0; j < markers.length; j++) {
        checkOrSelect(j);
      }
    }

    function checkOrSelect(i: number) {
      if (bSelectNextStop) {
        $(markers[i].childNodes[3]).click();
        bSelectNextStop = false;
      }
      if (Number((markers[i].childNodes[3] as any).timeValue) == currentStopTime) {
        bSelectNextStop = true;
      }
      if (bSelectNext) {
        $(markers[i].childNodes[2]).click();
        bSelectNext = false;
      }
      if (Number((markers[i].childNodes[2] as any).timeValue) == currentMarkerTime) {
        bSelectNext = true;
      }
    }
  };

  zoomDontShowAgain = () => {
    $('#zoomInstructionDialog').addClass('hidden');
    this.dontShowZoomInstructions = true;
    DB.setZoomDontShowAgain();
    IO.clearEnterFunction();
  };

  zoomDialogOK = () => {
    $('#zoomInstructionDialog').addClass('hidden');
    IO.clearEnterFunction();
  };

  zoomOut = () => {
    blurHack();
    this.zoom(0, Number((document.getElementById('timeBar') as HTMLInputElement).max));
  };

  zoomToMarker = () => {
    blurHack();
    var startTime = this.getStartTime();
    var endTime = this.getStopTime();
    if (startTime === this.m_zoomStartTime && endTime == this.m_zoomEndTime) {
      if (!this.dontShowZoomInstructions) {
        IO.setEnterFunction(this.zoomDialogOK);
        $('#zoomInstructionDialog').removeClass('hidden');
      }
    }
    this.zoom(startTime, endTime);
  };

  zoom = (startTime: number, endTime: number) => {
    //NOTE all distances is in %, unless otherwise specified

    if (endTime === undefined) {
      return;
    }

    this.m_zoomStartTime = startTime;
    this.m_zoomEndTime = endTime;

    DB.saveZoomTimes(this.strCurrentSong, startTime, endTime);

    var winHeightPX = $('#markerSectionParent').height() as number;

    var mPX = parseInt($('#timeBar').css('marginTop'));

    var mDiv = 8; //parseInt($('#timeBar').css('marginTop'))

    var oH = 100; //original Height of div
    var m = ((mPX + mDiv) * oH) / winHeightPX; // original margin between timebar and div
    var mT = 2 * m; //total margin
    var oh = oH - mT; //original Height of timebar

    var tL = Number((document.getElementById('timeBar') as HTMLInputElement).max);
    var t1 = startTime / tL;
    var t2 = endTime / tL;

    var zt = 1 / (t2 - t1); // == tL/(endTime - startTime);
    var zd = (zt * oh + mT) / oH;
    var mt = t1 * oh * zt;

    var height = 100 * zd;
    var marginTop = -mt;

    const marginTopPX = (winHeightPX * marginTop) / 100;

    $('#markerSection').css('height', height + '%');
    $('#markerSection').css('margin-top', marginTopPX + 'px');

    this.setAppropriateMarkerDistance();
  };

  onTapTempoSavedToDb = () => {
    ifGroupSongUpdateFirestore(this.getCurrentSong());
  };

  tapTime = () => {
    this.previousTime = this.time;
    this.time = new Date().getTime() / 1000;
    blurHack();

    if (this.time - this.previousTime > 3) {
      this.startTime = this.previousTime = this.time;
      this.nrTaps = 0;
    } else {
      this.nrTaps++;
    }

    const currTempo = Math.round((this.nrTaps * 60) / (this.time - this.startTime));

    if (Number.isInteger(currTempo)) {
      $('#tapTempo').val(currTempo);
      IO.updateCellInDataTable('TEMPO', currTempo.toString());
    } else {
      $('#tapTempo').val('');
      IO.updateCellInDataTable('TEMPO', '');
    }

    $('#tapTempo')[0].dispatchEvent(new Event('input'));
  };

  fixMarkerExtraExtendedColor = () => {
    $('#markerList').children().removeClassStartingWith('extend_');

    $('#markerList')
      .children(':not(.markerColorNone)')
      .each((index, element) => {
        const specialColorClass = this.getClassStartsWith(
          $(element).attr('class') as string,
          'markerColor'
        );
        $(element)
          .nextUntil(':not(.markerColorNone)')
          .addClass('extend_' + specialColorClass);
      });
  };

  /* standAlone Functions */
  getClassStartsWith = (classes: string, startString: string) => {
    var r = $.grep(classes.split(' '), (classes) => {
      return 0 === classes.indexOf(startString);
    }).join();
    return r || !1;
  };

  secToDisp = (seconds: number) => {
    return st.secToDisp(seconds);
  };

  incrementInput = (identifier: string, amount: number) => {
    $(identifier).val(parseInt($(identifier).val() as string) + amount);
    $(identifier).each((i, element) => {
      element.dispatchEvent(new Event('input'));
    });
  };

  /* end standAlone Functions */

  checkHashAndGetSong = async () => {
    if (!window.location.hash) {
      DB.getCurrentSong();
      return;
    }
    log.d('checkHashAndGetSong, window.location.hash', window.location.hash);
    try {
      await this.downloadSongFromServer(window.location.hash);
    } catch (e) {
      log.e('error on downloadSongFromServer:', e);
      DB.getCurrentSong();
    }
  };
} // end TroffClass

export { TroffClass, clickSongList_NEW };
