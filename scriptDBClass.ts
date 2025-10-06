/* eslint eqeqeq: "off" */
// @ts-check
import { nDB } from './assets/internal/db.js';
import { DB, createSongAudio } from './script.js';
import { IO, ifGroupSongUpdateFirestore, updateVersionLink } from './script.js';
import { Troff } from './script.js';
import log from './utils/log.js';
import {
  TROFF_SETTING_SONG_COLUMN_TOGGLE,
  TROFF_CURRENT_STATE_OF_SONG_LISTS,
  TROFF_SETTING_SHOW_SONG_DIALOG,
  DATA_TABLE_COLUMNS,
} from './constants/constants.js';

import { closeSongDialog, openSongDialog, clickAttachedSongListToggle } from './script0.js';
import {
  TroffHtmlMarkerElement,
  TroffMarker,
  TroffObjectLocal,
  TroffSongIdentifyer_sk,
  TroffStateOfSonglists,
  TroffFirebaseGroupIdentifyer,
} from './types/troff.js';
import { ColumnToggleMap } from './types/dataTables.js';

class DBClass {
  constructor() {}

  /**
   * Remove and return a locally changed song entry for a specific group/song.
   */
  popSongWithLocalChanges = (groupDocId: string, songDocId: string, songKey: string) => {
    const rightSong = (o: TroffSongIdentifyer_sk): boolean => {
      return o.groupDocId == groupDocId && o.songDocId == songDocId && o.songKey == songKey;
    };

    let changedSongList: TroffSongIdentifyer_sk[] = nDB.get('TROFF_SONGS_WITH_LOCAL_CHANGES') || [];

    const songInGroupAlreadyExists = changedSongList.find(rightSong);

    changedSongList = changedSongList.filter((o) => !rightSong(o));

    nDB.set('TROFF_SONGS_WITH_LOCAL_CHANGES', changedSongList);
    return songInGroupAlreadyExists;
  };

  /**
   * saveVal is deprecated: use nDB.set( key, value )
   */
  saveVal = (key: string, value: any) => {
    nDB.set(key, value);
  };

  /**
   * Ensure a single song object is normalized and saved.
   * @param {string} songId
   * @param {any} songObject
   * @returns {void}
   */
  cleanSong = (songId: string, songObject: TroffObjectLocal) => {
    if (typeof songObject !== 'object' || songId.indexOf('TROFF_') === 0) {
      return; // this object should not be a song, and should not be cleaned
    }

    songObject = DB.fixSongObject(/** @type {SongObject} */ songObject);

    nDB.set(songId, songObject);
  }; // end cleanSong

