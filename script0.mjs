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

window.alert = function (alert) {
  log.w("Alert:", alert);
};

function gtag() {
  // console.log("gtag -> arguments:", arguments);
  // TODO: should perhaps gather statistics in the future :)
}

var imgFormats = [
  "png",
  "bmp",
  "jpeg",
  "jpg",
  "gif",
  "png",
  "svg",
  "xbm",
  "webp",
];
var audFormats = ["wav", "mp3", "m4a"];
var vidFormats = [
  "avi",
  "3gp",
  "3gpp",
  "flv",
  "mov",
  "mpeg",
  "mpeg4",
  "mp4",
  "webm",
  "wmv",
  "ogg",
];

var TROFF_SETTING_SET_THEME = "TROFF_SETTING_SET_THEME";
var TROFF_SETTING_EXTENDED_MARKER_COLOR = "TROFF_SETTING_EXTENDED_MARKER_COLOR";
var TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR =
  "TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR";
var TROFF_SETTING_ENTER_GO_TO_MARKER_BEHAVIOUR =
  "TROFF_SETTING_ENTER_GO_TO_MARKER_BEHAVIOUR";
var TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR =
  "TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR";
var TROFF_SETTING_SPACE_GO_TO_MARKER_BEHAVIOUR =
  "TROFF_SETTING_SPACE_GO_TO_MARKER_BEHAVIOUR";
var TROFF_SETTING_ENTER_RESET_COUNTER = "TROFF_SETTING_ENTER_RESET_COUNTER";
var TROFF_SETTING_SPACE_RESET_COUNTER = "TROFF_SETTING_SPACE_RESET_COUNTER";
var TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER =
  "TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER";
var TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR =
  "TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR";
var TROFF_SETTING_PLAY_UI_BUTTON_GO_TO_MARKER_BEHAVIOUR =
  "TROFF_SETTING_PLAY_UI_BUTTON_GO_TO_MARKER_BEHAVIOUR";
var TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR =
  "TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR";
var TROFF_SETTING_PLAY_UI_BUTTON_SHOW_BUTTON =
  "TROFF_SETTING_PLAY_UI_BUTTON_SHOW_BUTTON";
var TROFF_SETTING_ON_SELECT_MARKER_GO_TO_MARKER =
  "TROFF_SETTING_ON_SELECT_MARKER_GO_TO_MARKER";
var TROFF_SETTING_CONFIRM_DELETE_MARKER = "TROFF_SETTING_CONFIRM_DELETE_MARKER";
var TROFF_SETTING_UI_ARTIST_SHOW = "TROFF_SETTING_UI_ARTIST_SHOW";
var TROFF_SETTING_UI_TITLE_SHOW = "TROFF_SETTING_UI_TITLE_SHOW";
var TROFF_SETTING_UI_ALBUM_SHOW = "TROFF_SETTING_UI_ALBUM_SHOW";
var TROFF_SETTING_UI_PATH_SHOW = "TROFF_SETTING_UI_PATH_SHOW";
var TROFF_SETTING_UI_PLAY_FULL_SONG_BUTTONS_SHOW =
  "TROFF_SETTING_UI_PLAY_FULL_SONG_BUTTONS_SHOW";
var TROFF_SETTING_UI_ZOOM_SHOW = "TROFF_SETTING_UI_ZOOM_SHOW";
var TROFF_SETTING_UI_LOOP_BUTTONS_SHOW = "TROFF_SETTING_UI_LOOP_BUTTONS_SHOW";
var TROFF_SETTING_SONG_COLUMN_TOGGLE = "TROFF_SETTING_SONG_COLUMN_TOGGLE";
var TROFF_SETTING_SONG_LISTS_LIST_SHOW = "TROFF_SETTING_SONG_LISTS_LIST_SHOW";
var TROFF_CURRENT_STATE_OF_SONG_LISTS = "TROFF_CURRENT_STATE_OF_SONG_LISTS";
var TROFF_SETTING_SHOW_SONG_DIALOG = "TROFF_SETTING_SHOW_SONG_DIALOG";
const TROFF_TROFF_DATA_ID_AND_FILE_NAME = "TROFF_TROFF_DATA_ID_AND_FILE_NAME";

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isIphone = navigator.userAgent.indexOf("iPhone") !== -1;
const isIpad = navigator.userAgent.indexOf("iPad") !== -1;

