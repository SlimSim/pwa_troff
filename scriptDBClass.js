import { nDB, nDBc } from "./assets/internal/db.js";
import { DB, createSongAudio } from "./script.js";
import { IO, ifGroupSongUpdateFirestore, updateVersionLink } from "./script.js";
import { Troff } from "./script.js";
import log from "./utils/log.js";
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
  TROFF_SETTING_PLAY_UI_BUTTON_SHOW_BUTTON,
  TROFF_SETTING_ON_SELECT_MARKER_GO_TO_MARKER,
  TROFF_SETTING_CONFIRM_DELETE_MARKER,
  TROFF_SETTING_UI_ARTIST_SHOW,
  TROFF_SETTING_UI_TITLE_SHOW,
  TROFF_SETTING_UI_ALBUM_SHOW,
  TROFF_SETTING_UI_PATH_SHOW,
  TROFF_SETTING_UI_PLAY_FULL_SONG_BUTTONS_SHOW,
  TROFF_SETTING_UI_ZOOM_SHOW,
  TROFF_SETTING_UI_LOOP_BUTTONS_SHOW,
  TROFF_SETTING_SONG_COLUMN_TOGGLE,
  TROFF_SETTING_SONG_LISTS_LIST_SHOW,
  TROFF_CURRENT_STATE_OF_SONG_LISTS,
  TROFF_SETTING_SHOW_SONG_DIALOG,
  TROFF_TROFF_DATA_ID_AND_FILE_NAME,
  MARKER_COLOR_PREFIX,
  DATA_TABLE_COLUMNS,
} from "./constants/constants.js";

import {
  updateUploadedHistory,
  addGroupOwnerRow,
  emptyGroupDialog,
  moveSongPickerToFloatingState,
  songListDialogOpenExisting,
  openGroupDialog,
  initSongTable,
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
  dataTableColumnPicker,
  moveSongPickerToAttachedState,
  getFileExtension,
  filterSongTable,
  getFilterDataList,
  getFileTypeFaIcon,
  getFileType,
  sortAndValue,
  clearContentDiv,
  addImageToContentDiv,
  addAudioToContentDiv,
  gtag,
  addVideoToContentDiv,
  escapeRegExp,
} from "./script0.js";

class DBClass {
  constructor() {}

  popSongWithLocalChanges = (groupDocId, songDocId, songKey) => {
    const rightSong = (o) => {
      return (
        o.groupDocId == groupDocId &&
        o.songDocId == songDocId &&
        o.songKey == songKey
      );
    };

    let changedSongList = nDB.get("TROFF_SONGS_WITH_LOCAL_CHANGES") || [];

    const songInGroupAlreadyExists = changedSongList.find(rightSong);

    changedSongList = changedSongList.filter((o) => !rightSong(o));

    nDB.set("TROFF_SONGS_WITH_LOCAL_CHANGES", changedSongList);
    return songInGroupAlreadyExists;
  };

  pushSongWithLocalChanges = (groupDocId, songDocId, songKey) => {
    const changedSongList = nDB.get("TROFF_SONGS_WITH_LOCAL_CHANGES") || [];

    const songInGroupAlreadyExists = changedSongList.find(
      (o) =>
        o.groupDocId == groupDocId &&
        o.songDocId == songDocId &&
        o.songKey == songKey
    );

    if (songInGroupAlreadyExists) {
      return;
    }

    changedSongList.push({
      groupDocId: groupDocId,
      songDocId: songDocId,
      songKey: songKey,
    });

    nDB.set("TROFF_SONGS_WITH_LOCAL_CHANGES", changedSongList);
  };

  // deprecated: use nDB.set( key, value )
  saveVal = (key, value) => {
    nDB.set(key, value);
  };

  // deprecated: use nDB.get_callback( key, callback )
  getVal = (key, returnFunction) => {
    nDBc.get(key, returnFunction);
  };

  cleanSong = (songId, songObject) => {
    if (typeof songObject !== "object" || songId.indexOf("TROFF_") === 0) {
      return; // this object should not be a song, and should not be cleaned
    }

    songObject = DB.fixSongObject(songObject);

    nDB.set(songId, songObject);
  }; // end cleanSong

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
    try {
      songLength = Number(document.getElementById("timeBar").max);
    } catch (e) {
      log.e(
        "getElementById('timeBar') does not exist." +
          " Tried to call fixSongObject without it...."
      );
      songLength = "max";
    }
    if (setMaxSongLength) {
      songLength = "max";
    }