  /**
   * Normalize a song object and ensure all required defaults exist.
   * @param {SongObject | undefined} [songObject]
   * @returns {SongObject}
   */
  fixSongObject = (songObject?: TroffObjectLocal): TroffObjectLocal => {
    let setMaxSongLength = false;

    if (songObject == null) {
      songObject = {} as TroffObjectLocal;
      setMaxSongLength = true;
    }

    if (songObject.fileData == null) {
      songObject.fileData = {
        album: '',
        artist: '',
        choreographer: '',
        choreography: '',
        customName: '',
        duration: 0,
        genre: '',
        tags: '',
        title: '',
      };
    }

    var songLength;
    const maxTmp = (document.getElementById('timeBar') as HTMLInputElement)?.max;
    songLength = Number(maxTmp) || 'max';

    if (setMaxSongLength) {
      songLength = 'max';
    }

    /** @type {SongMarker} */
    var oMarkerStart: TroffMarker = {
      name: 'Start',
      time: 0,
      info: Troff.getStandardMarkerInfo(),
      color: 'None',
      id: 'markerNr0',
    };
    /** @type {SongMarker} */
    var oMarkerEnd: TroffMarker = {
      name: 'End',
      time: songLength,
      info: '',
      color: 'None',
      id: 'markerNr1',
    };

    /**
     * Rename legacy songObject keys to new schema.
     * @param {string} oldName
     * @param {string} newName0
     * @param {string=} newName1
     * @returns {void}
     */
    const updateAttr = (oldName: string, newName0: string, newName1?: string) => {
      if (!Object.prototype.hasOwnProperty.call(songObject, oldName)) {
        return;
      }

      const dyn = songObject as unknown as Record<string, unknown>;

      const oldVal = dyn[oldName];
      if (newName1) {
        // If you expect an array here, narrow it first:
        const arr = Array.isArray(oldVal) ? (oldVal as unknown[]) : [];
        const [cls, val] = arr;
        dyn[`TROFF_CLASS_TO_TOGGLE_${newName0}`] = cls;
        dyn[`TROFF_VALUE_${newName1}`] = val;
      } else {
        dyn[`TROFF_VALUE_${newName0}`] = oldVal;
      }

      delete dyn[oldName];
    };

    updateAttr('speed', 'speedBar');
    updateAttr('volume', 'volumeBar');
    updateAttr('startBefore', 'buttStartBefore', 'startBefore');
    updateAttr('pauseBefStart', 'buttStartBefore', 'pauseBeforeStart');
    updateAttr('stopAfter', 'buttStopAfter', 'stopAfter');
    updateAttr('iWaitBetweenLoops', 'buttWaitBetweenLoops', 'waitBetweenLoops');
    updateAttr('wait', 'buttWaitBetweenLoops', 'waitBetweenLoops');
    updateAttr('tempo', 'tapTempo');

    if (!songObject.info) songObject.info = '';
    if (songObject.aStates === undefined) songObject.aStates = [];
    if (!songObject.zoomStartTime) songObject.zoomStartTime = 0;
    if (!songObject.markers) songObject.markers = [oMarkerStart, oMarkerEnd];
    if (!songObject.abAreas) songObject.abAreas = [false, true, true, true];
    if (!songObject.currentStartMarker) songObject.currentStartMarker = oMarkerStart.id;
    if (!songObject.currentStopMarker) songObject.currentStopMarker = oMarkerEnd.id + 'S';

    return /** @type {SongObject} */ songObject;
  };

  fixDefaultValue = (allKeys: string[], key: string, valIsTrue: any): void => {
    if (allKeys.indexOf(key) === -1) {
      nDB.set(key, valIsTrue);

      if (valIsTrue) {
        $('#' + key).addClass('active');
      } else {
        $('#' + key).removeClass('active');
      }
    }
  };