var MARKER_COLOR_PREFIX = "markerColor";

const DATA_TABLE_COLUMNS = {
  list: [
    { id: "CHECKBOX", header: "Checkbox", default: true },
    { id: "EDIT", header: "Edit", default: true },
    { id: "TYPE", header: "Type", default: true },
    { id: "DURATION", header: "Duration", default: true },
    {
      id: "DISPLAY_NAME",
      header: "Name",
      default: true,
      showOnAttachedState: true,
    },
    { id: "CUSTOM_NAME", header: "Custom Name", default: false },
    { id: "CHOREOGRAPHY", header: "Choreography", default: false },
    { id: "CHOREOGRAPHER", header: "Choreographer", default: false },
    { id: "TITLE", header: "Title", default: false },
    { id: "ARTIST", header: "Artist", default: true },
    { id: "ALBUM", header: "Album", default: true },
    { id: "TEMPO", header: "Tempo", default: true },
    { id: "GENRE", header: "Genre", default: true },
    { id: "TAGS", header: "Tags", default: false },
    { id: "LAST_MODIFIED", header: "Modified", default: false },
    { id: "FILE_SIZE", header: "Size", default: false },
    { id: "INFO", header: "Song info", default: false },
    { id: "EXTENSION", header: "File type", default: false },
    { id: "DATA_INFO", header: "dataInfo", default: false, hideFromUser: true },
  ],
  getPos: function (id) {
    for (let i = 0; i < this.list.length; i++) {
      if (id == this.list[i].id) {
        return i;
      }
    }
    return -1;
  },
};

export class SongToGroup {
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