    var oMarkerStart = {};
    oMarkerStart.name = "Start";
    oMarkerStart.time = 0;
    oMarkerStart.info = Troff.getStandardMarkerInfo();
    oMarkerStart.color = "None";
    oMarkerStart.id = "markerNr0";
    var oMarkerEnd = {};
    oMarkerEnd.name = "End";
    oMarkerEnd.time = songLength;
    oMarkerEnd.info = "";
    oMarkerEnd.color = "None";
    oMarkerEnd.id = "markerNr1";

    const updateAttr = (oldName, newName0, newName1) => {
      if (!songObject.hasOwnProperty(oldName)) {
        return;
      }
      if (newName1) {
        songObject["TROFF_CLASS_TO_TOGGLE_" + newName0] =
          songObject[oldName][0];
        songObject["TROFF_VALUE_" + newName1] = songObject[oldName][1];
      } else {
        songObject["TROFF_VALUE_" + newName0] = songObject[oldName];
      }
      delete songObject[oldName];
    };

    updateAttr("speed", "speedBar");
    updateAttr("volume", "volumeBar");
    updateAttr("startBefore", "buttStartBefore", "startBefore");
    updateAttr("pauseBefStart", "buttStartBefore", "pauseBeforeStart");
    updateAttr("stopAfter", "buttStopAfter", "stopAfter");
    updateAttr("iWaitBetweenLoops", "buttWaitBetweenLoops", "waitBetweenLoops");
    updateAttr("wait", "buttWaitBetweenLoops", "waitBetweenLoops");
    updateAttr("tempo", "tapTempo");

    if (!songObject.info) songObject.info = "";
    if (songObject.aStates === undefined) songObject.aStates = [];
    if (!songObject.zoomStartTime) songObject.zoomStartTime = 0;
    if (!songObject.markers) songObject.markers = [oMarkerStart, oMarkerEnd];
    if (!songObject.abAreas) songObject.abAreas = [false, true, true, true];
    if (!songObject.currentStartMarker)
      songObject.currentStartMarker = oMarkerStart.id;
    if (!songObject.currentStopMarker)
      songObject.currentStopMarker = oMarkerEnd.id + "S";