  /**
   * Clean and migrate DB entries and set defaults.
   * @returns {void}
   */
  cleanDB = () => {
    const allKeys = nDB.getAllKeys();
    if (allKeys.length === 0) {
      // This is the first time Troff is started:
      DB.saveSonglists_new();
    }

    // These is for the first time Troff is started:
    if (allKeys.indexOf('straoSongLists') === -1) DB.saveSonglists_new();
    if (allKeys.indexOf('zoomDontShowAgain') === -1) {
      nDB.set('zoomDontShowAgain', false);
    }

    DB.fixDefaultValue(allKeys, TROFF_SETTING_SHOW_SONG_DIALOG, true);

    const columnToggleList: any = {};
    DATA_TABLE_COLUMNS.list.forEach((v) => {
      columnToggleList[v.id] = (v.default as any) == 'true' || v.default == true;
    });

    /*
      This following if is ONLY to ease the transition from TROFF_SETTING_SONG_COLUMN_TOGGLE as an array to an object.
      Can be removed after user have opened the app with this code once...
    */
    if (nDB.get(TROFF_SETTING_SONG_COLUMN_TOGGLE) != null) {
      if (nDB.get(TROFF_SETTING_SONG_COLUMN_TOGGLE).constructor.name == 'Array') {
        /** @type {any[]} */
        const previousColumnToggleList = nDB.get(TROFF_SETTING_SONG_COLUMN_TOGGLE);

        const newColumnToggle: ColumnToggleMap = {
          CHECKBOX: previousColumnToggleList[0],
          TYPE: previousColumnToggleList[1],
          DURATION: previousColumnToggleList[2],
          DISPLAY_NAME: previousColumnToggleList[3],
          TITLE: previousColumnToggleList[4],
          ARTIST: previousColumnToggleList[5],
          ALBUM: previousColumnToggleList[6],
          TEMPO: previousColumnToggleList[7],
          GENRE: previousColumnToggleList[8],
          LAST_MODIFIED: previousColumnToggleList[10],
          FILE_SIZE: previousColumnToggleList[11],
          INFO: previousColumnToggleList[12],
          EXTENSION: previousColumnToggleList[13],
        };

        nDB.set(TROFF_SETTING_SONG_COLUMN_TOGGLE, newColumnToggle);
      }
    }

    DB.fixDefaultValue(allKeys, TROFF_SETTING_SONG_COLUMN_TOGGLE, columnToggleList);

    if (allKeys.indexOf(TROFF_CURRENT_STATE_OF_SONG_LISTS) == -1) {
      Troff.saveCurrentStateOfSonglists();
    }

    /**
     * @param {string} key
     * @param {(key: string, val: any) => void} [prepFunc]
     * @returns {void}
     */
    const ifExistsPrepAndThenRemove = (key: string, prepFunc?: (key: string, val: any) => void) => {
      var keyIndex = allKeys.indexOf(key);
      if (keyIndex !== -1) {
        if (prepFunc != null) {
          prepFunc(key, nDB.get(key));
        }
        nDB.delete(key);
        allKeys.splice(keyIndex, 1);
      }
    };

    ifExistsPrepAndThenRemove('iCurrentSonglist', (key, val) => {
      var o: TroffStateOfSonglists = {
        songListList: val == 0 ? [] : [val.toString()],
        galleryList: [],
        directoryList: [],
      };
      DB.saveVal(TROFF_CURRENT_STATE_OF_SONG_LISTS, o);
    });

    ifExistsPrepAndThenRemove('abGeneralAreas', (key, val) => {
      var abGeneralAreas = JSON.parse(val);
      var showSongListArea = abGeneralAreas[0];
      var showSongArea = abGeneralAreas[1];

      if (showSongListArea) {
        clickAttachedSongListToggle();
      }
      if (showSongArea) {
        openSongDialog();
      } else {
        closeSongDialog();
      }
    });

    ifExistsPrepAndThenRemove('TROFF_CORE_VERSION_NUMBER');
    ifExistsPrepAndThenRemove('TROFF_STYLE_ASSETS_VERSION_NUMBER');
    ifExistsPrepAndThenRemove('TROFF_INCLUDE_ASSETS_VERSION_NUMBER');
    ifExistsPrepAndThenRemove('TROFF_APP_ASSETS_VERSION_NUMBER');
    ifExistsPrepAndThenRemove('TROFF_INTERNAL_ASSETS_VERSION_NUMBER');
    ifExistsPrepAndThenRemove('TROFF_EXTERNAL_ASSETS_VERSION_NUMBER');

    allKeys.forEach((key: string) => {
      DB.cleanSong(key, nDB.get(key));
    });
  };

  /**
   * Remove group properties from a songlist when detaching from a group.
   * @param {string} firebaseGroupDocId
   * @returns {void}
   */
  setSonglistAsNotGroup = (firebaseGroupDocId: string) => {
    const allSonglists = JSON.parse(nDB.get('straoSongLists'));

    const currentSonglist = allSonglists.find(
      (g: any) => g.firebaseGroupDocId == firebaseGroupDocId
    );
    delete currentSonglist.firebaseGroupDocId;
    delete currentSonglist.owners;
    currentSonglist.songs.forEach((song: any) => {
      delete song.firebaseSongDocId;
    });

    nDB.set('straoSongLists', JSON.stringify(allSonglists));
  };