  static songKeyToFileUrl = function (songKey, docId, songDocId) {
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

export const populateExampleSongsInGroupDialog = function (songs) {
  // TODO: fixa bättre sätt att lägga på låtarna!
  let dataInfo = $("#dataSongTable")
    .DataTable()
    .column(DATA_TABLE_COLUMNS.getPos("DATA_INFO"))
    .data();

  const fullPathList = songs.map((song) => song.fullPath);
  dataInfo.each((v) => {
    const fullPath = JSON.parse(v).fullPath;
    if (fullPathList.includes(fullPath)) {
      return;
    }
    $("#possible-songs-to-add").append(
      $("<li>")
        .addClass("py-1")
        .append(
          $("<button>")
            .text(fullPath)
            .addClass("regularButton")
            .attr("type", "button")
            .data("fullPath", fullPath)
            .click(onClickAddNewSongToGroup)
        )
    );
  });
};

const openGroupDialog = async function (songListObject) {
  emptyGroupDialog();

  const isGroup = songListObject.firebaseGroupDocId !== undefined;

  if (isGroup) {
    $("#leaveGroup").removeClass("hidden");
    $(".showOnSharedSonglist").removeClass("hidden");
    if (!songListObject.icon) {
      songListObject.icon = "fa-users";
    }

    $("#groupDialog").find(".innerDialog").addClass(songListObject.color);

    $("#groupDialogSonglistIcon").addClass(songListObject.icon);

    $("#groupDialogColor").val(songListObject.color);
    $("#groupDialogIcon").val(songListObject.icon);

    $("#songlistColorPicker")
      .find("." + (songListObject.color || "backgroundColorNone"))
      .addClass("colorPickerSelected");

    $("#songlistIconPicker")
      .find("." + songListObject.icon)
      .parent()
      .addClass("selected");
  } else {
    $("#shareSonglist").removeClass("hidden");
  }

  $("#groupDialogName").val(songListObject.name);
  $("#groupDialogName").data("songListObjectId", songListObject.id);
  $("#groupDialogName").data("groupDocId", songListObject.firebaseGroupDocId);

  $("#groupDialogIsGroup").prop("checked", isGroup);

  $("#groupDialogInfo").val(songListObject.info);

  songListObject.owners?.forEach(addGroupOwnerRow);

  songListObject.songs.forEach(addGroupSongRow_NEW);

  populateExampleSongsInGroupDialog(songListObject.songs);

  $("#groupDialog").removeClass("hidden");
};

const emptyGroupDialog = function () {
  $("#groupDialog").find("form").trigger("reset");

  $("#groupOwnerParent").empty();
  $("#groupSongParent").empty();
  $("#possible-songs-to-add").empty();

  $("#groupDialogName").val("");
  $("#groupDialogName").removeData();

  $("#leaveGroup").addClass("hidden");
  $("#shareSonglist").addClass("hidden");
  $(".showOnSharedSonglist").addClass("hidden");

  $("#groupDialog").find(".innerDialog").removeClassStartingWith("bg-");

  $("#groupDialogSonglistIcon").removeClassStartingWith("fa-");

  $("#songlistIconPicker").find("button").removeClass("selected");

  $("#songlistColorPicker")
    .find(".colorPickerSelected")
    .removeClass("colorPickerSelected");
};

const removeOwnerRow = function (event) {
  const row = $(event.target).closest(".form-group.row");
  const owner = row.find(".groupDialogOwner").val();

  notifyUndo(owner + " was removed.", function () {
    addGroupOwnerRow(owner);
  });

  row.remove();
};

const removeSongRow = function (event) {
  const row = $(event.target).closest(".form-group.row");
  row.find(".groupDialogSong").addClass("bg-danger removed");
  /*
	notifyUndo( song + " was removed.", function() {
		addGroupOwnerRow( song );
	} );
	*/

  //row.remove();
};

const onClickAddNewSongToGroup = function (event) {
  const target = $(event.target);
  addGroupSongRow(undefined, { songKey: target.data("fullPath") });
  target.remove();
};

const addGroupSongRow = function (songDocId, song) {
  const songRow = $("#groupDialogSongRowTemplate").children().clone(true, true);

  songRow.find(".groupDialogRemoveSong").on("click", removeSongRow);
  songRow
    .find(".groupDialogSong")
    .attr("readonly", true)
    .addClass("form-control-plaintext")
    .attr("songDocId", songDocId)
    .val(song?.songKey);

  $("#groupSongParent").append(songRow);
};

const addGroupSongRow_NEW = function (songIdObject) {
  const songRow = $("#groupDialogSongRowTemplate").children().clone(true, true);

  songRow.find(".groupDialogRemoveSong").on("click", removeSongRow);
  songRow
    .find(".groupDialogSong")
    .attr("readonly", true)
    .addClass("form-control-plaintext")
    .addClass("text-inherit")
    .data("galleryId", songIdObject.galleryId)
    .data("firebaseSongDocId", songIdObject.firebaseSongDocId)
    .val(songIdObject.fullPath);

  $("#groupSongParent").append(songRow);
};

const addGroupOwnerRow = function (owner) {
  const ownerRow = $("#groupDialogOwnerRowTemplate")
    .children()
    .clone(true, true);

  ownerRow.find(".groupDialogRemoveOwner").on("click", removeOwnerRow);
  ownerRow.find(".groupDialogOwner").val(owner);
  $("#groupOwnerParent").append(ownerRow);
};

const setUiToNotSignIn = function (user) {
  $(".hide-on-sign-out").addClass("hidden");
  $(".hide-on-sign-in").removeClass("hidden");
  nDB.set("TROFF_FIREBASE_PREVIOUS_SIGNED_IN", false);
};

const setUiToSignIn = async function (user) {
  $("#userName").text(user.displayName);
  $(".hide-on-sign-out").removeClass("hidden");
  $(".hide-on-sign-in").addClass("hidden");
  nDB.set("TROFF_FIREBASE_PREVIOUS_SIGNED_IN", true);
};

const nrIdsInHistoryList = function (historyList) {
  if (!historyList) return 0;
  let nrIds = 0;
  historyList.forEach((historyObject) => {
    nrIds += historyObject.troffDataIdObjectList.length;
  });
  return nrIds;
};

const updateUploadedHistory = async function () {
  if (firebaseUser == null) return;
  const snapshot = await firebase
    .firestore()
    .collection("UserData")
    .doc(firebaseUser.uid)
    .get();
  let userData = snapshot.exists ? snapshot.data() : {};

  const uploadedHistory = userData.uploadedHistory || [];
  const localHistory = nDB.get("TROFF_TROFF_DATA_ID_AND_FILE_NAME") || [];
  const totalList = mergeSongListHistorys(uploadedHistory, localHistory);

  const nrIdsInTotalList = nrIdsInHistoryList(totalList);
  const nrIdsInUploadedHistory = nrIdsInHistoryList(uploadedHistory);

  // om total är längre än uploadedHistory, så ska
  // firebase uppdateras!
  if (nrIdsInTotalList > nrIdsInUploadedHistory) {
    // totalList kanske ska ränsa totalList från onödiga saker???
    // beroende på hur mycket plats det tar upp i firebase...
    userData.uploadedHistory = totalList;
    firebase
      .firestore()
      .collection("UserData")
      .doc(firebaseUser.uid)
      .set(userData);
  }
};

function addImageToContentDiv() {
  var content_div = document.getElementById("content");
  var videoBox = document.createElement("div");
  var image = document.createElement("img");

  videoBox.setAttribute("id", "videoBox");
  image.classList.add("contain-object");
  image.classList.add("full-width");
  Troff.setMetadataImage(image);
  Troff.setImageLayout();

  var fsButton = document.createElement("button");
  fsButton.addEventListener("click", Troff.forceFullscreenChange);
  fsButton.appendChild(document.createTextNode("Fullscreen (F)"));
  content_div.appendChild(fsButton);
  videoBox.appendChild(image);
  content_div.appendChild(videoBox);

  return image;
}

function addAudioToContentDiv() {
  var content_div = document.getElementById("content");
  var audio = document.createElement("audio");
  audio.addEventListener("loadedmetadata", function (e) {
    Troff.setMetadata(audio);
    Troff.setAudioVideoLayout();
  });
  content_div.appendChild(audio);
  return audio;
}

function addVideoToContentDiv() {
  var content_div = document.getElementById("content");
  var videoBox = document.createElement("div");
  var video = document.createElement("video");

  var fsButton = document.createElement("button");

  var margin = "4px";
  video.style.marginTop = margin;
  video.style.marginBottom = margin;

  fsButton.addEventListener("click", Troff.playInFullscreenChanged);
  fsButton.appendChild(document.createTextNode("Play in Fullscreen"));
  fsButton.setAttribute("id", "playInFullscreenButt");
  fsButton.setAttribute("class", "stOnOffButton mt-2 mr-2");

  videoBox.setAttribute("id", "videoBox");

  video.addEventListener("loadedmetadata", function (e) {
    Troff.setMetadata(video);
    Troff.setAudioVideoLayout();
  });

  content_div.appendChild(fsButton);

  content_div.appendChild(
    $("<button>")
      .text("Mirror Image")
      .attr("id", "mirrorImageButt")
      .click(Troff.mirrorImageChanged)
      .addClass("stOnOffButton mt-2 mr-2")[0]
  );

  videoBox.appendChild(video);
  content_div.appendChild(videoBox);
  return video;
}

function getFileExtension(filename) {
  return filename.substr(filename.lastIndexOf(".") + 1).toLowerCase();
}

function getFileType(filename) {
  var ext = getFileExtension(filename);
  if (imgFormats.indexOf(ext) >= 0) return "image";
  else if (audFormats.indexOf(ext) >= 0) return "audio";
  else if (vidFormats.indexOf(ext) >= 0) return "video";
  else return null;
}

function getFileTypeFaIcon(filename) {
  var type = getFileType(filename);

  switch (type) {
    case "image":
      return "fa-image";
    case "audio":
      return "fa-music";
    case "video":
      return "fa-film";
  }
  return "fa-question";
}

function clearContentDiv() {
  var content_div = document.getElementById("content");
  while (content_div.childNodes.length >= 1) {
    content_div.removeChild(content_div.firstChild);
  }
}

function sortAndValue(sortValue, stringValue) {
  if (sortValue === undefined) return '<i class="hidden">' + 0 + "</i>"; //<i class=\"fa " + faType + "\"></i>",
  if (typeof String.prototype.padStart == "function") {
    sortValue = sortValue.toString().padStart(16, 0);
  }
  return '<i class="hidden">' + sortValue + "</i>" + stringValue;
}

function filterSongTable(list) {
  var regex = list.join("|") || false;
  if (
    $("#directoryList, #galleryList, #songListsList")
      .find("button")
      .filter(".active, .selected").length == 0
  ) {
    $("#songListAll").addClass("selected");
    regex = "";
  }
  $("#songlistSelectedWarning").toggleClass(
    "hidden",
    $("#songListAll").hasClass("selected")
  );
  let $songLists = $("#songListList .selected, #songListList .active");
  if ($songLists.length == 1) {
    $("#songlistSelectedWarningName").text(' "' + $songLists.text() + '"');
  } else {
    $("#songlistSelectedWarningName").text("s");
  }

  $("#dataSongTable")
    .DataTable()
    .columns(DATA_TABLE_COLUMNS.getPos("DATA_INFO"))
    .search(regex, true, false)
    .draw();
}

function getFilterDataList() {
  var list = [];

  $("#songListsList")
    .find("button")
    .filter(".active, .selected")
    .each(function (i, v) {
      var innerData = $(v).data("songList");

      if (innerData) {
        $.each(innerData.songs, function (i, vi) {
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

function escapeRegExp(string) {
  return string
    .replace('"', '\\"') // wierd extra escaping of > \" <
    .replace(/[".*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

/**
 * returns a list of the checked visible songs in the SongTable
 * AND ALSO unchecks the songs!
 * @returns List of songDataInfoObjects {galleryId, fullPath}
 */
function getSelectedSongs_NEW() {
  const $checkboxes = $("#dataSongTable")
    .find("td")
    .find("input[type=checkbox]:checked");
  const checkedVisibleSongs = $checkboxes
    .closest("tr")
    .map((i, v) =>
      JSON.parse(
        $("#dataSongTable").DataTable().row(v).data()[
          DATA_TABLE_COLUMNS.getPos("DATA_INFO")
        ]
      )
    )
    .get();

  $checkboxes.prop("checked", false);
  return checkedVisibleSongs;
}

function clickButtNewSongList(event) {
  var songs = getSelectedSongs_NEW();
  openGroupDialog({ songs: songs });
}

function songListDialogOpenExisting(event) {
  openGroupDialog($(event.target).closest("button").next().data("songList"));
}

function onDragleave(ev) {
  $(ev.target).removeClass("drop-active");
}

function allowDrop(ev) {
  if ($(ev.target).hasClass("songlist")) {
    $(ev.target).addClass("drop-active");
    ev.preventDefault();
  }
}

function dropSongOnSonglist(event) {
  if (!$(event.target).hasClass("songlist")) {
    return;
  }
  event.preventDefault();

  $(event.target).removeClass("drop-active");

  if (event.dataTransfer === undefined) {
    event.dataTransfer = event.originalEvent.dataTransfer;
  }

  var dataInfo = JSON.parse(event.dataTransfer.getData("jsonDataInfo")),
    $target = $(event.target);

  addSongsToSonglist([dataInfo], $target);
}

function removeSongsFromSonglist(songs, $target) {
  let songDidNotExists;

  const songList = $target.data("songList");

  $.each(songs, function (i, song) {
    var index,
      dataInfo = song.data || song,
      value;
    songDidNotExists = true;

    for (index = 0; index < songList.songs.length; index++) {
      value = songList.songs[index];
      if (
        value.galleryId == dataInfo.galleryId &&
        value.fullPath == dataInfo.fullPath
      ) {
        songDidNotExists = false;
        songList.songs.splice(index, 1);
      }
    }

    if (songDidNotExists) {
      $.notify(
        dataInfo.fullPath + " did not exist in " + songList.name,
        "info"
      );
      return;
    }

    $target.data("songList", songList);

    notifyUndo(song.name + " was removed from " + songList.name, function () {
      var undo_songList = $target.data("songList");

      undo_songList.songs.push(dataInfo);

      DB.saveSonglists_new();
    });
  });
  DB.saveSonglists_new();
}

function clickAttachedSongListToggle(event) {
  $("#toggleSonglistsId").trigger("click");
}

function reloadSongsButtonActive(event) {
  if (event == null || !$(event.target).hasClass("outerDialog")) {
    return;
  }
  if ($("#outerSongListPopUpSquare").hasClass("hidden")) {
    closeSongDialog();
  } else {
    openSongDialog();
  }
}

function closeSongDialog(event) {
  $("#outerSongListPopUpSquare").addClass("hidden");
  $("#songPickerAttachedArea").addClass("hidden");
  $("#buttSongsDialog").removeClass("active");
  DB.saveVal(TROFF_SETTING_SHOW_SONG_DIALOG, false);
}

function openSongDialog(event) {
  if ($("#TROFF_SETTING_SONG_LIST_FLOATING_DIALOG").hasClass("active")) {
    $("#outerSongListPopUpSquare").removeClass("hidden");
  } else {
    $("#songPickerAttachedArea").removeClass("hidden");
  }

  $("#buttSongsDialog").addClass("active");

  DB.saveVal(TROFF_SETTING_SHOW_SONG_DIALOG, true);
}

function clickSongsDialog(event) {
  if ($(event.target).hasClass("active")) {
    closeSongDialog();
  } else {
    openSongDialog();
  }
}

function minimizeSongPicker() {
  $("#TROFF_SETTING_SONG_LIST_FLOATING_DIALOG").click();
}

function maximizeSongPicker() {
  $("#TROFF_SETTING_SONG_LIST_FLOATING_DIALOG").click();
}

function clickToggleFloatingSonglists(event) {
  let shouldOpenSongDialog = $("#buttSongsDialog").hasClass("active");
  closeSongDialog();
  if ($("#TROFF_SETTING_SONG_LIST_FLOATING_DIALOG").hasClass("active")) {
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
  $("#newSearchParent, #songPicker")
    .detach()
    .appendTo($("#songPickerAttachedArea"));
  $(".hideOnSongsDialogFloatingState").removeClass("hidden");
  $(".hideOnSongsDialogAttachedState").addClass("hidden");
}

function moveSongPickerToFloatingState() {
  $("#newSearchParent, #songPicker")
    .detach()
    .insertBefore("#songPickerFloatingBase");
  dataTableShowColumnsForFloatingState();
  $("#songPickerAttachedArea, .hideOnSongsDialogFloatingState").addClass(
    "hidden"
  );
  $(".hideOnSongsDialogAttachedState").removeClass("hidden");
}

function dataTableColumnPicker(event) {
  var $target = $(event.target);
  // Get the column API object
  var column = $("#dataSongTable").DataTable().column($(this).data("column"));

  $target.toggleClass("active");

  const columnVisibilityObject = {};

  $("#columnToggleParent")
    .children()
    .map(function (i, v) {
      const dataColumn = $(v).data("column");
      const columnId = DATA_TABLE_COLUMNS.list[dataColumn].id;
      columnVisibilityObject[columnId] = $(v).hasClass("active");
    });

  DB.saveVal(TROFF_SETTING_SONG_COLUMN_TOGGLE, columnVisibilityObject);

  // Toggle the visibility
  column.visible(!column.visible());
}

function dataTableShowOnlyColumnsForAttachedState() {
  $("#columnToggleParent")
    .children()
    .each(function (i, v) {
      if (DATA_TABLE_COLUMNS.list[$(v).data("column")].showOnAttachedState) {
        $("#dataSongTable")
          .DataTable()
          .column($(v).data("column"))
          .visible(true);
      } else {
        $("#dataSongTable")
          .DataTable()
          .column($(v).data("column"))
          .visible(false);
      }
    });
}

function dataTableShowColumnsForFloatingState() {
  $("#columnToggleParent")
    .children()
    .each(function (i, v) {
      if ($(v).hasClass("active")) {
        $("#dataSongTable")
          .DataTable()
          .column($(v).data("column"))
          .visible(true);
      } else {
        $("#dataSongTable")
          .DataTable()
          .column($(v).data("column"))
          .visible(false);
      }
    });
}

function initSongTable() {
  var dataSongTable,
    selectAllCheckbox = $(
      '<div class="checkbox preventSongLoad"><label><input type="checkbox" value=""><span class="cr"><i class="cr-icon fa-check"></i></span></label></div>'
    );

  selectAllCheckbox.click(function (event) {
    var headerCheckbox = $("#dataSongTable")
        .find("th")
        .find("input[type=checkbox]"),
      allCheckboxes = $("#dataSongTable")
        .find("td")
        .find("input[type=checkbox]");
    allCheckboxes.prop("checked", headerCheckbox.is(":checked"));
  });

  for (let i = 0; i < DATA_TABLE_COLUMNS.list.length; i++) {
    $("#dataSongTable")
      .find("thead")
      .find("tr")
      .append(
        $("<th>")
          .addClass("primaryColor")
          .text(DATA_TABLE_COLUMNS.list[i].header)
      );
  }

  $("#dataSongTable")
    .find("thead")
    .find("tr")
    .children()
    .eq(DATA_TABLE_COLUMNS.getPos("CHECKBOX"))
    .text("")
    .append(selectAllCheckbox);

  dataSongTable = $("#dataSongTable")
    .DataTable({
      language: {
        emptyTable:
          '<h1 class="lead">No files added!</h1>' +
          '<br /><a href="/#2582986745&demo.mp4">Download the demo-video</a>,' +
          '<br /><br />find new songs at <a href="/find.html">troff.app/find.html</a>' +
          "<br /><br />or add your own songs by clicking the <br / >" +
          "<label " +
          'title="Add songs, videos or pictures to Troff"' +
          'class="cursor-pointer mr-2 regularButton fa-stack Small full-height-on-mobile"' +
          'for="fileUploader">' +
          '<i class="fa-music fa-stack-10x m-relative-7 font-size-relative-1"></i>' +
          '<i class="fa-plus fa-stack-10x m-relative-4 font-size-relative-65"></i>' +
          "</label>" +
          "-button at the top<br />of the song-dialog",
      },
      fixedHeader: true,
      paging: false,
      createdRow: function (row, data, dataIndex) {
        $(row).attr("draggable", "true");
      },
      columnDefs: [
        {
          targets: DATA_TABLE_COLUMNS.getPos("CHECKBOX"),
          data: null,
          className: "preventSongLoad secondaryColor",
          orderable: false,
          defaultContent:
            '<div class="checkbox"><label><input type="checkbox" value=""><span class="cr"><i class="cr-icon fa fa-check"></i></span></label></div>',
        },
        {
          targets: DATA_TABLE_COLUMNS.getPos("DISPLAY_NAME"),
          className: "min-w-200-on-attached secondaryColor",
        },
        {
          targets: DATA_TABLE_COLUMNS.getPos("EDIT"),
          data: null,
          className: "preventSongLoad secondaryColor onClickOpenEditSongDialog",
          orderable: false,
          defaultContent:
            '<button class="regularButton"><i class="cr-icon fa fa-pencil"></i></button>',
        },
        {
          targets: DATA_TABLE_COLUMNS.getPos("TYPE"),
          className: "secondaryColor text-center",
        },
        {
          targets: ["_all"],
          className: "secondaryColor",
        },
      ],
    })
    .on("dragstart", "tr", function (event) {
      //function dragSongToSonglist(event){
      if (event.dataTransfer === undefined) {
        event.dataTransfer = event.originalEvent.dataTransfer;
      }

      var jsonDataInfo = dataSongTable.row($(this)).data()[
        DATA_TABLE_COLUMNS.getPos("DATA_INFO")
      ];

      event.dataTransfer.setData("jsonDataInfo", jsonDataInfo);
    })
    .on("click", "tbody tr", function (event) {
      let $td = $(event.target).closest("td, th");
      const songKey = $(this).data("song-key");

      if ($td.hasClass("onClickOpenEditSongDialog")) {
        openEditSongDialog(songKey);
      }

      if ($td.hasClass("preventSongLoad") || $td.hasClass("dataTables_empty")) {
        return;
      }

      $("#dataSongTable")
        .DataTable()
        .rows(".selected")
        .nodes()
        .to$()
        .removeClass("selected");
      $(this).addClass("selected");

      gtag("event", "Change Song", { event_category: "Perform change" });

      createSongAudio($(this).data("song-key"));
    });

  /*
	//något att titta på: ???????? slim sim :)  (för att ordna kolumnerna :) (fixa DB sparning, o interface...x ) )
	var table = $('#table').DataTable({ colReorder: true });
	$('button#newOrder').click(function() {
			table.colReorder.order([3,4,2,0,1], true);
	});
	*/

  //to make header primaryColor:
  $("#dataSongTable thead th").removeClass("secondaryColor");

  // to move the searchbar away from the scrolling-area
  $("#dataSongTable_filter").detach().prependTo($("#newSearchParent"));
  $("#dataSongTable_filter")
    .find("input")
    .attr("placeholder", "Search (Ctrl + F)")
    .addClass("form-control-sm")
    .detach()
    .prependTo($("#dataSongTable_filter"))
    .on("click", Troff.enterSerachDataTableSongList)
    .on("keyup", Troff.onSearchKeyup)
    .on("blur", Troff.exitSerachDataTableSongList);

  $("#dataSongTable_filter").find("label").remove();

  if ($("#toggleSonglistsId").hasClass("active")) {
    $("#buttAttachedSongListToggle").addClass("active");
  }

  // Options for the observer (which mutations to observe)
  const songListsObserverConfig = {
    attributes: true,
    childList: false,
    subtree: false,
  };

  // Callback function to execute when mutations are observed
  var songListsObserverCallback = function (mutationsList, observer) {
    for (var mutation of mutationsList) {
      if (mutation.attributeName === "class") {
        var classList = mutation.target.className;
        if ($(mutation.target).hasClass("active")) {
          $("#buttAttachedSongListToggle").addClass("active");
        } else {
          $("#buttAttachedSongListToggle").removeClass("active");
        }
        return;
      }
    }
  };

  // Create an observer instance linked to the callback function
  var songListsObserver = new MutationObserver(songListsObserverCallback);
  // Start observing the target node for configured mutations
  songListsObserver.observe(
    $("#toggleSonglistsId")[0],
    songListsObserverConfig
  );
}

function openEditSongDialog(songKey) {
  let fileData = nDB.get(songKey).fileData;

  if (fileData == undefined) {
    fileData = DB.fixSongObject();
  }

  $("#editSongDialog").removeClass("hidden");

  $("#editSongFile").val(songKey);
  $("#editSongCustomName").val(fileData.customName);
  $("#editSongChoreography").val(fileData.choreography);
  $("#editSongChoreographer").val(fileData.choreographer);
  $("#editSongTitle").val(fileData.title);
  $("#editSongArtist").val(fileData.artist);
  $("#editSongAlbum").val(fileData.album);
  $("#editSongGenre").val(fileData.genre);
  $("#editSongTags").val(fileData.tags);
  Troff.onEditUpdateName();
}

function onChangeSongListSelector(event) {
  var $target = $(event.target),
    $selected = $target.find(":selected"),
    $checkedRows = $("#dataSongTable")
      .find("td")
      .find("input[type=checkbox]:checked"),
    songDataInfoList = getSelectedSongs_NEW();

  var $songlist = $("#songListList").find(
    '[data-songlist-id="' + $selected.val() + '"]'
  );

  if ($selected.val() == "+") {
    openGroupDialog({ songs: songDataInfoList });
  } else if ($selected.val() == "--remove") {
    IO.confirm(
      "Remove songs?",
      "Remove songs: <br />" +
        songDataInfoList.map((s) => s.fullPath || s.name).join("<br />") +
        "?<br /><br />Can not be undone.",
      () => {
        songDataInfoList.forEach((song) => {
          const fullPath = song.fullPath || song.data.fullPath;
          cacheImplementation.removeSong(fullPath);
        });
        $checkedRows.closest("tr").each((i, row) => {
          $("#dataSongTable").DataTable().row(row).remove().draw();
        });
      }
    );
  } else if ($selected.parent().attr("id") == "songListSelectorAddToSonglist") {
    addSongsToSonglist(songDataInfoList, $songlist);
  } else if (
    $selected.parent().attr("id") == "songListSelectorRemoveFromSonglist"
  ) {
    removeSongsFromSonglist(songDataInfoList, $songlist);
  } else {
    log.e("something wrong");
  }

  $target.val("-");
}
