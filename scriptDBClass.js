/* eslint eqeqeq: "off" */
// @ts-check
import { nDB, nDBc } from './assets/internal/db.js';
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

/**
 * @typedef {Object} SongMarker
 * @property {string} id
 * @property {string} name
 * @property {number|string} time
 * @property {string} info
 * @property {string} color
 */

/**
 * @typedef {Object} SongObject
 * @property {string} [info]
 * @property {string[]} [aStates]
 * @property {number} [zoomStartTime]
 * @property {number} [zoomEndTime]
 * @property {SongMarker[]} [markers]
 * @property {boolean[]} [abAreas]
 * @property {string} [currentStartMarker]
 * @property {string} [currentStopMarker]
 * @property {string|undefined} [serverId]
 * @property {number|undefined} [loopTimes]
 * @property {boolean|undefined} [bPlayInFullscreen]
 * @property {boolean|undefined} [bMirrorImage]
 * @property {number|undefined} [tempo]
 * @property {Record<string,unknown>} [fileData]
 */

/**
 * @typedef {Object} SongListSong
 * @property {string} [firebaseSongDocId]
 * @property {Record<string, unknown>} [meta]
 */

/**
 * @typedef {Object} SongList
 * @property {string} [firebaseGroupDocId]
 * @property {string[]} [owners]
 * @property {SongListSong[]} songs
 */

/**
 * @typedef {Record<string, boolean>} ColumnToggleMap
 */

class DBClass {
  constructor() {}

  /**
   * Remove and return a locally changed song entry for a specific group/song.
   * @param {string} groupDocId
   * @param {string} songDocId
   * @param {string} songKey
   * @returns {any | undefined}
   */
  popSongWithLocalChanges = (groupDocId, songDocId, songKey) => {
    /**
     * @param {{ groupDocId: string; songDocId: string; songKey: string }} o
     * @returns {boolean}
     */
    const rightSong = (o) => {
      return o.groupDocId == groupDocId && o.songDocId == songDocId && o.songKey == songKey;
    };

    /** @type {any[]} */
    let changedSongList = nDB.get('TROFF_SONGS_WITH_LOCAL_CHANGES') || [];

    const songInGroupAlreadyExists = changedSongList.find(rightSong);

    changedSongList = changedSongList.filter((o) => !rightSong(o));

    nDB.set('TROFF_SONGS_WITH_LOCAL_CHANGES', changedSongList);
    return songInGroupAlreadyExists;
  };

  // deprecated: use nDB.set( key, value )
  /**
   * @param {string} key
   * @param {any} value
   * @returns {void}
   */
  saveVal = (key, value) => {
    nDB.set(key, value);
  };

  // deprecated: use nDB.get_callback( key, callback )
  /**
   * @param {string} key
   * @param {(value: any) => void} returnFunction
   * @returns {void}
   */
  getVal = (key, returnFunction) => {
    nDBc.get(key, returnFunction);
  };

  /**
   * Ensure a single song object is normalized and saved.
   * @param {string} songId
   * @param {any} songObject
   * @returns {void}
   */
  cleanSong = (songId, songObject) => {
    if (typeof songObject !== 'object' || songId.indexOf('TROFF_') === 0) {
      return; // this object should not be a song, and should not be cleaned
    }

    songObject = DB.fixSongObject(/** @type {SongObject} */ (songObject));

    nDB.set(songId, songObject);
  }; // end cleanSong