  /**
   * Read songlists from DOM and persist.
   * @returns {void}
   */
  saveSonglists_new = () => {
    var i,
      aoSonglists: TroffFirebaseGroupIdentifyer[] = [],
      aDOMSonglist = $('#songListList').find('button[data-songlist-id]');

    for (i = 0; i < aDOMSonglist.length; i++) {
      aoSonglists.push(aDOMSonglist.eq(i).data('songList'));
    }

    var straoSonglists = JSON.stringify(aoSonglists);
    nDB.set('straoSongLists', straoSonglists);
  };

  /**
   * Persist which areas/tabs are active for current song.
   * @param {string} songId
   * @returns {void}
   */
  setCurrentAreas = (songId: string) => {
    const song: TroffObjectLocal = nDB.get(songId);
    if (!song) {
      log.e('Error "setCurrentAreas, noSong" occurred, songId=' + songId);
      return;
      //TODO: replace return with song = DB.fixSongObject(); (and test)
    }
    song.abAreas = [
      $('#statesTab').hasClass('active'),
      $('#settingsTab').hasClass('active'),
      $('#infoTab').hasClass('active'),
      $('#countTab').hasClass('active'),
    ];

    nDB.set(songId, song);
  };

  /**
   * Set current song path and gallery id in DB.
   */
  setCurrentSong = (path: string, galleryId: string) => {
    var stroSong = JSON.stringify({ strPath: path, iGalleryId: galleryId });
    nDB.set('stroCurrentSongPathAndGalleryId', stroSong);
  };

  /** @returns {void} */
  setZoomDontShowAgain = () => {
    nDB.set('zoomDontShowAgain', true);
  };

  /** @returns {void} */
  getZoomDontShowAgain = () => {
    const value = nDB.get('zoomDontShowAgain');
    var bZoomDontShowAgain = value || false;
    Troff.dontShowZoomInstructions = bZoomDontShowAgain;
  };

  getAllSonglists = () => {
    const straoSongLists = nDB.get('straoSongLists') || [];

    Troff.setSonglists_NEW(JSON.parse(straoSongLists));
  };

  /** @returns {void} */
  getShowSongDialog = () => {
    console.log(
      'xxx TROFF_SETTING_SHOW_SONG_DIALOG',
      localStorage.getItem('TROFF_SETTING_SHOW_SONG_DIALOG')
    );
    const val = nDB.get(TROFF_SETTING_SHOW_SONG_DIALOG);
    console.log('xxxgetShowSongDialog: val', val);

    console.log(
      'xxx TROFF_SETTING_SHOW_SONG_DIALOG',
      localStorage.getItem('TROFF_SETTING_SHOW_SONG_DIALOG')
    );
    if (val == null) {
      throw new Error(
        `getShowSongDialog: nDB.get(${TROFF_SETTING_SHOW_SONG_DIALOG}) gives: val == null!`
      );
    }

    if (val) {
      openSongDialog();
    }
  };

  /** @returns {void} */
  getCurrentSong = () => {
    const stroSong = nDB.get('stroCurrentSongPathAndGalleryId');
    if (!stroSong) {
      Troff.setAreas([false, false, false, false]);
      IO.removeLoadScreen();
      return;
    }
    var oSong = JSON.parse(/** @type {string} */ stroSong);
    Troff.setCurrentSongStrings(oSong.strPath, oSong.iGalleryId);

    log.d('getCurrentSong: -> createSongAudio');
    createSongAudio(oSong.strPath);
  };

  /**
   * Update a marker on a song and persist.
   */
  updateMarker = (
    markerId: string,
    newName: string,
    newInfo: string,
    newColor: string,
    newTime: number | string,
    songId: string
  ): void => {
    const song = nDB.get(songId) || DB.fixSongObject();

    for (var i = 0; i < song.markers.length; i++) {
      if (song.markers[i].id == markerId) {
        song.markers[i].name = newName;
        song.markers[i].time = newTime;
        song.markers[i].info = newInfo;
        song.markers[i].color = newColor;
        break;
      }
    }

    song.serverId = undefined;
    console.log('setCurrentSongInfo: -> setUrlToSong A:');
    Troff.setUrlToSong(undefined, null);

    nDB.set(songId, song);
    updateVersionLink(songId);

    ifGroupSongUpdateFirestore(songId);
  }; // end updateMarker