    return songObject;
  };

  fixDefaultValue = (allKeys, key, valIsTrue) => {
    if (allKeys.indexOf(key) === -1) {
      nDB.set(key, valIsTrue);

      if (valIsTrue) {
        $("#" + key).addClass("active");
      } else {
        $("#" + key).removeClass("active");
      }
    }
  };

  cleanDB = () => {
    nDBc.getAllKeys((allKeys) => {
      if (allKeys.length === 0) {
        // This is the first time Troff is started:
        DB.saveSonglists_new();
      }

      // These is for the first time Troff is started:
      if (allKeys.indexOf("straoSongLists") === -1) DB.saveSonglists_new();
      if (allKeys.indexOf("zoomDontShowAgain") === -1) {
        nDB.set("zoomDontShowAgain", false);
      }

      DB.fixDefaultValue(allKeys, TROFF_SETTING_SHOW_SONG_DIALOG, true);

      const columnToggleList = {};
      DATA_TABLE_COLUMNS.list.forEach((v, i) => {
        columnToggleList[v.id] = v.default == "true" || v.default == true;
      });

      /*
				This following if is ONLY to ease the transition from TROFF_SETTING_SONG_COLUMN_TOGGLE as an array to an object.
				Can be removed after user have opened the app with this code once...
			*/
      if (nDB.get(TROFF_SETTING_SONG_COLUMN_TOGGLE) != null) {
        if (
          nDB.get(TROFF_SETTING_SONG_COLUMN_TOGGLE).constructor.name == "Array"
        ) {
          const previousColumnToggleList = nDB.get(
            TROFF_SETTING_SONG_COLUMN_TOGGLE
          );

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

      DB.fixDefaultValue(
        allKeys,
        TROFF_SETTING_SONG_COLUMN_TOGGLE,
        columnToggleList
      );

      if (allKeys.indexOf(TROFF_CURRENT_STATE_OF_SONG_LISTS) == -1) {
        Troff.saveCurrentStateOfSonglists();
      }

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

      ifExistsPrepAndThenRemove("iCurrentSonglist", (key, val) => {
        var o = {};
        o.songListList = val == 0 ? [] : [val.toString()];
        o.galleryList = [];
        o.directoryList = [];
        DB.saveVal(TROFF_CURRENT_STATE_OF_SONG_LISTS, o);
      });

      ifExistsPrepAndThenRemove("abGeneralAreas", (key, val) => {
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

      ifExistsPrepAndThenRemove("TROFF_CORE_VERSION_NUMBER");
      ifExistsPrepAndThenRemove("TROFF_STYLE_ASSETS_VERSION_NUMBER");
      ifExistsPrepAndThenRemove("TROFF_INCLUDE_ASSETS_VERSION_NUMBER");
      ifExistsPrepAndThenRemove("TROFF_APP_ASSETS_VERSION_NUMBER");
      ifExistsPrepAndThenRemove("TROFF_INTERNAL_ASSETS_VERSION_NUMBER");
      ifExistsPrepAndThenRemove("TROFF_EXTERNAL_ASSETS_VERSION_NUMBER");

      allKeys.forEach((key, i) => {
        DB.cleanSong(key, nDB.get(key));
      });
    }); //end get all keys
  };

  setSonglistAsNotGroup = (firebaseGroupDocId) => {
    const allSonglists = JSON.parse(nDB.get("straoSongLists"));

    const currentSonglist = allSonglists.find(
      (g) => g.firebaseGroupDocId == firebaseGroupDocId
    );
    delete currentSonglist.firebaseGroupDocId;
    delete currentSonglist.owners;
    currentSonglist.songs.forEach((song) => {
      delete song.firebaseSongDocId;
    });

    nDB.set("straoSongLists", JSON.stringify(allSonglists));
  };

  saveSonglists_new = () => {
    var i,
      aoSonglists = [],
      aDOMSonglist = $("#songListList").find("button[data-songlist-id]");

    for (i = 0; i < aDOMSonglist.length; i++) {
      aoSonglists.push(aDOMSonglist.eq(i).data("songList"));
    }

    var straoSonglists = JSON.stringify(aoSonglists);
    nDB.set("straoSongLists", straoSonglists);
  };

  setCurrentAreas = (songId) => {
    nDBc.get(songId, (song) => {
      if (!song) {
        log.e('Error "setCurrentAreas, noSong" occurred, songId=' + songId);
        return;
      }
      song.abAreas = [
        $("#statesTab").hasClass("active"),
        $("#settingsTab").hasClass("active"),
        $("#infoTab").hasClass("active"),
        $("#countTab").hasClass("active"),
      ];

      nDB.set(songId, song);
    });
  };

  setCurrentSong = (path, galleryId) => {
    var stroSong = JSON.stringify({ strPath: path, iGalleryId: galleryId });
    nDB.set("stroCurrentSongPathAndGalleryId", stroSong);
  };

  setZoomDontShowAgain = () => {
    nDB.set("zoomDontShowAgain", true);
  };

  getZoomDontShowAgain = () => {
    nDBc.get("zoomDontShowAgain", (value) => {
      var bZoomDontShowAgain = value || false;
      Troff.dontShowZoomInstructions = bZoomDontShowAgain;
    });
  };

  getAllSonglists = () => {
    nDBc.get("straoSongLists", (straoSongLists) => {
      if (straoSongLists == undefined) {
        straoSongLists = [];
      }

      Troff.setSonglists_NEW(JSON.parse(straoSongLists));
    });
  };

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

  getCurrentSong = () => {
    nDBc.get("stroCurrentSongPathAndGalleryId", (stroSong) => {
      if (!stroSong) {
        Troff.setAreas([false, false, false, false]);
        IO.removeLoadScreen();
        return;
      }
      var oSong = JSON.parse(stroSong);
      Troff.setCurrentSongStrings(oSong.strPath, oSong.iGalleryId);

      createSongAudio(oSong.strPath);
    });
  };

  updateMarker = (markerId, newName, newInfo, newColor, newTime, songId) => {
    nDBc.get(songId, (song) => {
      if (!song)
        log.e('Error "updateMarker, noSong" occurred, songId=' + songId);
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

  saveStates = (songId, callback) => {
    nDBc.get(songId, (song) => {
      var aAllStates = Troff.getCurrentStates();
      var aStates = [];
      for (var i = 0; i < aAllStates.length; i++) {
        aStates[i] = aAllStates.eq(i).attr("strState");
      }
      if (!song) {
        log.e('Error "saveState, noSong" occurred, songId=' + songId);
        song = {};
        song.markers = [];
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

  saveZoomTimes = (songId, startTime, endTime) => {
    nDBc.get(songId, (song) => {
      if (!song) {
        log.e('Error "saveZoomTimes, noSong" occurred, songId=' + songId);
        song = DB.getStandardSong();
      }

      song.zoomStartTime = startTime;
      song.zoomEndTime = endTime;

      nDB.set(songId, song);
    });
  };

  saveMarkers = (songId, callback) => {
    nDBc.get(songId, (song) => {
      var aAllMarkers = Troff.getCurrentMarkers();

      var aMarkers = [];
      for (var i = 0; i < aAllMarkers.length; i++) {
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
        song = {};
        song.markers = [];
      }

      song.currentStartMarker = $(".currentMarker")[0].id;
      song.currentStopMarker = $(".currentStopMarker")[0].id;
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

  setCurrentStartAndStopMarker = (startMarkerId, stopMarkerId, songId) => {
    nDBc.get(songId, (song) => {
      if (!song) {
        log.e(
          'Error "setStartAndStopMarker, noSong" occurred,' +
            " songId=" +
            songId
        );
        return;
      }
      song.currentStartMarker = startMarkerId;
      song.currentStopMarker = stopMarkerId;
      nDB.set(songId, song);
    });
  }; //end setCurrentStartAndStopMarker

  setCurrentStartMarker = (name, songId) => {
    DB.setCurrent(songId, "currentStartMarker", name);
  };
  setCurrentStopMarker = (name, songId) => {
    DB.setCurrent(songId, "currentStopMarker", name);
  };
  setCurrentSongInfo = (info, songId) => {
    DB.setCurrent(songId, "info", info, () => {
      nDB.setOnSong(songId, "serverId", undefined);
      Troff.setUrlToSong(undefined, null);

      ifGroupSongUpdateFirestore(songId);
      updateVersionLink(songId);
    });
  };

  setCurrentTempo = (tempo, songId) => {
    DB.setCurrent(songId, "tempo", tempo);
  };

  setCurrent = (songId, key, value, callback) => {
    nDBc.get(songId, (song) => {
      if (!song) {
        log.e(
          'Error, "noSong" occurred;\n' +
            "songId=" +
            songId +
            ", key=" +
            key +
            ", value=" +
            value
        );
        return;
      }
      song[key] = value;
      nDB.set(songId, song);

      if (callback) {
        callback();
      }
    });
  }; //end setCurrent

  getMarkers = (songId, funk) => {
    nDBc.get(songId, (song) => {
      if (!song || !song.markers) {
        // new song or no markers
        return;
      }
      funk(song.markers);
    });
  };

  getSongMetaDataOf = (songId) => {
    const loadSongMetadata = (song, songId) => {
      $("[data-save-on-song-toggle-class]").each((i, element) => {
        var $target = $(element),
          classToToggleAndSave = $target.data("save-on-song-toggle-class"),
          key = "TROFF_CLASS_TO_TOGGLE_" + $target.attr("id"),
          defaultElementId,
          value = song[key];

        if (value === undefined) {
          defaultElementId = $target.data("troff-css-selector-to-get-default");
          value = $(defaultElementId).hasClass(classToToggleAndSave);
        }

        if (value) {
          $target.addClass(classToToggleAndSave);
        } else {
          $target.removeClass(classToToggleAndSave);
        }
      });

      $("[data-save-on-song-value]").each((i, element) => {
        var $target = $(element),
          key = "TROFF_VALUE_" + $target.attr("id"),
          value = song[key];

        if (value === undefined) {
          const defaultElementId = $target.data(
            "troff-css-selector-to-get-default"
          );
          value = $(defaultElementId).val();
        }

        $target.val(value);
        if ($target.attr("type") == "range") {
          $target[0].dispatchEvent(new Event("input"));
        }
      });

      Troff.setUrlToSong(song.serverId, songId);

      Troff.addMarkers(song.markers);
      Troff.selectMarker(song.currentStartMarker);
      Troff.selectStopMarker(song.currentStopMarker);
      Troff.setMood("pause");
      Troff.setLoopTo(song.loopTimes);
      if (song.bPlayInFullscreen !== undefined)
        Troff.setPlayInFullscreen(song.bPlayInFullscreen);
      if (song.bMirrorImage !== undefined)
        Troff.setMirrorImage(song.bMirrorImage);

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

  getImageMetaDataOf = (songId) => {
    var loadImageMetadata = (song, songId) => {
      Troff.setMood("pause");
      Troff.setInfo(song.info);
      Troff.addButtonsOfStates(song.aStates);
      Troff.setAreas(song.abAreas);
      Troff.setCurrentSongInDB();
    }; // end loadImageMetadata

    nDBc.get(songId, (song) => {
      if (!song) {
        // new song:
        song = DB.fixSongObject();
        nDB.set(songId, song);

        loadImageMetadata(song, songId);
      } else {
        loadImageMetadata(song, songId);
      }
    });
  }; // end getSongMetadata
} // end DBClass

export default DBClass;