  /**
   * Normalize a song object and ensure all required defaults exist.
   * @param {SongObject | undefined} [songObject]
   * @returns {SongObject}
   */
  fixSongObject = (songObject) => {
    let setMaxSongLength = false;

    if (songObject === undefined) {
      songObject = {};
      setMaxSongLength = true;
    }

    if (songObject.fileData === undefined) {
      songObject.fileData = {};
    }

    var songLength;
    const maxTmp = /** @type {any} */ (document.getElementById('timeBar'))?.max;
    songLength = Number(maxTmp) || 'max';

    if (setMaxSongLength) {
      songLength = 'max';
    }

    /** @type {SongMarker} */
    var oMarkerStart = {};
    oMarkerStart.name = 'Start';
    oMarkerStart.time = 0;
    oMarkerStart.info = Troff.getStandardMarkerInfo();
    oMarkerStart.color = 'None';
    oMarkerStart.id = 'markerNr0';
    /** @type {SongMarker} */
    var oMarkerEnd = {};
    oMarkerEnd.name = 'End';
    oMarkerEnd.time = songLength;
    oMarkerEnd.info = '';
    oMarkerEnd.color = 'None';
    oMarkerEnd.id = 'markerNr1';

    /**
     * Rename legacy songObject keys to new schema.
     * @param {string} oldName
     * @param {string} newName0
     * @param {string=} newName1
     * @returns {void}
     */
    const updateAttr = (oldName, newName0, newName1) => {
      if (!Object.prototype.hasOwnProperty.call(songObject, oldName)) {
        return;
      }
      if (newName1) {
        /** @type {any} */ (songObject)['TROFF_CLASS_TO_TOGGLE_' + newName0] = /** @type {any} */ (
          songObject
        )[oldName][0];
        /** @type {any} */ (songObject)['TROFF_VALUE_' + newName1] = /** @type {any} */ (
          songObject
        )[oldName][1];
      } else {
        /** @type {any} */ (songObject)['TROFF_VALUE_' + newName0] = /** @type {any} */ (
          songObject
        )[oldName];
      }
      delete (/** @type {any} */ (songObject)[oldName]);
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

    return /** @type {SongObject} */ (songObject);
  };

  /**
   * @param {string[]} allKeys
   * @param {string} key
   * @param {any} valIsTrue
   * @returns {void}
   */
  fixDefaultValue = (allKeys, key, valIsTrue) => {
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
    nDBc.getAllKeys((allKeys) => {
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

      /** @type {ColumnToggleMap} */
      const columnToggleList = {};
      DATA_TABLE_COLUMNS.list.forEach((v) => {
        columnToggleList[v.id] =
          /** @type {any} */ (v).default == 'true' || /** @type {any} */ (v).default == true;
      });

      /*
				This following if is ONLY to ease the transition from TROFF_SETTING_SONG_COLUMN_TOGGLE as an array to an object.
				Can be removed after user have opened the app with this code once...
			*/
      if (nDB.get(TROFF_SETTING_SONG_COLUMN_TOGGLE) != null) {
        if (nDB.get(TROFF_SETTING_SONG_COLUMN_TOGGLE).constructor.name == 'Array') {
          /** @type {any[]} */
          const previousColumnToggleList = nDB.get(TROFF_SETTING_SONG_COLUMN_TOGGLE);

          /** @type {ColumnToggleMap & Record<string, boolean>} */
          const newColumnToggle = {};
          newColumnToggle.CHECKBOX = previousColumnToggleList[0];
          newColumnToggle.TYPE = previousColumnToggleList[1];
          newColumnToggle.DURATION = previousColumnToggleList[2];
          newColumnToggle.DISPLAY_NAME = previousColumnToggleList[3];
          newColumnToggle.TITLE = previousColumnToggleList[4];
          newColumnToggle.ARTIST = previousColumnToggleList[5];
          newColumnToggle.ALBUM = previousColumnToggleList[6];
          newColumnToggle.TEMPO = previousColumnToggleList[7];
          newColumnToggle.GENRE = previousColumnToggleList[8];
          newColumnToggle.LAST_MODIFIED = previousColumnToggleList[10];
          newColumnToggle.FILE_SIZE = previousColumnToggleList[11];
          newColumnToggle.INFO = previousColumnToggleList[12];
          newColumnToggle.EXTENSION = previousColumnToggleList[13];

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
      const ifExistsPrepAndThenRemove = (key, prepFunc) => {
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
        /** @type {{
         * songListList: string[];
         * galleryList: string[];
         * directoryList: string[]
         * }} */
        var o = {};
        o.songListList = val == 0 ? [] : [val.toString()];
        o.galleryList = [];
        o.directoryList = [];
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

      allKeys.forEach((/** @type {string} */ key) => {
        DB.cleanSong(key, nDB.get(key));
      });
    }); //end get all keys
  };

  /**
   * Remove group properties from a songlist when detaching from a group.
   * @param {string} firebaseGroupDocId
   * @returns {void}
   */
  setSonglistAsNotGroup = (firebaseGroupDocId) => {
    const allSonglists = /** @type {SongList[]} */ (
      JSON.parse(/** @type {string} */ (nDB.get('straoSongLists')))
    );

    const currentSonglist = /** @type {SongList} */ (
      allSonglists.find((g) => g.firebaseGroupDocId == firebaseGroupDocId)
    );
    delete currentSonglist.firebaseGroupDocId;
    delete currentSonglist.owners;
    currentSonglist.songs.forEach((song) => {
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
      aoSonglists = [],
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
  setCurrentAreas = (songId) => {
    nDBc.get(songId, (song) => {
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
    });
  };

  /**
   * Set current song path and gallery id in DB.
   * @param {string} path
   * @param {number} galleryId
   * @returns {void}
   */
  setCurrentSong = (path, galleryId) => {
    var stroSong = JSON.stringify({ strPath: path, iGalleryId: galleryId });
    nDB.set('stroCurrentSongPathAndGalleryId', stroSong);
  };

  /** @returns {void} */
  setZoomDontShowAgain = () => {
    nDB.set('zoomDontShowAgain', true);
  };

  /** @returns {void} */
  getZoomDontShowAgain = () => {
    nDBc.get('zoomDontShowAgain', (value) => {
      var bZoomDontShowAgain = value || false;
      Troff.dontShowZoomInstructions = bZoomDontShowAgain;
    });
  };

  /** @returns {void} */
  getAllSonglists = () => {
    nDBc.get('straoSongLists', (straoSongLists) => {
      if (straoSongLists == undefined) {
        straoSongLists = [];
      }

      Troff.setSonglists_NEW(JSON.parse(/** @type {string} */ (straoSongLists)));
    });
  };

  /** @returns {void} */
  getShowSongDialog = () => {
    DB.getVal(TROFF_SETTING_SHOW_SONG_DIALOG, (val) => {
      if (val === undefined) {
        setTimeout(() => {
          DB.getShowSongDialog();
        }, 42);
      }

      if (val) {
        setTimeout(() => {
          openSongDialog();
        }, 42);
      }
    });
  };

  /** @returns {void} */
  getCurrentSong = () => {
    nDBc.get('stroCurrentSongPathAndGalleryId', (stroSong) => {
      if (!stroSong) {
        Troff.setAreas([false, false, false, false]);
        IO.removeLoadScreen();
        return;
      }
      var oSong = JSON.parse(/** @type {string} */ (stroSong));
      Troff.setCurrentSongStrings(oSong.strPath, oSong.iGalleryId);

      createSongAudio(oSong.strPath);
    });
  };

  /**
   * Update a marker on a song and persist.
   * @param {string} markerId
   * @param {string} newName
   * @param {string} newInfo
   * @param {string} newColor
   * @param {number|string} newTime
   * @param {string} songId
   * @returns {void}
   */
  updateMarker = (markerId, newName, newInfo, newColor, newTime, songId) => {
    nDBc.get(songId, (song) => {
      if (!song) {
        log.e('Error "updateMarker, noSong" occurred, songId=' + songId);
        song = DB.fixSongObject();
      }

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
      Troff.setUrlToSong(undefined, null);

      nDB.set(songId, song);
      updateVersionLink(songId);

      ifGroupSongUpdateFirestore(songId);
    });
  }; // end updateMarker

  /**
   * Save the current state buttons into the song.
   * @param {string} songId
   * @param {() => void} [callback]
   * @returns {void}
   */
  saveStates = (songId, callback) => {
    nDBc.get(songId, (song) => {
      var aAllStates = Troff.getCurrentStates();
      var aStates = [];
      for (var i = 0; i < aAllStates.length; i++) {
        aStates[i] = aAllStates.eq(i).attr('strState');
      }
      if (!song) {
        log.e('Error "saveState, noSong" occurred, songId=' + songId);
        song = DB.fixSongObject();
      }

      song.aStates = aStates;
      song.serverId = undefined;
      Troff.setUrlToSong(undefined, null);

      nDB.set(songId, song);

      ifGroupSongUpdateFirestore(songId);
      if (callback) {
        callback();
      }
    });
  };

  /**
   * Persist zoom window for current song.
   * @param {string} songId
   * @param {number} startTime
   * @param {number} endTime
   * @returns {void}
   */
  saveZoomTimes = (songId, startTime, endTime) => {
    nDBc.get(songId, (song) => {
      if (!song) {
        log.e('Error "saveZoomTimes, noSong" occurred, songId=' + songId);
        song = DB.fixSongObject();
      }

      song.zoomStartTime = startTime;
      song.zoomEndTime = endTime;

      nDB.set(songId, song);
    });
  };

  /**
   * Save markers from the UI into the song object.
   * @param {string} songId
   * @param {() => void} [callback]
   * @returns {void}
   */
  saveMarkers = (songId, callback) => {
    nDBc.get(songId, (song) => {
      var aAllMarkers = Troff.getCurrentMarkers();

      var aMarkers = [];
      for (var i = 0; i < aAllMarkers.length; i++) {
        /** @type {SongMarker} */
        var oMarker = {};
        oMarker.name = aAllMarkers[i].value;
        oMarker.time = Number(aAllMarkers[i].timeValue);
        oMarker.info = aAllMarkers[i].info;
        oMarker.color = aAllMarkers[i].color;
        oMarker.id = aAllMarkers[i].id;
        aMarkers[i] = oMarker;
      }
      if (!song) {
        log.e('Error "saveMarker, noSong" occurred, songId=' + songId);
        song = DB.fixSongObject();
      }

      song.currentStartMarker = /** @type {HTMLElement} */ ($('.currentMarker')[0]).id;
      song.currentStopMarker = /** @type {HTMLElement} */ ($('.currentStopMarker')[0]).id;
      song.markers = aMarkers;
      song.serverId = undefined;
      Troff.setUrlToSong(undefined, null);

      nDB.set(songId, song);

      ifGroupSongUpdateFirestore(songId);
      if (callback) {
        callback();
      }
    });
  }; // end saveMarkers

  /**
   * Persist selected start/stop markers.
   * @param {string} startMarkerId
   * @param {string} stopMarkerId
   * @param {string} songId
   * @returns {void}
   */
  setCurrentStartAndStopMarker = (startMarkerId, stopMarkerId, songId) => {
    nDBc.get(songId, (song) => {
      if (!song) {
        log.e('Error "setStartAndStopMarker, noSong" occurred,' + ' songId=' + songId);
        return;
        // TODO: replace return with song = DB.fixSongObject(); (and test)
      }
      song.currentStartMarker = startMarkerId;
      song.currentStopMarker = stopMarkerId;
      nDB.set(songId, song);
    });
  }; //end setCurrentStartAndStopMarker

  /**
   * @param {string} name
   * @param {string} songId
   * @returns {void}
   */
  setCurrentStartMarker = (name, songId) => {
    DB.setCurrent(songId, 'currentStartMarker', name);
  };
  /**
   * @param {string} name
   * @param {string} songId
   * @returns {void}
   */
  setCurrentStopMarker = (name, songId) => {
    DB.setCurrent(songId, 'currentStopMarker', name);
  };
  /**
   * @param {string} info
   * @param {string} songId
   * @returns {void}
   */
  setCurrentSongInfo = (info, songId) => {
    DB.setCurrent(songId, 'info', info, () => {
      nDB.setOnSong(songId, 'serverId', undefined);
      Troff.setUrlToSong(undefined, null);

      ifGroupSongUpdateFirestore(songId);
      updateVersionLink(songId);
    });
  };

  /**
   * @param {number} tempo
   * @param {string} songId
   * @returns {void}
   */
  setCurrentTempo = (tempo, songId) => {
    DB.setCurrent(songId, 'tempo', tempo);
  };

  /**
   * Set a dynamic key on the current song.
   * @param {string} songId
   * @param {string} key
   * @param {any} value
   * @param {() => void} [callback]
   * @returns {void}
   */
  setCurrent = (songId, key, value, callback) => {
    nDBc.get(songId, (song) => {
      if (!song) {
        log.e(
          'Error, "noSong" occurred;\n' + 'songId=' + songId + ', key=' + key + ', value=' + value
        );
        return;
        // TODO: replace return with song = DB.fixSongObject(); (and test)
      }
      /** @type {any} */ (song)[key] = value;
      nDB.set(songId, song);

      if (callback) {
        callback();
      }
    });
  }; //end setCurrent

  /**
   * @param {string} songId
   * @param {(markers: SongMarker[]) => void} funk
   * @returns {void}
   */
  getMarkers = (songId, funk) => {
    nDBc.get(songId, (song) => {
      if (!song || !song.markers) {
        // new song or no markers
        return;
        // TODO: replace return with song = DB.fixSongObject(); (and test)
      }
      funk(song.markers);
    });
  };

  /**
   * Load a song's metadata into the UI, creating defaults if missing.
   * @param {string} songId
   * @returns {void}
   */
  getSongMetaDataOf = (songId) => {
    /**
     * @param {SongObject} song
     * @param {string} songId
     */
    const loadSongMetadata = (song, songId) => {
      $('[data-save-on-song-toggle-class]').each(
        /** @type {(_: number, element: HTMLElement) => void} */ (_, element) => {
          var $target = $(element),
            classToToggleAndSave = $target.data('save-on-song-toggle-class'),
            key = 'TROFF_CLASS_TO_TOGGLE_' + $target.attr('id'),
            defaultElementId,
            value = /** @type {any} */ (song)[key];

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
            value = /** @type {any} */ (song)[key];

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

    nDBc.get(songId, (song) => {
      if (!song) {
        // new song:
        song = DB.fixSongObject();
        nDB.set(songId, song);

        loadSongMetadata(song, songId);
      } else {
        loadSongMetadata(song, songId);
      }
    });
  }; // end getSongMetadata

  /**
   * Load an image song's metadata into the UI, creating defaults if missing.
   * @param {string} songId
   * @returns {void}
   */
  getImageMetaDataOf = (songId) => {
    nDBc.get(songId, (song) => {
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
    });
  }; // end getSongMetadata
} // end DBClass

export default DBClass;