  /**
   * Save the current state buttons into the song.
   */
  saveStates = (songId: string): void => {
    const song = nDB.get(songId) || DB.fixSongObject();
    var aAllStates = Troff.getCurrentStates();
    var aStates: string[] = [];
    for (var i = 0; i < aAllStates.length; i++) {
      const strState = aAllStates.eq(i).attr('strState');
      if (strState !== undefined) {
        aStates[i] = strState;
      }
    }
    console.log('aStates', aStates);

    song.aStates = aStates;
    song.serverId = undefined;
    console.log('setCurrentSongInfo: -> setUrlToSong B:');
    Troff.setUrlToSong(undefined, null);

    nDB.set(songId, song);

    ifGroupSongUpdateFirestore(songId);
  };

  /**
   * Persist zoom window for current song.
   */
  saveZoomTimes = (songId: string, startTime: number, endTime: number): void => {
    const song = nDB.get(songId) || DB.fixSongObject();

    song.zoomStartTime = startTime;
    song.zoomEndTime = endTime;

    nDB.set(songId, song);
  };

  /**
   * Save markers from the UI into the song object.
   */
  saveMarkers = (songId: string): void => {
    const song = nDB.get(songId) || DB.fixSongObject();
    var aAllMarkers = Troff.getCurrentMarkers() as JQuery<TroffHtmlMarkerElement>;

    var aMarkers: TroffMarker[] = [];
    for (var i = 0; i < aAllMarkers.length; i++) {
      var oMarker: TroffMarker = {
        name: aAllMarkers[i].value,
        time: Number(aAllMarkers[i].timeValue),
        info: aAllMarkers[i].info,
        color: aAllMarkers[i].color,
        id: aAllMarkers[i].id,
      };
      aMarkers[i] = oMarker;
    }

    song.currentStartMarker = /** @type {HTMLElement} */ $('.currentMarker')[0].id;
    song.currentStopMarker = /** @type {HTMLElement} */ $('.currentStopMarker')[0].id;
    song.markers = aMarkers;
    song.serverId = undefined;
    console.log('setCurrentSongInfo: -> setUrlToSong C:');
    Troff.setUrlToSong(undefined, null);

    nDB.set(songId, song);

    ifGroupSongUpdateFirestore(songId);
  }; // end saveMarkers

  /**
   * Persist selected start/stop markers.
   */
  setCurrentStartAndStopMarker = (
    startMarkerId: string,
    stopMarkerId: string,
    songId: string
  ): void => {
    const song = nDB.get(songId);
    if (!song) {
      log.e('Error "setStartAndStopMarker, noSong" occurred,' + ' songId=' + songId);
      return;
      // TODO: replace return with song = DB.fixSongObject(); (and test)
    }
    song.currentStartMarker = startMarkerId;
    song.currentStopMarker = stopMarkerId;
    nDB.set(songId, song);
  }; //end setCurrentStartAndStopMarker

  setCurrentStartMarker = (name: string, songId: string): void => {
    DB.setCurrent(songId, 'currentStartMarker', name);
  };
  setCurrentStopMarker = (name: string, songId: string): void => {
    DB.setCurrent(songId, 'currentStopMarker', name);
  };
  setCurrentSongInfo = (info: string, songId: string): void => {
    DB.setCurrent(songId, 'info', info, () => {
      nDB.setOnSong(songId, 'serverId', undefined);
      console.log('setCurrentSongInfo: -> setUrlToSong D:');
      Troff.setUrlToSong(undefined, null);

      ifGroupSongUpdateFirestore(songId);
      updateVersionLink(songId);
    });
  };

  setCurrentTempo = (tempo: number, songId: string): void => {
    DB.setCurrent(songId, 'tempo', tempo);
  };

  /**
   * Set a dynamic key on the current song.
   */
  setCurrent = (songId: string, key: string, value: any, callback?: () => void): void => {
    const song = nDB.get(songId);
    if (!song) {
      log.e(
        'Error, "noSong" occurred;\n' + 'songId=' + songId + ', key=' + key + ', value=' + value
      );
      return;
      // TODO: replace return with song = DB.fixSongObject(); (and test)
    }
    /** @type {any} */ song[key] = value;
    nDB.set(songId, song);

    if (callback) {
      callback();
    }
  }; //end setCurrent

  getMarkers = (songId: string, funk: (markers: TroffMarker[]) => void): void => {
    const song = nDB.get(songId);
    if (!song || !song.markers) {
      // new song or no markers
      return;
      // TODO: replace return with song = DB.fixSongObject(); (and test)
    }
    funk(song.markers);
  };

  /**
   * Load a song's metadata into the UI, creating defaults if missing.
   */
  getSongMetaDataOf = (songId: string): void => {
    /**
     * @param {SongObject} song
     * @param {string} songId
     */
    const loadSongMetadata = (song: TroffObjectLocal, songId: string) => {
      $('[data-save-on-song-toggle-class]').each(
        /** @type {(_: number, element: HTMLElement) => void} */ (_, element) => {
          var $target = $(element),
            classToToggleAndSave = $target.data('save-on-song-toggle-class'),
            key = 'TROFF_CLASS_TO_TOGGLE_' + $target.attr('id'),
            defaultElementId,
            value = (song as any)[key];

          if (value === undefined) {
            defaultElementId = $target.data('troff-css-selector-to-get-default');
            value = $(defaultElementId).hasClass(classToToggleAndSave);
          }

          if (value) {
            $target.addClass(classToToggleAndSave);
          } else {
            $target.removeClass(classToToggleAndSave);
          }
        }
      );

      $('[data-save-on-song-value]').each(
        /** @type {(_: number, element: HTMLElement) => void} */ (_, element) => {
          var $target = $(element),
            key = 'TROFF_VALUE_' + $target.attr('id'),
            value = (song as any)[key];

          if (value === undefined) {
            const defaultElementId = $target.data('troff-css-selector-to-get-default');
            value = $(defaultElementId).val();
          }

          $target.val(value);
          if ($target.attr('type') == 'range') {
            $target[0].dispatchEvent(new Event('input'));
          }
        }
      );

      Troff.setUrlToSong(song.serverId, songId);

      Troff.addMarkers(song.markers);
      Troff.selectMarker(song.currentStartMarker);
      Troff.selectStopMarker(song.currentStopMarker);
      Troff.setMood('pause');
      Troff.setLoopTo(song.loopTimes);
      if (song.bPlayInFullscreen !== undefined) Troff.setPlayInFullscreen(song.bPlayInFullscreen);
      if (song.bMirrorImage !== undefined) Troff.setMirrorImage(song.bMirrorImage);

      Troff.setInfo(song.info);
      Troff.addButtonsOfStates(song.aStates);
      Troff.setAreas(song.abAreas);
      Troff.setCurrentSongInDB();
      Troff.zoom(song.zoomStartTime, song.zoomEndTime);
    }; // end loadSongMetadata

    let song = nDB.get(songId);
    if (!song) {
      // new song:
      song = DB.fixSongObject();
      nDB.set(songId, song);
    }
    loadSongMetadata(song, songId);
  }; // end getSongMetadata

  /**
   * Load an image song's metadata into the UI, creating defaults if missing.
   */
  getImageMetaDataOf = (songId: string): void => {
    let song = nDB.get(songId);
    if (!song) {
      // new song:
      song = DB.fixSongObject();
      nDB.set(songId, song);
    }

    Troff.setMood('pause');
    Troff.setInfo(song.info);
    Troff.addButtonsOfStates(song.aStates);
    Troff.setAreas(song.abAreas);
    Troff.setCurrentSongInDB();
  }; // end getImageMetaDataOf
} // end DBClass

export default DBClass;
