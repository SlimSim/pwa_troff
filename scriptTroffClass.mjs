var TroffClass = function () {
  var strCurrentSong = "";
  var iCurrentGalleryId = 0;
  var startTime = 0; // unused?
  var previousTime = 0; // unused?
  var time = 0; // unused?
  var nrTapps = 0;
  var m_zoomStartTime = 0;
  var m_zoomEndTime = null;

  /*Troff*/ this.addAskedSongsToCurrentSongList = function (
    event,
    songKeys,
    $songList
  ) {
    $(event.target).addClass("active");
    $("#addAddedSongsToSongList_doNotAdd").addClass("hidden");
    $("#addAddedSongsToSongList_done").removeClass("hidden");

    let songs = [];

    songKeys.each((i, songKey) => {
      songs.push({
        name: songKey,
        data: {
          galleryId: "pwa-galleryId",
          fullPath: songKey,
        },
      });
    });

    addSongsToSonglist(songs, $songList);

    const nrPossibleSongListsToAddTo = $(
      "#addAddedSongsToSongList_currentSongLists"
    ).children().length;
    const nrAlreadySongListsToAddTo = $(
      "#addAddedSongsToSongList_currentSongLists .active"
    ).length;
    if (nrPossibleSongListsToAddTo == nrAlreadySongListsToAddTo) {
      $("#addAddedSongsToSongList_songs").empty();
      $("#addAddedSongsToSongList").addClass("hidden");
    }

    filterSongTable(getFilterDataList());
  };

  /*Troff*/ this.askIfAddSongsToCurrentSongList = function (key) {
    if ($("#songListAll").hasClass("selected")) {
      return;
    }

    $("#addAddedSongsToSongList_doNotAdd").removeClass("hidden");
    $("#addAddedSongsToSongList_done").addClass("hidden");
    $("#addAddedSongsToSongList").removeClass("hidden");
    $("#addAddedSongsToSongList_songs").append($("<li>").text(key));
    $("#addAddedSongsToSongList_currentSongLists").empty();

    let songKeys = $("#addAddedSongsToSongList_songs")
      .children()
      .map((i, v) => $(v).text());

    $(".songlist.selected, .songlist.active").each((i, songList) => {
      $("#addAddedSongsToSongList_currentSongLists").append(
        $("<li>").append(
          $("<button>")
            .addClass("regularButton")
            .text('Add songs to "' + $(songList).text() + '"')
            .click((event) =>
              Troff.addAskedSongsToCurrentSongList(event, songKeys, $(songList))
            )
        )
      );
    });

    const songListName = $(".songlist.selected").text();
  };

  /*Troff*/ this.emptyAddAddedSongsToSongList_songs = function (event) {
    if (!$(event.target).hasClass("emptyAddAddedSongsToSongList_songs")) {
      return;
    }
    $("#addAddedSongsToSongList_songs").empty();
  };

  /*Troff*/ this.initFileApiImplementation = function () {
    $("#fileUploader").on("change", (event) => {
      fileHandler.handleFiles(event.target.files, (key, file) => {
        if (nDB.get(key) == null) {
          let newSongObject = DB.fixSongObject();
          newSongObject.localInformation = {
            addedFromThisDevice: true,
          };
          newSongObject.fileData = {
            lastModified: file.lastModified,
            size: file.size,
          };
          nDB.set(key, newSongObject);
        } else {
          nDB.setOnSong(key, ["localInformation", "addedFromThisDevice"], true);
        }

        Troff.askIfAddSongsToCurrentSongList(key);
        addItem_NEW_2(key);
        if (!$("#dataSongTable_wrapper").find("tr").hasClass("selected")) {
          Troff.selectSongInSongList(key);
          createSongAudio(key);
        }

        $.notify(key + " was successfully added");
      });
    });

    //loadAllFiles:
    cacheImplementation.getAllKeys().then((keys) => {
      keys.forEach(addItem_NEW_2);
    });
  };

  /*Troff*/ this.setUrlToSong = function (serverId, fileName) {
    "use strict";
    if (serverId === undefined) {
      if (!window.location.hash) {
        return;
      }
      // remove url-hash completely:
      history.pushState(
        "",
        document.title,
        window.location.pathname + window.location.search
      );
      return;
    }
    window.location.hash = Troff.createHash(serverId, fileName);
  };

  /*Troff*/ this.createHash = function (serverId, fileName) {
    return "#" + serverId + "&" + encodeURI(fileName);
  };

  /*Troff*/ this.removeLocalInfo = function (markerObject) {
    markerObject.localInformation = undefined;
    return markerObject;
  };

  /*Troff*/ this.uploadSongToServer = async function (event) {
    "use strict";

    // show a pop-up that says
    // "song is being uploaded, will let you know when it is done"
    // alt 1, please do not close this app in the mean time
    // alt 2, please do not switch song in the mean time....

    const songKey = Troff.getCurrentSong();

    $("#uploadSongToServerInProgressDialog").removeClass("hidden");
    try {
      const markerObject = nDB.get(songKey);
      const fakeTroffData = {
        markerJsonString: JSON.stringify(markerObject),
      };

      //removing localInformation before sending it to server:
      const publicData = Troff.removeLocalInfo(markerObject);

      let resp = await fileHandler.sendFile(songKey, publicData);

      nDB.setOnSong(songKey, "serverId", resp.id);
      nDB.setOnSong(songKey, "fileUrl", resp.fileUrl);

      Troff.saveDownloadLinkHistory(resp.id, resp.fileName, fakeTroffData);

      if (songKey == Troff.getCurrentSong()) {
        Troff.setUrlToSong(resp.id, resp.fileName);
      }

      $("#uploadSongToServerInProgressDialog").addClass("hidden");
      $("#shareSongUrl").val(
        window.location.origin + Troff.createHash(resp.id, resp.fileName)
      );
      $("#doneUploadingSongToServerDialog_songName").text(songKey);
      $("#doneUploadingSongToServerLink").attr(
        "href",
        "/find.html#id=" + resp.fileName
      );
      $("#doneUploadingSongToServerDialog").removeClass("hidden");
    } catch (error) {
      return errorHandler.fileHandler_sendFile(error, songKey);
    }
  };

  /*Troff*/ this.buttCopyUrlToClipboard = function () {
    let url = $("#doneUploadingSongToServerDialog").find("#shareSongUrl").val();

    IO.copyTextToClipboard(url);
  };

  /*Troff*/ this.showUploadSongToServerDialog = function () {
    if (window.location.hash) {
      $("#shareSongUrl").val(window.location.href);
      $(".showOnUploadComplete").addClass("hidden");
      $(".showOnSongAlreadyUploaded").removeClass("hidden");

      $("#doneUploadingSongToServerDialog_songName").text(
        Troff.getCurrentSong()
      );
      $("#doneUploadingSongToServerLink").attr(
        "href",
        "/find.html#id=" + Troff.getCurrentSong()
      );
      $("#doneUploadingSongToServerDialog").removeClass("hidden");
    } else {
      if (!Troff.getCurrentSong()) {
        IO.alert(
          "No Song",
          "You do not have a song to upload yet.<br />Add a song to Troff and then try again!"
        );
        return;
      }

      if (!window.navigator.onLine) {
        IO.alert(
          "Offline",
          "You appear to be offline, please wait until you have an internet connection and try again then."
        );
        return;
      }

      $(".showOnUploadComplete").removeClass("hidden");
      $(".showOnSongAlreadyUploaded").addClass("hidden");
      $("#uploadSongToServerDialog").removeClass("hidden");
    }
  };

  /*Troff*/ this.selectSongInSongList = function (fileName) {
    $("#dataSongTable").find("tbody tr").removeClass("selected");
    $('[data-song-key="' + fileName + '"]').addClass("selected");
  };

  /*Troff*/ this.importTroffDataToExistingSong_importNew = async function (
    event
  ) {
    const fileName = $("#importTroffDataToExistingSong_fileName").val();
    const serverId = $("#importTroffDataToExistingSong_serverId").val();

    Troff.showMarkersDownloadInProgressDialog(fileName);
    const hash = "#" + serverId + "&" + encodeURI(fileName);
    gtag("event", "Download Markers", {
      event_category: "Perform change",
      event_label: hash,
    });

    let troffData;
    try {
      troffData = await backendService.getTroffData(serverId, fileName);
    } catch (error) {
      return errorHandler.backendService_getTroffData(
        error,
        serverId,
        fileName
      );
    }

    Troff.saveDownloadLinkHistory(Number(serverId), fileName, troffData);

    let markers = JSON.parse(troffData.markerJsonString);
    markers.serverId = serverId;
    markers.fileUrl = troffData.fileUrl;
    let oldMarkers = nDB.get(troffData.fileName) || {};
    markers.localInformation = oldMarkers.localInformation;

    try {
      let saveToDBResponse = nDB.set(troffData.fileName, markers);
      let doneSaveToDB = await saveToDBResponse;
    } catch (error) {
      return errorHandler.fileHandler_fetchAndSaveResponse(error, fileName);
    }

    await createSongAudio(troffData.fileName);
    Troff.selectSongInSongList(troffData.fileName);
  };

  /*Troff*/ this.importTroffDataToExistingSong_merge = async function (event) {
    const fileName = $("#importTroffDataToExistingSong_fileName").val();
    const serverId = $("#importTroffDataToExistingSong_serverId").val();

    Troff.showMarkersDownloadInProgressDialog(fileName);
    const hash = "#" + serverId + "&" + encodeURI(fileName);
    gtag("event", "Download Markers", {
      event_category: "Perform change",
      event_label: hash,
    });

    const markersFromCache = nDB.get(fileName);
    let markersFromServer;
    try {
      let troffDataFromServer = await backendService.getTroffData(
        serverId,
        fileName
      );
      markersFromServer = JSON.parse(troffDataFromServer.markerJsonString);

      Troff.saveDownloadLinkHistory(
        Number(serverId),
        fileName,
        troffDataFromServer
      );
    } catch (error) {
      return errorHandler.backendService_getTroffData(
        error,
        serverId,
        fileName
      );
    }

    await createSongAudio(fileName);
    Troff.selectSongInSongList(fileName);

    const aoStates = [];
    for (let i = 0; i < markersFromServer.aStates.length; i++) {
      const parsedState = JSON.parse(markersFromServer.aStates[i]);
      aoStates.push(
        Troff.replaceMarkerIdWithMarkerTimeInState(
          parsedState,
          markersFromServer.markers
        )
      );
    }

    let oImport = {};
    oImport.strSongInfo = markersFromServer.info;
    oImport.aoStates = aoStates;
    oImport.aoMarkers = markersFromServer.markers;

    setTimeout(function () {
      Troff.doImportStuff(oImport);
    }, 42);
  };

  /*Troff*/ this.importTroffDataToExistingSong_keepExisting = async function (
    event
  ) {
    const fileName = $("#importTroffDataToExistingSong_fileName").val();
    const serverId = $("#importTroffDataToExistingSong_serverId").val();

    await createSongAudio(fileName);
    Troff.selectSongInSongList(fileName);
  };

  /*Troff*/ this.saveDownloadLinkHistory = function (
    serverTroffDataId,
    fileName,
    troffData
  ) {
    const fileNameUri = encodeURI(fileName);

    const markerObject = JSON.parse(troffData.markerJsonString);

    const fileData = markerObject.fileData;

    let displayName = fileName;
    const nrMarkers = markerObject.markers.length;
    const nrStates = markerObject.aStates ? markerObject.aStates.length : 0;
    const info = markerObject.info.substring(0, 99);
    let genre = "";
    let tags = "";

    if (fileData) {
      displayName =
        fileData.customName ||
        fileData.choreography ||
        fileData.title ||
        displayName;
      genre = fileData.genre || genre;
      tags = fileData.tags || tags;
    }

    const serverSongs = nDB.get(TROFF_TROFF_DATA_ID_AND_FILE_NAME);

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

    const existingServerSong = serverSongs.find(
      (ss) => ss.fileNameUri == fileNameUri
    );

    if (!existingServerSong) {
      serverSongs.push(serverSong);
      nDB.set(TROFF_TROFF_DATA_ID_AND_FILE_NAME, serverSongs);
      updateUploadedHistory();
      return;
    }

    if (
      !existingServerSong.troffDataIdObjectList.some(
        (td) => td.troffDataId == serverTroffDataId
      )
    ) {
      existingServerSong.troffDataIdObjectList.push(troffDataIdObject);
      nDB.set(TROFF_TROFF_DATA_ID_AND_FILE_NAME, serverSongs);
      updateUploadedHistory();
      return;
    }
  };

  /*Troff*/ this.showImportData = function (fileName, serverId) {
    "use strict";
    $("#importTroffDataToExistingSong_songName").text(fileName);
    $("#importTroffDataToExistingSong_fileName").val(fileName);
    $("#importTroffDataToExistingSong_serverId").val(serverId);
    $("#downloadSongFromServerInProgressDialog").addClass("hidden");
    $("#importTroffDataToExistingSongDialog").removeClass("hidden");
    IO.removeLoadScreen();
  };

  /*Troff*/ this.showMarkersDownloadInProgressDialog = function (songName) {
    $(".downloadSongFromServerInProgressDialog_songName").text(songName);
    $("#downloadSongFromServerInProgressDialog").removeClass("hidden");
    $(".downloadSongFromServerInProgressDialog_song").addClass("hidden");
    $(".downloadSongFromServerInProgressDialog_markers").removeClass("hidden");
  };

  /*Troff*/ this.showDownloadSongFromServerInProgress = function (songName) {
    "use strict";
    $("#downloadPercentDone").text(0);
    $(".downloadSongFromServerInProgressDialog_songName").text(songName);
    $("#downloadSongFromServerInProgressDialog").removeClass("hidden");
    $(".downloadSongFromServerInProgressDialog_song").removeClass("hidden");
    $(".downloadSongFromServerInProgressDialog_markers").addClass("hidden");
    IO.removeLoadScreen();
  };

  /*Troff*/ this.downloadSongFromServerButDataFromCacheExists = async function (
    fileName,
    serverId,
    troffDataFromCache
  ) {
    "use strict";

    let fileDoesExists = await fileHandler.doesFileExistInCache(fileName);

    if (fileDoesExists) {
      if (serverId == troffDataFromCache.serverId) {
        const currentSongTroffData = nDB.get(Troff.getCurrentSong());
        if (currentSongTroffData && currentSongTroffData.serverId == serverId) {
          return;
        }
        await createSongAudio(fileName);
        Troff.selectSongInSongList(fileName);
      } else {
        Troff.showImportData(fileName, serverId);
      }
      return;
    }

    Troff.showDownloadSongFromServerInProgress(fileName);
    const hash = "#" + serverId + "&" + encodeURI(fileName);
    gtag("event", "Download Song", {
      event_category: "Perform change",
      event_label: hash,
    });

    let troffData;
    try {
      troffData = await backendService.getTroffData(serverId, fileName);
    } catch (error) {
      return errorHandler.backendService_getTroffData(
        error,
        serverId,
        fileName
      );
    }

    Troff.saveDownloadLinkHistory(Number(serverId), fileName, troffData);

    try {
      await fileHandler.fetchAndSaveResponse(troffData.fileUrl, fileName);
    } catch (error) {
      return errorHandler.fileHandler_fetchAndSaveResponse(error, fileName);
    }

    if (serverId == troffDataFromCache.serverId) {
      await createSongAudio(fileName);
      addItem_NEW_2(fileName);

      $.notify(fileName + " was successfully added");
    } else {
      Troff.showImportData(fileName, serverId);
    }
  };

  /*Troff*/ this.downloadSongFromServer = async function (hash) {
    "use strict";
    const [serverId, fileNameURI] = hash.substr(1).split("&");
    const fileName = decodeURI(fileNameURI);
    const troffDataFromCache = nDB.get(fileName);
    let troffData;

    if (troffDataFromCache != null) {
      return Troff.downloadSongFromServerButDataFromCacheExists(
        fileName,
        serverId,
        troffDataFromCache
      );
    }
    Troff.showDownloadSongFromServerInProgress(fileName);
    gtag("event", "Download Song", {
      event_category: "Perform change",
      event_label: hash,
    });

    try {
      troffData = await backendService.getTroffData(serverId, fileName);
    } catch (error) {
      return errorHandler.backendService_getTroffData(
        error,
        serverId,
        fileName
      );
    }
    Troff.saveDownloadLinkHistory(Number(serverId), fileName, troffData);

    let markers = JSON.parse(troffData.markerJsonString);
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

    await createSongAudio(troffData.fileName);
    Troff.askIfAddSongsToCurrentSongList(troffData.fileName);
    addItem_NEW_2(troffData.fileName);
    $.notify(troffData.fileName + " was successfully added");
  };

  /*Troff*/ this.editSongDialogSave = (event) => {
    const key = $("#editSongFile").val();
    const songObject = nDB.get(key);

    songObject.fileData.customName = $("#editSongCustomName").val();
    songObject.fileData.choreography = $("#editSongChoreography").val();
    songObject.fileData.choreographer = $("#editSongChoreographer").val();
    songObject.fileData.title = $("#editSongTitle").val();
    songObject.fileData.artist = $("#editSongArtist").val();
    songObject.fileData.album = $("#editSongAlbum").val();
    songObject.fileData.genre = $("#editSongGenre").val();
    songObject.fileData.tags = $("#editSongTags").val();

    IO.updateCellInDataTable(
      "DISPLAY_NAME",
      $("#editSongDisplayName").val(),
      key
    );
    IO.updateCellInDataTable(
      "CUSTOM_NAME",
      songObject.fileData.customName,
      key
    );
    IO.updateCellInDataTable(
      "CHOREOGRAPHY",
      songObject.fileData.choreography,
      key
    );
    IO.updateCellInDataTable(
      "CHOREOGRAPHER",
      songObject.fileData.choreographer,
      key
    );
    IO.updateCellInDataTable("TITLE", songObject.fileData.title, key);
    IO.updateCellInDataTable("ARTIST", songObject.fileData.artist, key);
    IO.updateCellInDataTable("ALBUM", songObject.fileData.album, key);
    IO.updateCellInDataTable("GENRE", songObject.fileData.genre, key);
    IO.updateCellInDataTable("TAGS", songObject.fileData.tags, key);

    nDB.set(key, songObject);
    ifGroupSongUpdateFirestore(key);
  };

  /*Troff*/ this.onEditUpdateName = () => {
    const displayName =
      $("#editSongCustomName").val() ||
      $("#editSongChoreography").val() ||
      $("#editSongTitle").val() ||
      Troff.pathToName($("#editSongFile").val());
    $("#editSongDisplayName").val(displayName);
  };

  /*Troff*/ this.enterWritableField = function () {
    IO.setEnterFunction(function (event) {
      if (event.ctrlKey == 1) {
        //Ctrl+Enter will exit
        IO.blurHack();
        return false;
      }
      return true;
    });
  };

  /*Troff*/ this.exitWritableField = function () {
    IO.clearEnterFunction();
  };

  this.recallFloatingDialog = function () {
    DB.getVal(
      "TROFF_SETTING_SONG_LIST_FLOATING_DIALOG",
      function (floatingDialog) {
        if (floatingDialog) {
          moveSongPickerToFloatingState();
        } else {
          moveSongPickerToAttachedState();
        }
      }
    );
  };

  this.recallSongColumnToggle = function (callback) {
    DB.getVal(TROFF_SETTING_SONG_COLUMN_TOGGLE, function (columnToggle) {
      if (columnToggle === undefined) {
        setTimeout(function () {
          Troff.recallSongColumnToggle(callback);
        }, 42);
        return;
      }

      DATA_TABLE_COLUMNS.list.forEach((v, i) => {
        if (v.hideFromUser) {
          const column = $("#dataSongTable")
            .DataTable()
            .column(DATA_TABLE_COLUMNS.getPos(v.id));
          column.visible(false);
          return;
        }

        $("#columnToggleParent").append(
          $("<input>")
            .attr("type", "button")
            .attr("data-column", i)
            .addClass("stOnOffButton")
            .toggleClass("active", columnToggle[v.id])
            .val(v.header)
            .click(dataTableColumnPicker)
        );
      });
      callback();
    });
  };

  this.toggleExtendedMarkerColor = function (event) {
    if ($("#markerList").hasClass("extended-color")) {
      $("#markerList").removeClass("extended-color");
      $("#toggleExtendedMarkerColor").removeClass("active");
      DB.saveVal(TROFF_SETTING_EXTENDED_MARKER_COLOR, false);
    } else {
      $("#markerList").addClass("extended-color");
      $("#toggleExtendedMarkerColor").addClass("active");
      DB.saveVal(TROFF_SETTING_EXTENDED_MARKER_COLOR, true);
    }
  };

  this.recallExtendedMarkerColor = function () {
    DB.getVal(TROFF_SETTING_EXTENDED_MARKER_COLOR, function (extend) {
      if (extend) {
        $("#markerList").addClass("extended-color");
        $("#toggleExtendedMarkerColor").addClass("active");
      }
    });
  };

  this.toggleExtraExtendedMarkerColor = function (event) {
    if ($("#markerList").hasClass("extra-extended")) {
      $("#markerList").removeClass("extra-extended");
      $("#toggleExtraExtendedMarkerColor").removeClass("active");
      DB.saveVal(TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR, false);
    } else {
      $("#markerList").addClass("extra-extended");
      $("#toggleExtraExtendedMarkerColor").addClass("active");
      DB.saveVal(TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR, true);
    }
  };

  this.recallExtraExtendedMarkerColor = function () {
    DB.getVal(TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR, function (extend) {
      if (extend || extend === null) {
        $("#markerList").addClass("extra-extended");
        $("#toggleExtraExtendedMarkerColor").addClass("active");
      }
    });
  };

  this.setTheme = function (event) {
    var $target = $(event.target),
      theme = $target.data("theme");
    $target
      .closest("#themePickerParent")
      .find(".selected")
      .removeClass("selected");
    $target.addClass("selected");
    Troff.updateHrefForTheme(theme);

    DB.saveVal(TROFF_SETTING_SET_THEME, theme);
  };

  /*Troff*/ this.updateHrefForTheme = function (theme) {
    "use strict";
    $("body")
      .removeClassStartingWith("theme-")
      .addClass("theme-" + theme);
  };

  this.recallGlobalSettings = function () {
    Troff.recallTheme();
    Troff.recallExtendedMarkerColor();
    Troff.recallExtraExtendedMarkerColor();
    Troff.recallSongColumnToggle(function () {
      Troff.recallFloatingDialog();
    });
  };

  this.recallTheme = function () {
    DB.getVal(TROFF_SETTING_SET_THEME, function (theme) {
      theme = theme || "col1";
      $("#themePickerParent")
        .find('[data-theme="' + theme + '"]')
        .addClass("selected");
      Troff.updateHrefForTheme(theme);
    });
  };

  this.closeSettingsDialog = function (event) {
    $("#outerSettingPopUpSquare").addClass("hidden");
  };
  this.openSettingsDialog = function (event) {
    $("#outerSettingPopUpSquare").removeClass("hidden");
    gtag("event", "Open Settings", { event_category: "Clicking Button" });
  };

  //Public variables:
  this.dontShowZoomInstructions = false;

  this.firstTimeUser = function () {
    $("#firstTimeUserDialog").removeClass("hidden");
  };

  // this is regarding the "play in fullscreen" - button
  this.setPlayInFullscreen = function (bPlayInFullscreen) {
    if (bPlayInFullscreen) {
      $("#playInFullscreenButt").addClass("active");
    } else {
      $("#playInFullscreenButt").removeClass("active");
    }
  };

  this.setMirrorImage = function (bMirrorImage) {
    if (bMirrorImage) {
      $("#mirrorImageButt").addClass("active");
      $("#videoBox").addClass("flip-horizontal");
    } else {
      $("#mirrorImageButt").removeClass("active");
      $("#videoBox").removeClass("flip-horizontal");
    }
  };

  // this is regarding the "play in fullscreen" - button
  this.playInFullscreenChanged = function () {
    var butt = document.querySelector("#playInFullscreenButt");
    butt.classList.toggle("active");

    var bFullScreen = butt.classList.contains("active");
    DB.setCurrent(strCurrentSong, "bPlayInFullscreen", bFullScreen);

    IO.blurHack();
  };

  this.mirrorImageChanged = function (event) {
    var bMirrorImage = !$(event.target).hasClass("active");
    DB.setCurrent(strCurrentSong, "bMirrorImage", bMirrorImage);
    Troff.setMirrorImage(bMirrorImage);

    IO.blurHack();
  };

  this.setImageLayout = function () {
    $("body").addClass("pictureActive");
  };
  this.setAudioVideoLayout = function () {
    $("body").removeClass("pictureActive");
  };

  // this is regarding the f-key, IE- the actual fullscreen
  this.forceFullscreenChange = function () {
    var videoBox = document.querySelector("#videoBox");
    if (!videoBox) return;
    //		var infoSection = document.querySelector('#infoSection');
    if (videoBox.classList.contains("fullscreen")) {
      videoBox.classList.remove("fullscreen");
    } else {
      videoBox.classList.add("fullscreen");
    }
  };

  // this is regarding the f/esc-key, IE- the actual fullscreen
  this.forceNoFullscreen = function () {
    var videoBox = document.querySelector("#videoBox");
    if (!videoBox) return;
    videoBox.classList.remove("fullscreen");
  };

  /* this funciton is called when the full song/video is loaded,
   * it should thus do the things that conect player to Troff...
   */
  this.setMetadata = function (media) {
    let key = Troff.getCurrentSong();

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
        "DURATION",
        sortAndValue(media.duration, Troff.secToDisp(media.duration))
      );
    }

    var songLength = media.duration;
    document.getElementById("timeBar").max = media.duration;
    $("#maxTime")[0].innerHTML = Troff.secToDisp(media.duration);

    // TODO: Flytta allt i getSongMedaDataOf hit, där det hör hemma, jag har ju lixom songObject!
    DB.getSongMetaDataOf(key);

    $("#currentArtist").text(
      songObject.fileData.choreographer || songObject.fileData.artist
    );
    $("#currentSong").text(
      songObject.fileData.customName ||
        songObject.fileData.choreography ||
        songObject.fileData.title ||
        Troff.pathToName(key)
    );
    $("#currentAlbum").text(songObject.fileData.album);

    media.addEventListener("timeupdate", Troff.timeupdateAudio);
    IO.removeLoadScreen();
  };

  this.setMetadataImage = function (media) {
    IO.removeLoadScreen();
    DB.getImageMetaDataOf(Troff.getCurrentSong());
  };

  this.getStandardMarkerInfo = function () {
    return (
      "This text is specific for every selected marker. " +
      "Notes written here will be automatically saved." +
      "\n\nUse this area for things regarding this marker."
    );
  };

  this.setWaitBetweenLoops = function (bActive, iWait) {
    $("#waitBetweenLoops").val(iWait);
    if (bActive) {
      $("#buttWaitBetweenLoops").addClass("active");
      $("#waitBetweenLoops").removeClass("grayOut");
    } else {
      $("#buttWaitBetweenLoops").removeClass("active");
      $("#waitBetweenLoops").addClass("grayOut");
    }
  };

  this.getWaitBetweenLoops = function () {
    if ($("#waitBetweenLoops").hasClass("grayOut")) return 0;
    return $("#waitBetweenLoops").val();
  };

  this.getNewMarkerId = function () {
    return Troff.getNewMarkerIds(1)[0];
  };

  this.getNewMarkerIds = function (iNrOfIds) {
    var a = [];
    var aRet = [];
    var nr = 0;
    for (var i = 0; i < iNrOfIds; i++) {
      while ($("#markerNr" + nr).length > 0 || a.indexOf(nr) != -1) {
        nr++;
      }
      a[i] = nr;
      aRet[i] = "markerNr" + nr;
    }
    return aRet;
  };

  this.updateStartBefore = function () {
    var goToMarker = $(
      "#" + TROFF_SETTING_ON_SELECT_MARKER_GO_TO_MARKER
    ).hasClass("active");
    if ($("audio, video")[0].paused && goToMarker) Troff.goToStartMarker();
    Troff.setAppropriateActivePlayRegion();
  };

  this.speedUpdate = function () {
    var sliderVal = document.getElementById("speedBar").value;
    $("#speed, #speedDemo").html(sliderVal);
    $("audio, video")[0].playbackRate = sliderVal / 100;
  };

  /*Troff*/ this.setSpeed = function (speed) {
    $("#speedBar").val(speed);
    $("#speedBar")[0].dispatchEvent(new Event("input"));
    gtag("event", "Change Speed", {
      event_category: "Perform change",
      event_label: speed,
    });
  };

  this.volumeUpdate = function () {
    var sliderVal = document.getElementById("volumeBar").value;
    $("#volume").html(sliderVal);
    $("audio, video")[0].volume = sliderVal / 100;
  };

  this.setVolume = function (volume) {
    $("#volumeBar").val(volume);
    $("#volumeBar")[0].dispatchEvent(new Event("input"));
  };

  /* This is used when the value of the slider is changed,
   * to update the audio / video
   */
  this.timeUpdate = function () {
    var sliderVal = document.getElementById("timeBar").value;
    $("#time").html(Troff.secToDisp(sliderVal));

    if (sliderVal > Troff.getStopTime()) {
      var aFirstAndLast = Troff.getFirstAndLastMarkers();
      var firstMarkerId = aFirstAndLast[0];
      var lastMarkerId = aFirstAndLast[1] + "S";

      if (sliderVal < $("#" + lastMarkerId)[0].timeValue)
        Troff.selectStopMarker(lastMarkerId);
      else {
        IO.confirm(
          "Out of range",
          "You pressed outside the playing region, " +
            "do you want to add a marker to the end of the song?",
          function () {
            var songLength = Number(document.getElementById("timeBar").max);

            var oMarker = {};
            oMarker.name = "End";
            oMarker.time = songLength;
            oMarker.info = "";
            oMarker.id = Troff.getNewMarkerId();

            aMarkers = [oMarker];
            Troff.addMarkers(aMarkers); // adds marker to html
            DB.saveMarkers(Troff.getCurrentSong()); // saves end marker to DB

            var aFirstAndLast = Troff.getFirstAndLastMarkers();
            var firstMarkerId = aFirstAndLast[0];
            var lastMarkerId = aFirstAndLast[1] + "S";
            Troff.selectStopMarker(lastMarkerId);
            document.querySelector("audio, video").currentTime = sliderVal;
          }
        );
      }
    } // end if

    document.querySelector("audio, video").currentTime = sliderVal;
  }; // end timeUpdate

  this.getStopTime = function () {
    var extraTime = 0;

    if ($("audio, video").length === 0) {
      return 0;
    }

    if ($("#buttStopAfter").hasClass("active"))
      extraTime = $("#stopAfter").val() ? $("#stopAfter").val() : 0;
    if ($(".currentStopMarker")[0])
      return Math.min(
        parseFloat($(".currentStopMarker")[0].timeValue) +
          parseFloat(extraTime),
        $("audio, video")[0].duration
      );
    else return $("audio, video")[0].duration;
  };

  this.getStartTime = function () {
    if ($(".currentMarker")[0]) {
      //if there is a start marker
      var extraTime = 0;
      if ($("#buttStartBefore").hasClass("active"))
        extraTime = $("#startBefore").val() ? $("#startBefore").val() : 0;
      return Math.max(
        parseFloat($(".currentMarker")[0].timeValue) - parseFloat(extraTime),
        0
      );
    }
    return 0;
  };

  /*Troff*/ this.setLoopTo = function (number) {
    if (number === undefined) {
      number = $("#TROFF_SETTING_SONG_DEFAULT_NR_LOOPS_INFINIT_IS_ON").hasClass(
        "active"
      )
        ? 0
        : $("#TROFF_SETTING_SONG_DEFAULT_NR_LOOPS_VALUE").val();
    }

    if (number === 0) number = "Inf";

    $(".currentLoop").removeClass("currentLoop");
    if (number) {
      $("#buttLoop" + number).addClass("currentLoop");
    } else {
      $(this).addClass("currentLoop");
    }
    Troff.updateLoopTimes();
  };

  this.setLoop = function (mode) {
    $(".currentLoop").removeClass("currentLoop");
    $(this).addClass("currentLoop");
    gtag("event", "Change loop", {
      event_category: "Perform change",
      event_label: $(mode.target).val(),
    });

    Troff.updateLoopTimes();
    IO.blurHack();
  };

  this.updateLoopTimes = function () {
    var dbLoop = "";
    if ($("#buttLoopInf").hasClass("currentLoop")) dbLoop = "Inf";
    else dbLoop = $(".currentLoop").val();

    if (strCurrentSong) DB.setCurrent(strCurrentSong, "loopTimes", dbLoop);

    IO.loopTimesLeft($(".currentLoop").val());
  }; // end updateLoopTimes

  this.getMood = function () {
    if ($("#infoSection").hasClass("pause")) return "pause";
    if ($("#infoSection").hasClass("wait")) return "wait";
    if ($("#infoSection").hasClass("play")) return "play";
    log.e("infoSection hase not correct class!");
  };

  /* this is used every time the time changes in the audio / video */
  /*Troff*/ this.timeupdateAudio = function () {
    var audio = document.querySelector("audio, video");
    var dTime = audio.currentTime;

    if (dTime >= Troff.getStopTime()) {
      Troff.atEndOfLoop();
    }

    $("#time").html(Troff.secToDisp(dTime));
    document.getElementById("timeBar").value = dTime;
  }; // end timeupdateAudio

  /*Troff*/ this.atEndOfLoop = function () {
    var audio = document.querySelector("audio, video");
    Troff.goToStartMarker();
    var dTime = audio.currentTime;
    audio.pause();

    if (Troff.isLoopInfinite()) {
      Troff.doIncrementSpeed();
      Troff.playSong(Troff.getWaitBetweenLoops() * 1000);
    } else {
      if (IO.loopTimesLeft() > 1) {
        IO.loopTimesLeft(-1);
        Troff.doIncrementSpeed();
        Troff.playSong(Troff.getWaitBetweenLoops() * 1000);
      } else {
        IO.loopTimesLeft($("#loopTimes").val());
        Troff.pauseSong();
      }
    } // end else
  }; // end atEndOfLoop

  //	this.isLoopOn = function(){
  //		return !$('#buttLoopOff').hasClass('currentLoop');
  //	};

  this.isLoopInfinite = function () {
    return $("#buttLoopInf").hasClass("currentLoop");
  };

  /*Troff*/ this.doIncrementSpeed = function () {
    if (!$("#buttIncrementUntil").hasClass("active")) {
      return;
    }

    var loopTimesLeft,
      speedDiffLeft,
      incrementSpeedBy,
      incrementUntill = parseInt($("#incrementUntilValue").val()),
      currentSpeed = $("audio, video")[0].playbackRate * 100;

    speedDiffLeft = incrementUntill - currentSpeed;

    if (Troff.isLoopInfinite()) {
      if (speedDiffLeft == 0) {
        incrementSpeedBy = 0;
      } else {
        incrementSpeedBy = speedDiffLeft > 0 ? 1 : -1;
      }

      $("#speedBar").val(currentSpeed + incrementSpeedBy);
    } else {
      loopTimesLeft = parseInt(IO.loopTimesLeft());
      incrementSpeedBy = speedDiffLeft / loopTimesLeft;

      $("#speedBar").val(currentSpeed + incrementSpeedBy);
    }

    Troff.speedUpdate();
  };

  // goToStartMarker används när man updaterar startBefore / trycker på StartBefore  / trycker på en marker???
  /*Troff*/ this.goToStartMarker = function () {
    document.querySelector("audio, video").currentTime = Troff.getStartTime();
  }; // end goToStartMarker

  this.enterKnappen = function () {
    var goToMarker = $(
        "#" + TROFF_SETTING_ENTER_GO_TO_MARKER_BEHAVIOUR
      ).hasClass("active"),
      updateLoopTimes = $("#" + TROFF_SETTING_ENTER_RESET_COUNTER).hasClass(
        "active"
      ),
      useTimer = $("#" + TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR).hasClass(
        "active"
      );
    Troff.spaceOrEnter(goToMarker, useTimer, updateLoopTimes);
  }; // end enterKnappen

  this.space = function () {
    var goToMarker = $(
        "#" + TROFF_SETTING_SPACE_GO_TO_MARKER_BEHAVIOUR
      ).hasClass("active"),
      updateLoopTimes = $("#" + TROFF_SETTING_SPACE_RESET_COUNTER).hasClass(
        "active"
      ),
      useTimer = $("#" + TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR).hasClass(
        "active"
      );
    Troff.spaceOrEnter(goToMarker, useTimer, updateLoopTimes);
  }; // end space()

  this.playUiButton = function () {
    var goToMarker = $(
        "#" + TROFF_SETTING_PLAY_UI_BUTTON_GO_TO_MARKER_BEHAVIOUR
      ).hasClass("active"),
      updateLoopTimes = $(
        "#" + TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER
      ).hasClass("active"),
      useTimer = $(
        "#" + TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR
      ).hasClass("active");
    Troff.spaceOrEnter(goToMarker, useTimer, updateLoopTimes);
  };

  this.spaceOrEnter = function (goToMarker, useTimer, updateLoopTimes) {
    var audio = document.querySelector("audio, video");
    if (!audio) {
      log.e("no song loaded");
      return;
    }

    if (goToMarker) {
      Troff.goToStartMarker();
    }
    if (Troff.getMood() == "pause") {
      if (useTimer && $("#buttPauseBefStart").hasClass("active")) {
        Troff.playSong($("#pauseBeforeStart").val() * 1000);
      } else {
        Troff.playSong();
      }
    } else {
      Troff.pauseSong(updateLoopTimes);
    }
    IO.blurHack();
  }; // end spaceOrEnter()

  /*Troff*/ this.playSong = function (wait) {
    wait = wait || 0;
    var audio = document.querySelector("audio, video");
    if (!audio) return;

    gtag("event", "Start song", { event_category: "Perform change" });

    var secondsLeft = wait / 1000;
    $(".secondsLeft").html(secondsLeft);

    if (Troff.stopTimeout) clearInterval(Troff.stopTimeout);
    Troff.setMood("wait");

    let localPlayAndSetMood = function () {
      if (Troff.getMood() == "pause") return;
      audio.play();
      Troff.setMood("play");
    };

    if (wait > 0) {
      // Hack to force Safari to play the sound after the timeout:
      if (isSafari) {
        audio.play();
        audio.pause();
      }
      Troff.stopTimeout = setTimeout(localPlayAndSetMood, wait);
    } else {
      localPlayAndSetMood();
    }

    // stopInterval is the counter
    if (Troff.stopInterval) clearInterval(Troff.stopInterval);
    Troff.stopInterval = setInterval(function () {
      if (Troff.getMood() == "wait") {
        //audio.isPaused) {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
          $(".secondsLeft").html(0);
          clearInterval(Troff.stopInterval);
        } else {
          $(".secondsLeft").html(secondsLeft);
        }
      } else {
        clearInterval(Troff.stopInterval);
        $(".secondsLeft").html(0);
      }
    }, 1000);
  }; // end playSong

  /*Troff*/ this.pauseSong = function (updateLoopTimes) {
    updateLoopTimes = updateLoopTimes !== undefined ? updateLoopTimes : true;
    var audio = document.querySelector("audio, video");
    if (audio) audio.pause();
    Troff.setMood("pause");
    if (updateLoopTimes) {
      Troff.updateLoopTimes();
    }

    if (Troff.stopTimeout) clearInterval(Troff.stopTimeout);
    if (Troff.stopInterval) clearInterval(Troff.stopInterval);
  };

  this.updateSecondsLeft = function () {
    if (Troff.getMood() != "pause") {
      return;
    }
    if ($("#buttPauseBefStart").hasClass("active"))
      $(".secondsLeft").html($("#pauseBeforeStart").val());
    else $(".secondsLeft").html(0);
  };

  this.setMood = function (mood) {
    let infoSectionClasses =
      "overFilm bg-transparent position-absolute align-items-center w-100 flexCol";
    $("#infoSection, .moodColorizedText")
      .removeClass("play pause wait")
      .addClass(mood);
    if ($("#playInFullscreenButt").hasClass("active")) {
      $("#videoBox").toggleClass("fullscreen", mood != "pause");
    }
    $("#infoSection").toggleClass(
      infoSectionClasses,
      mood == "wait" && $("#videoBox").hasClass("fullscreen")
    );
    $("#buttPlayUiButtonPlay").toggleClass("hidden", mood != "pause");
    $("#buttPlayUiButtonPause").toggleClass("hidden", mood == "pause");
    Troff.updateSecondsLeft();
  };
  // Troff. ...
  /*Troff*/ this.setCurrentSongStrings = function (
    currentSong,
    currentGalleryId
  ) {
    strCurrentSong = currentSong;
    iCurrentGalleryId = currentGalleryId;
  };
  /*Troff*/ this.getCurrentSong = function () {
    return strCurrentSong;
  };
  this.getCurrentGalleryId = function () {
    return iCurrentGalleryId;
  };

  this.setWaitForLoad = function (path, iGalleryId) {
    if (strCurrentSong) {
      Troff.pauseSong();
      Troff.clearAllMarkers();
      Troff.clearAllStates();
    }
    Troff.setAreas([false, false, false, false]);
    strCurrentSong = path;
    iCurrentGalleryId = iGalleryId;

    $("#currentSong").text("Wait for song to load");
    $("#currentArtist, #currentAlbum").text("");
  };

  this.setCurrentSongInDB = function () {
    DB.setCurrentSong(strCurrentSong, iCurrentGalleryId);
  }; // end SetCurrentSong

  this.pathToName = function (filepath) {
    let lastIndex = filepath.lastIndexOf(".");
    if (lastIndex == -1) {
      return filepath;
    }
    return filepath.substr(0, lastIndex);
  };

  this.getCurrentStates = function () {
    return $("#stateList").children();
  };

  /*Troff*/ this.getCurrentMarkers = function (bGetStopMarkers) {
    if (bGetStopMarkers) {
      return $("#markerList li input:nth-child(4)");
    }
    return $("#markerList li input:nth-child(3)");
  };

  /*
    exportStuff, gets current song markers to the clippboard
*/
  /*Troff*/ this.exportStuff = function () {
    Troff.toggleImportExport();
    DB.getMarkers(strCurrentSong, function (aoMarkers) {
      var oExport = {};
      oExport.aoMarkers = [];
      for (var i = 0; i < aoMarkers.length; i++) {
        var oTmp = {};
        oTmp.name = aoMarkers[i].name;
        oTmp.time = aoMarkers[i].time;
        oTmp.info = aoMarkers[i].info;
        oTmp.color = aoMarkers[i].color;
        oExport.aoMarkers[i] = oTmp;
      }
      var aState = $("#stateList").children();
      oExport.aoStates = [];
      for (i = 0; i < aState.length; i++) {
        var oState = JSON.parse(aState.eq(i).attr("strstate"));
        oExport.aoStates[i] = Troff.replaceMarkerIdWithMarkerTimeInState(
          oState,
          aoMarkers
        );
      }
      oExport.strSongInfo = $("#songInfoArea").val();
      var sExport = JSON.stringify(oExport);

      IO.prompt("Copy the marked text to export your markers", sExport);
    });
  }; // end exportStuff

  /*
    importStuff, prompts for a string with markers
*/
  /*Troff*/ this.importStuff = function () {
    Troff.toggleImportExport();
    IO.prompt(
      "Please paste the text you received to import the markers",
      "Paste text here",
      function (sImport) {
        var oImport = JSON.parse(sImport);
        if (
          oImport.strSongInfo !== undefined &&
          oImport.aoStates !== undefined &&
          oImport.aoMarkers !== undefined
        ) {
          if ($("#markerList").children().length > 2) {
            IO.confirm(
              "Delete existing markers?",
              "Do you want to delete the existing markers before the import,<br />" +
                "or do you want to merge the new markers with the existing ones?",
              () => {
                Troff.deleteAllMarkers();
                Troff.doImportStuff(oImport);
              },
              () => {
                Troff.doImportStuff(oImport);
              },
              "Delete existing markers",
              "Merge markers"
            );
          } else {
            Troff.doImportStuff(oImport);
          }
        } else {
          //This else is here to allow for imports of 0.5 and earlier
          var aMarkersTmp = oImport;
          Troff.importMarker(aMarkersTmp);
        }
      }
    );
  };

  /*Troff*/ this.replaceMarkerIdWithMarkerTimeInState = function (
    oState,
    aoMarkers
  ) {
    for (let i = 0; i < aoMarkers.length; i++) {
      if (oState.currentMarker == aoMarkers[i].id) {
        oState.currentMarkerTime = aoMarkers[i].time;
      }
      if (oState.currentStopMarker == aoMarkers[i].id + "S") {
        oState.currentStopMarkerTime = aoMarkers[i].time;
      }
      if (
        oState.currentMarkerTime !== undefined &&
        oState.currentStopMarkerTime !== undefined
      ) {
        break;
      }
    }
    delete oState.currentMarker;
    delete oState.currentStopMarker;
    return oState;
  };

  /*Troff*/ this.importMarker = function (aMarkers) {
    var aMarkerId = Troff.getNewMarkerIds(aMarkers.length);

    for (var i = 0; i < aMarkers.length; i++) {
      // these 5 lines are here to allow for import of markers
      //from version 0.3.0 and earlier:
      var tmpName = Object.keys(aMarkers[i])[0];
      aMarkers[i].name = aMarkers[i].name || tmpName;
      aMarkers[i].time = aMarkers[i].time || Number(aMarkers[i][tmpName]) || 0;
      aMarkers[i].info = aMarkers[i].info || "";
      aMarkers[i].color = aMarkers[i].color || "None";
      //:allow for version 0.3.0 end here

      aMarkers[i].id = aMarkerId[i];
    }
    Troff.addMarkers(aMarkers); // adds marker to html
  };

  /*Troff*/ this.doImportStuff = function (oImport) {
    Troff.importMarker(oImport.aoMarkers);
    importSonginfo(oImport.strSongInfo);
    importStates(oImport.aoStates);

    DB.saveMarkers(Troff.getCurrentSong(), function () {
      DB.saveStates(Troff.getCurrentSong(), function () {
        Troff.updateSongInfo();
      });
    });

    function importSonginfo(strSongInfo) {
      $("#songInfoArea").val($("#songInfoArea").val() + strSongInfo);
    }

    function importStates(aoStates) {
      for (var i = 0; i < aoStates.length; i++) {
        var strTimeStart = aoStates[i].currentMarkerTime;
        var strTimeStop = aoStates[i].currentStopMarkerTime;
        delete aoStates[i].currentMarkerTime;
        delete aoStates[i].currentStopMarkerTime;
        aoStates[i].currentMarker = getMarkerFromTime(strTimeStart);
        aoStates[i].currentStopMarker = getMarkerFromTime(strTimeStop) + "S";
      }

      function getMarkerFromTime(strTime) {
        var aCurrMarkers = $("#markerList").children();
        for (var i = 0; i < aCurrMarkers.length; i++) {
          var currMarker = aCurrMarkers.eq(i).children().eq(2);
          if (currMarker[0].timeValue == strTime) {
            return currMarker.attr("id");
          }
        }

        log.e(
          "Could not find a marker at the time " +
            strTime +
            "; returning the first marker"
        );
        return aCurrMarkers.eq(0).children().eq(2).attr("id");
      }

      aoStates.map(function (s) {
        Troff.addButtonsOfStates([JSON.stringify(s)]);
      });
      //        DB.saveStates(Troff.getCurrentSong()); -- xxx
    }
  };

  /*
    createMarker, all, figure out the time and name,
    will then call the add- and save- Marker
 */
  /*Troff*/ this.createMarker = function () {
    var time = document.querySelector("audio, video").currentTime;
    var songSRC = $("audio, video").attr("src");
    var iMarkers = $("#markerList li").length + 1;

    var quickTimeout = setTimeout(function () {
      var oFI = {};
      oFI.strHead = "Please enter the marker name here";
      var iMarkers = $("#markerList li").length + 1;
      oFI.strInput = "marker nr " + iMarkers;
      oFI.bDouble = true;
      oFI.strTextarea = "";
      oFI.strTextareaPlaceholder = "Add extra info about the marker here.";

      IO.promptEditMarker(
        0,
        function (newMarkerName, newMarkerInfo, newMarkerColor, newTime) {
          if (newMarkerName === "") return;

          var oMarker = {};
          oMarker.name = newMarkerName;
          oMarker.time = newTime;
          oMarker.info = newMarkerInfo || "";
          oMarker.color = newMarkerColor;
          oMarker.id = Troff.getNewMarkerId();

          var markers = [oMarker];
          Troff.addMarkers(markers); // adds marker to html
          DB.saveMarkers(Troff.getCurrentSong());
          gtag("event", "Add Marker", { event_category: "Adding Button" });
        }
      );
      clearInterval(quickTimeout);
    }, 0);
  }; // end createMarker   ********/

  /*Troff*/ this.toggleImportExport = function () {
    $("#outerImportExportPopUpSquare").toggleClass("hidden");
    IO.blurHack();
  };

  /*Troff*/ this.toggleArea = function (event) {
    IO.blurHack();

    var sectionToHide = $(event.target).attr("section-to-hide");

    if (sectionToHide) {
      event.target.classList.toggle("active");
      $(sectionToHide).toggleClass("hidden");
      DB.setCurrentAreas(Troff.getCurrentSong());
    }
  };

  this.setAreas = function (abAreas) {
    $("#statesTab").toggleClass("active", abAreas[0]);
    $("#stateSection").toggleClass("hidden", !abAreas[0]);
    $("#settingsTab").toggleClass("active", abAreas[1]);
    $("#timeSection").toggleClass("hidden", !abAreas[1]);
    $("#infoTab").toggleClass("active", abAreas[2]);
    $("#userNoteSection").toggleClass("hidden", !abAreas[2]);
    $("#countTab").toggleClass("active", abAreas[3]);
    $("#infoSection").toggleClass("hidden", !abAreas[3]);
    $("#infoSectionSmall").toggleClass("hidden", abAreas[3]);
  };

  this.setInfo = function (info) {
    $("#songInfoArea").val(info);
  };

  this.setSonglists_NEW = function (aoSonglists) {
    for (var i = 0; i < aoSonglists.length; i++) {
      Troff.addSonglistToHTML_NEW(aoSonglists[i]);
    }
  };

  this.setSonglistIcon = function (event) {
    const button =
      event.target.tagName == "I" ? event.target.parentElement : event.target;

    const element = button.firstElementChild;

    const icon = [...element.classList].find((o) => o.startsWith("fa-"));

    $("#songlistIconPicker").find("button").removeClass("selected");

    button.classList.add("selected");

    $("#groupDialogSonglistIcon").removeClassStartingWith("fa-").addClass(icon);

    $("#groupDialogIcon").val(icon);
  };

  this.setSonglistColor = function (event) {
    const element = event.target;
    const color = [...element.classList].find((o) => o.startsWith("bg-"));

    const dialog = $("#groupDialog").find(".innerDialog")[0];

    $(dialog).find(".colorPickerSelected").removeClass("colorPickerSelected");

    $(dialog).removeClassStartingWith("bg-");

    element.classList.add("colorPickerSelected");
    dialog.classList.add(color);

    $(dialog).find("#groupDialogColor").val(color);
  };

  /*Troff*/ this.leaveGroup = async function () {
    $("#groupDialog").addClass("hidden");
    const groupDocId = $("#groupDialogName").data("groupDocId");
    const groupData = getFirebaseGroupDataFromDialog(false);

    groupData.owners = groupData.owners.filter((o) => o != firebaseUser.email);

    if (groupData.owners.length == 0) {
      Troff.removeGroup();
      return;
    }

    emptyGroupDialog();
    await firebase
      .firestore()
      .collection("Groups")
      .doc(groupDocId)
      .set(groupData);
  };

  /*Troff*/ this.onClickShareSonglist = function (event) {
    if (!firebaseUser) {
      $("#shareInstructionDialog").removeClass("hidden");
      return;
    }

    $("#shareSonglist").addClass("hidden");
    $(".showOnSharedSonglist").removeClass("hidden");
    $("#groupDialogIsGroup").prop("checked", true);
    $("#defaultIcon").click();
    $("#songlistColorPicker .backgroundColorNone").click();
    addGroupOwnerRow(firebaseUser.email);
  };

  /*Troff*/ this.onClickLeaveGroup = function (event) {
    IO.confirm(
      "Stop sharing this songlist",
      "Are you sure you want to stop sharing this songlist? Updates that you do will no longer be shared to the other members of this songlist.",
      async () => {
        Troff.leaveGroup();
      },
      () => {},
      "Yes, stop share",
      "No, I want to continue sharing!"
    );
  };

  /*Troff*/ this.removeGroup = async function () {
    $("#groupDialog").addClass("hidden");
    const groupDocId = $("#groupDialogName").data("groupDocId");

    const storageRef = firebase.storage().ref(`Groups/${groupDocId}`);

    await storageRef.listAll().then(async (listResults) => {
      const promises = listResults.items.map((item) => {
        return item.delete();
      });
      return await Promise.all(promises);
    });

    const songDocIds = [];
    $("#groupSongParent")
      .find(".groupDialogSong")
      .each((i, s) => {
        songDocIds.push($(s).data("firebaseSongDocId"));
      });

    emptyGroupDialog();

    const removeDataPromise = [];
    songDocIds.forEach((songDocId) => {
      removeDataPromise.push(
        removeSongDataFromFirebaseGroup(groupDocId, songDocId)
      );
    });
    await Promise.all(removeDataPromise);

    firebase.firestore().collection("Groups").doc(groupDocId).delete();
  };

  /*Troff*/ this.IO_removeSonglist = async function () {
    const isGroup = $("#groupDialogIsGroup").is(":checked");
    const songListObjectId = $("#groupDialogName").data("songListObjectId");

    if (isGroup) {
      await Troff.leaveGroup();
    }

    Troff.removeSonglist_NEW(songListObjectId);
    emptyGroupDialog();
    $("#groupDialog").addClass("hidden");
  };

  /*Troff*/ this.onClickremoveSonglist = async function (event) {
    const isGroup = $("#groupDialogIsGroup").is(":checked");
    if (!isGroup) {
      Troff.IO_removeSonglist();
      return;
    }
    IO.confirm(
      "Remove Songlist?",
      "This will remove this songlist and updates to songs will no longer be shared to the rest of the owners for this songlist",
      Troff.IO_removeSonglist,
      () => {},
      "Yes, remove songlist",
      "No, I like this songlist!"
    );
  };

  /*Troff*/ this.removeSonglist_NEW = function (songListId) {
    const songListObject = JSON.parse(nDB.get("straoSongLists")).filter(
      (sl) => sl.id == songListId
    )[0];

    $("#songListList")
      .find(`[data-songlist-id="${songListId}"]`)
      .closest("li")
      .remove();
    $("#songListSelector").find(`[value="${songListId}"]`).remove();

    DB.saveSonglists_new();
    if (songListObject == undefined) {
      log.w(
        `Trying to remove songList with id ${songListId}, but it is not in the Local dataBase`
      );
      return;
    }
    notifyUndo(
      'The songlist "' + songListObject.name + '" was removed',
      function () {
        Troff.addSonglistToHTML_NEW(songListObject);
        DB.saveSonglists_new();
      }
    );
  };

  /**
   * Denna funktion används när en låtlista uppdateras automatiskt
   * tex, när firebase uppdaterar låtlista,
   * eller när groupDialog sparas.
   * Den används INTE vid drag and dropp, eller selecten!
   * @param {Object of Songlist} songListObject
   * @param {jQuery button} $target
   */
  /*Troff*/ this.updateSongListInHTML = function (songListObject) {
    var $target = $("#songListList").find(
      '[data-songlist-id="' + songListObject.id + '"]'
    );
    if (songListObject.id == undefined) {
      const groupId = songListObject.firebaseGroupDocId;
      $target = $("#songListList").find(
        `[data-firebase-group-doc-id="${groupId}"]`
      );
      songListObject.id = $target.data("songlistId");
    }

    $target.text(songListObject.name);
    $target.data("songList", songListObject);

    if (songListObject.firebaseGroupDocId != undefined) {
      $target.attr(
        "data-firebase-group-doc-id",
        songListObject.firebaseGroupDocId
      );
      $target.addClass("groupIndication");
    } else {
      songListObject.color = "";
      songListObject.icon = "fa-pencil";
    }

    $target
      .parent()
      .find(".editSongList")
      .removeClassStartingWith("bg-")
      .addClass(songListObject.color);

    $target
      .parent()
      .find(".editSongList")
      .find("i")
      .removeClassStartingWith("fa-")
      .addClass(songListObject.icon || "fa-users");

    if ($target.hasClass("selected")) {
      $target.click();
    }
    if ($target.hasClass("active")) {
      $target.click();
      $target.click();
    }
  };

  /*Troff*/ this.addSonglistToHTML_NEW = function (oSongList) {
    if (oSongList.id == undefined) {
      oSongList.id = Troff.getUniqueSonglistId();
    }

    const groupDocId = oSongList.firebaseGroupDocId;
    const groupClass = groupDocId ? "groupIndication" : "";
    const groupLogo = oSongList.icon || "fa-pencil";

    $("#songListList").append(
      $("<li>")
        .addClass("py-1")
        .append(
          $("<div>")
            .addClass("flex-display")
            .addClass("pr-2")
            .append(
              $("<button>")
                .addClass("small")
                .addClass("regularButton")
                .addClass("editSongList")
                .addClass(oSongList.color)
                .addClass("mr-2")
                .append($("<i>").addClass("fa").addClass(groupLogo))
                .on("click", songListDialogOpenExisting)
            )
            .append(
              $("<button>")
                .addClass("songlist")
                .addClass(groupClass)
                .addClass("stOnOffButton")
                .addClass("flex-one")
                .addClass("text-left")
                .data("songList", oSongList)
                .attr("data-songlist-id", oSongList.id)
                //  workaround to be able to select by for example $(" [data-songlist-id]")
                .attr("data-firebase-group-doc-id", groupDocId)
                .text(oSongList.name)
                .click(clickSongList_NEW)
            )
        )
        .on("drop", dropSongOnSonglist)
        .on("dragover", allowDrop)
        .on("dragleave", onDragleave)
    );

    var oAdd = $("<option>")
      .text("Add to " + oSongList.name)
      .val(oSongList.id);
    $("#songListSelectorAddToSonglist").append(oAdd);
    var oRemove = $("<option>")
      .text("Remove from " + oSongList.name)
      .val(oSongList.id);
    $("#songListSelectorRemoveFromSonglist").append(oRemove);
  };

  this.recallCurrentStateOfSonglists = function () {
    DB.getVal(
      "TROFF_SETTING_SONG_LIST_ADDITIVE_SELECT",
      function (isAdditiveSelect) {
        DB.getVal(TROFF_CURRENT_STATE_OF_SONG_LISTS, function (o) {
          var indicatorClass = isAdditiveSelect ? "active" : "selected";

          $("#songListAll").removeClass("selected");

          o.directoryList.forEach(function (v, i) {
            $("#directoryList")
              .find("[data-gallery-id=" + v.galleryId + "]")
              .each(function (inner_index, inner_value) {
                if ($(inner_value).data("full-path") == v.fullPath) {
                  $(inner_value).addClass(indicatorClass);
                  $("#songListAll").removeClass("selected");
                }
              });
          });
          o.galleryList.forEach(function (v, i) {
            $("#galleryList")
              .find("[data-gallery-id=" + v + "]")
              .addClass(indicatorClass);
            $("#songListAll").removeClass("selected");
          });
          o.songListList.forEach(function (v, i) {
            $("#songListList")
              .find("[data-songlist-id=" + v + "]")
              .addClass(indicatorClass);
            $("#songListAll").removeClass("selected");

            if (!isAdditiveSelect) {
              const songListData = $("#songListList")
                .find("[data-songlist-id=" + v + "]")
                .data("songList");
              $("#headArea").addClass(songListData.color);
              $("#songlistIcon").addClass(songListData.icon);
              $("#songlistName").text(songListData.name);
              $("#songlistInfo").removeClass("hidden").text(songListData.info);
            }
          });

          filterSongTable(getFilterDataList());
        });
      }
    );
  };

  /*Troff*/ this.saveCurrentStateOfSonglists = function () {
    var o = {},
      songListList = [],
      galleryList = [],
      directoryList = [];
    $("#songListList")
      .find(".active, .selected")
      .each(function (i, v) {
        songListList.push($(v).attr("data-songlist-id"));
      });
    o.songListList = songListList;

    $("#galleryList")
      .find(".active, .selected")
      .each(function (i, v) {
        galleryList.push($(v).attr("data-gallery-id"));
      });
    o.galleryList = galleryList;

    $("#directoryList")
      .find(".active, .selected")
      .each(function (i, v) {
        directoryList.push({
          galleryId: $(v).attr("data-gallery-id"),
          fullPath: $(v).attr("data-full-path"),
        });
      });
    o.directoryList = directoryList;

    DB.saveVal(TROFF_CURRENT_STATE_OF_SONG_LISTS, o);
  };

  this.enterSongListName = function () {
    IO.setEnterFunction(function (event) {
      IO.blurHack();
      Troff.saveNewSongList();
      return false;
    });
  };
  this.exitSongListName = function () {
    IO.clearEnterFunction();
    IO.blurHack();
  };

  /*Troff*/ this.getUniqueSonglistId = function () {
    var iSonglistId = 1;
    var bFinniched = false;

    var aDOMSonglist = $("#songListList").find("button[data-songlist-id]");
    while (true) {
      bFinniched = true;
      for (var i = 0; i < aDOMSonglist.length; i++) {
        if (aDOMSonglist.eq(i).data("songList").id == iSonglistId) {
          iSonglistId++;
          bFinniched = false;
        }
      }
      if (bFinniched) return iSonglistId;
    }
  };

  this.enterSongInfo = function (a, b, c) {
    $("#songInfoArea").addClass("textareaEdit");
    IO.setEnterFunction(function (event) {
      if (event.ctrlKey == 1) {
        //Ctrl+Enter will exit
        IO.blurHack();
        return false;
      }
      return true;
    });
  };

  this.exitSongInfo = function () {
    $("#songInfoArea").removeClass("textareaEdit");
    IO.clearEnterFunction();
  };

  /*Troff*/ this.updateSongInfo = function () {
    var strInfo = $("#songInfoArea")[0].value;
    var songId = Troff.getCurrentSong();
    DB.setCurrentSongInfo(strInfo, songId);
  };

  /*Troff*/ this.rememberCurrentState = function () {
    if ($("#statesTab").hasClass("hidden")) return;

    IO.blurHack();
    var nrStates = $("#stateList").children().length + 1;
    IO.prompt(
      "Remember state of settings to be recalled later",
      "State " + nrStates,
      function (stateName) {
        if (stateName === "") return;

        var state = {};
        state.name = stateName;
        state.currentLoop = $(".currentLoop").attr("id");
        state.currentMarker = $(".currentMarker").attr("id");
        state.currentStopMarker = $(".currentStopMarker").attr("id");

        $("[data-save-on-song-toggle-class]").each(function (i, element) {
          const $target = $(element),
            id = $target.attr("id"),
            classToToggleAndSave = $target.data("save-on-song-toggle-class");
          if (id == undefined) {
            log.e(
              "''id'' is required for elements with [data-save-on-song-toggle-class]"
            );
            return;
          }

          state[id] = $target.hasClass(classToToggleAndSave);
        });
        $("[data-save-on-song-value]").each(function (i, element) {
          const $target = $(element),
            id = $target.attr("id"),
            value = $target.val();

          if (id == undefined) {
            log.e(
              "''id'' is required for elements with [data-save-on-song-value]"
            );
            return;
          }

          state[id] = value;
        });

        Troff.addButtonsOfStates([JSON.stringify(state)]);
        DB.saveStates(Troff.getCurrentSong());
        gtag("event", "Remember State", { event_category: "Adding Button" });
      }
    );
  };

  this.addButtonsOfStates = function (astrState) {
    for (var i = 0; i < astrState.length; i++) {
      var oState = JSON.parse(astrState[i]);

      $('<div class="flexRow">')
        .append(
          $("<button>")
            .attr("type", "button")
            .addClass("small regularButton")
            .append($("<i>").addClass("fa-trash"))
            .click(Troff.removeState)
        )
        .append(
          $("<input>")
            .attr("type", "button")
            .addClass("regularButton flex-one text-left")
            .val(oState.name)
            .click(Troff.setState)
        )
        .attr("strState", astrState[i])
        .appendTo("#stateList");
    }
    if (astrState.length !== 0) $("#statesHelpText").hide();
  };

  /*Troff*/ this.setState = function (stateWrapper) {
    var strState = $(stateWrapper.target).parent().attr("strState");
    var oState = JSON.parse(strState);
    $("#" + oState.currentLoop).click();
    $("[data-save-on-song-toggle-class]").each(function (i, element) {
      const $target = $(element),
        id = $target.attr("id"),
        classToToggleAndSave = $target.data("save-on-song-toggle-class");
      if (id == undefined) {
        log.e(
          "''id'' is required for elements with [data-save-on-song-toggle-class]"
        );
        return;
      }
      if (oState[id] == undefined) {
        return;
      }

      if ($target.hasClass(classToToggleAndSave) != oState[id]) {
        $target.trigger("click");
      }
    });
    $("[data-save-on-song-value]").each(function (i, element) {
      const $target = $(element),
        id = $target.attr("id");

      if (id == undefined) {
        log.e("''id'' is required for elements with [data-save-on-song-value]");
        return;
      }
      if (oState[id] == undefined) {
        return;
      }

      $target.val(oState[id]);
      $target[0].dispatchEvent(new Event("input"));
    });

    $("#" + oState.currentMarker).click();
    $("#" + oState.currentStopMarker).click();
  };

  /*Troff*/ this.onSearchKeyup = function (event) {
    if (event != undefined && [37, 38, 39, 40].indexOf(event.keyCode) != -1) {
      return;
    }
    var tBody = $("#dataSongTable").find("tbody"),
      importantEl = tBody.find("tr").filter(".important");

    if (importantEl.length === 0) {
      tBody.find("tr").eq(0).addClass("important");
    } else {
      importantEl.slice(1).removeClass("important");
    }
  };

  /*Troff*/ this.enterSerachDataTableSongList = function (event) {
    $input = $(event.target);
    $input.addClass("textareaEdit");

    if (!$input.is(":focus")) {
      $input.focus();
    }

    Troff.onSearchKeyup(null);

    IO.setEnterFunction(
      function (event) {
        if (event.ctrlKey == 1) {
          //Ctrl+Enter will exit
          $input.val("").trigger("click");
          IO.blurHack();
          return false;
        }

        $("#dataSongTable")
          .DataTable()
          .rows(".important")
          .nodes()
          .to$()
          .trigger("click");
        $("#dataSongTable")
          .DataTable()
          .rows(".important")
          .nodes()
          .to$()
          .removeClass("important");

        IO.blurHack();
        return true;
      },
      function (event) {
        var element = $("#dataSongTable")
            .find("tbody")
            .find("tr")
            .filter(".important"),
          next;

        if (event.keyCode == 37 || event.keyCode == 39) return;
        event.preventDefault();

        if (event.keyCode == 40) {
          next = element.next();
        } else {
          next = element.prev();
        }

        if (next.length) {
          element.removeClass("important");
          next.addClass("important");
        }
      }
    );
  };

  /*Troff*/ this.exitSerachDataTableSongList = function (event) {
    $("#dataSongTable")
      .DataTable()
      .rows(".important")
      .nodes()
      .to$()
      .removeClass("important");

    IO.clearEnterFunction();
    IO.blurHack();
  };

  /*Troff*/ this.showSearchAndActivate = function (event) {
    if (!$("#buttSongsDialog").hasClass("active")) {
      $("#buttSongsDialog").trigger("click").select();
    }

    if (
      !$('[data-st-css-selector-to-hide="#dataSongTable_filter"]').hasClass(
        "active"
      )
    ) {
      $('[data-st-css-selector-to-hide="#dataSongTable_filter"]')
        .trigger("click")
        .select();
    }

    $("#dataSongTable_filter").find("input").trigger("click").select();
  };

  /*Troff*/ this.enterMarkerInfo = function (a, b, c) {
    $("#markerInfoArea").addClass("textareaEdit");
    IO.setEnterFunction(function (event) {
      if (event.ctrlKey == 1) {
        //Ctrl+Enter will exit
        IO.blurHack();
        return false;
      }
      return true;
    });
  };
  this.exitMarkerInfo = function () {
    $("#markerInfoArea").removeClass("textareaEdit");
    IO.clearEnterFunction();
  };

  /*Troff*/ this.updateMarkerInfo = function () {
    var strInfo = $("#markerInfoArea")[0].value;
    var color = $(".currentMarker")[0].color;
    var markerId = $(".currentMarker").attr("id");
    var time = $(".currentMarker")[0].timeValue;
    var markerName = $(".currentMarker").val();
    var songId = Troff.getCurrentSong();

    $(".currentMarker")[0].info = strInfo;

    DB.updateMarker(markerId, markerName, strInfo, color, time, songId);
  };

  this.addMarkers = function (aMarkers) {
    var startM = function () {
      Troff.selectMarker(this.id);
      IO.blurHack();
    };
    var stopM = function () {
      Troff.selectStopMarker(this.id);
      IO.blurHack();
    };
    var editM = function () {
      Troff.editMarker(this.id.slice(0, -1));
      IO.blurHack();
    };

    for (var i = 0; i < aMarkers.length; i++) {
      var oMarker = aMarkers[i];
      var name = oMarker.name;
      var time = Number(oMarker.time);
      var info = oMarker.info;
      var color = oMarker.color || "None";
      var nameId = oMarker.id;

      var maxTime = Number(document.getElementById("timeBar").max);

      if (oMarker.time == "max" || time > maxTime) {
        time = maxTime;
        var song = Troff.getCurrentSong();
      }

      var button = document.createElement("input");
      button.type = "button";
      button.id = nameId;
      button.value = name;
      button.classList.add("onOffButton");
      button.timeValue = time;
      button.info = info;
      button.color = color;

      var buttonS = document.createElement("input");
      buttonS.type = "button";
      buttonS.id = nameId + "S";
      buttonS.value = "Stop";
      buttonS.classList.add("onOffButton");
      buttonS.timeValue = time;

      var buttonE = $("<button>")
        .addClass("small")
        .addClass("regularButton")
        .attr("id", nameId + "E")
        .append($("<i>").addClass("fa-pencil"));

      var p = document.createElement("b");
      p.innerHTML = Troff.secToDisp(time);

      var docMarkerList = document.getElementById("markerList");
      var listElement = document.createElement("li");

      listElement.appendChild(buttonE[0]);
      listElement.appendChild(p);
      listElement.appendChild(button);
      listElement.appendChild(buttonS);
      $(listElement).addClass(MARKER_COLOR_PREFIX + color);

      var child = $("#markerList li:first-child")[0];
      var bInserted = false;
      var bContinue = false;
      while (child) {
        var childTime = parseFloat(child.childNodes[2].timeValue);
        if (childTime !== undefined && Math.abs(time - childTime) < 0.001) {
          var markerId = child.childNodes[2].id;

          if (child.childNodes[2].info != info) {
            updated = true;
            var newMarkerInfo = child.childNodes[2].info + "\n\n" + info;
            $("#" + markerId)[0].info = newMarkerInfo;
            if ($(".currentMarker")[0].id == child.childNodes[2].id)
              $("#markerInfoArea").val(newMarkerInfo);
          }
          if (child.childNodes[2].value != name) {
            var newMarkerName = child.childNodes[2].value + ", " + name;
            updated = true;
            $("#" + markerId).val(newMarkerName);
          }

          bContinue = true;
          break;
        } else if (time < childTime) {
          $("#markerList")[0].insertBefore(listElement, child);
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

      document.getElementById(nameId).addEventListener("click", startM);
      document.getElementById(nameId + "S").addEventListener("click", stopM);
      document.getElementById(nameId + "E").addEventListener("click", editM);
    } //end for-loop
    Troff.setAppropriateMarkerDistance();
    Troff.fixMarkerExtraExtendedColor();
  }; // end addMarker ****************/

  /*
   * returns the id of the earliest and latest markers.
   * (note: latest marker without the 'S' for stop-id)
   */
  this.getFirstAndLastMarkers = function () {
    var aOMarkers = $("#markerList > li > :nth-child(3)");
    if (aOMarkers.length == 0) {
      return null;
    }
    var max = parseFloat(aOMarkers[0].timeValue);
    var min = parseFloat(aOMarkers[0].timeValue);
    var iMaxIndex = 0;
    var iMinIndex = 0;
    var aMarkers = [];
    for (var i = 0; i < aOMarkers.length; i++) {
      var tv = aOMarkers[i].timeValue;
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

  this.unselectMarkers = function () {
    var aFirstAndLast = Troff.getFirstAndLastMarkers();
    var startMarkerId = aFirstAndLast[0];
    var stopMarkerId = aFirstAndLast[1] + "S";

    $(".currentMarker").removeClass("currentMarker");
    $("#" + startMarkerId).addClass("currentMarker");
    $("#markerInfoArea").val($("#" + startMarkerId)[0].info);
    $(".currentStopMarker").removeClass("currentStopMarker");
    $("#" + stopMarkerId).addClass("currentStopMarker");

    Troff.setAppropriateActivePlayRegion();
    IO.blurHack();

    DB.setCurrentStartAndStopMarker(
      startMarkerId,
      stopMarkerId,
      strCurrentSong
    );
  };

  this.unselectStartMarker = function () {
    var aFirstAndLast = Troff.getFirstAndLastMarkers();
    var startMarkerId = aFirstAndLast[0];
    var stopMarkerId = aFirstAndLast[1] + "S";

    $(".currentMarker").removeClass("currentMarker");
    $("#" + startMarkerId).addClass("currentMarker");
    $("#markerInfoArea").val($("#" + startMarkerId)[0].info);

    Troff.setAppropriateActivePlayRegion();
    IO.blurHack();
    DB.setCurrentStartMarker(startMarkerId, strCurrentSong);
  };

  this.unselectStopMarker = function () {
    var aFirstAndLast = Troff.getFirstAndLastMarkers();
    var startMarkerId = aFirstAndLast[0];
    var stopMarkerId = aFirstAndLast[1] + "S";

    $(".currentStopMarker").removeClass("currentStopMarker");
    $("#" + stopMarkerId).addClass("currentStopMarker");

    Troff.setAppropriateActivePlayRegion();
    IO.blurHack();
    DB.setCurrentStopMarker(stopMarkerId, strCurrentSong);
  };

  /*
        selectMarker - All, sets new Marker, sets playtime to markers playtime
    */
  this.selectMarker = function (markerId) {
    var startTime = Number($("#" + markerId)[0].timeValue);
    var stopTime = Troff.getStopTime();

    // if stopMarker befor Marker - unselect stopMarker:
    if (stopTime <= startTime + 0.5) {
      $(".currentStopMarker").removeClass("currentStopMarker");
      var aFirstAndLast = Troff.getFirstAndLastMarkers();
      var firstMarkerId = aFirstAndLast[0];
      var lastMarkerId = aFirstAndLast[1] + "S";

      $("#" + lastMarkerId).addClass("currentStopMarker");
    }
    var stopMarker = $(".currentStopMarker").attr("id");
    stopMarker = stopMarker ? stopMarker : 0;

    //marks selected Marker:
    $(".currentMarker").removeClass("currentMarker");
    $("#" + markerId).addClass("currentMarker");
    $("#markerInfoArea").val($("#" + markerId)[0].info);

    if (
      $("#" + TROFF_SETTING_ON_SELECT_MARKER_GO_TO_MARKER).hasClass("active")
    ) {
      Troff.goToStartMarker();
    }

    Troff.setAppropriateActivePlayRegion();

    DB.setCurrentStartAndStopMarker(markerId, stopMarker, strCurrentSong);
  }; // end selectMarker

  /*
        selectStopMarker - All, selects a marker to stop playing at
    */
  this.selectStopMarker = function (markerId) {
    var stopTime = Number($("#" + markerId)[0].timeValue);
    var startTime = Troff.getStartTime();

    // if startMarker after stopMarker -> unselect startMarker:
    if (startTime + 0.5 >= stopTime) {
      var aFirstAndLast = Troff.getFirstAndLastMarkers();
      var firstMarkerId = aFirstAndLast[0];
      var lastMarkerId = aFirstAndLast[1] + "S";

      $(".currentMarker").removeClass("currentMarker");
      $("#" + firstMarkerId).addClass("currentMarker");
      $("#markerInfoArea").val($("#" + firstMarkerId)[0].info);
    }

    var startMarker = $(".currentMarker").attr("id");
    startMarker = startMarker ? startMarker : 0;

    //marks selected StopMarker:
    $(".currentStopMarker").removeClass("currentStopMarker");
    $("#" + markerId).addClass("currentStopMarker");

    Troff.setAppropriateActivePlayRegion();
    DB.setCurrentStartAndStopMarker(startMarker, markerId, strCurrentSong);
  }; // end selectStopMarker

  this.removeState = function () {
    var that = this;
    IO.confirm("Remove state", "This action can not be undone", function () {
      $(that).parent().remove();
      DB.saveStates(Troff.getCurrentSong());
      if ($("#stateList >").length === 0) $("#statesHelpText").show();
    });
  };

  /*
        removeMarker, all, Tar bort en markÃ¶r frÃ¥n html och DB
    */
  this.removeMarker = function (markerIdWithoutHash) {
    markerId = "#" + markerIdWithoutHash;
    var oMarker = {};
    oMarker.id = markerIdWithoutHash;
    oMarker.name = $(markerId).val();
    oMarker.time = Number($(markerId)[0].timeValue);
    oMarker.info = $(markerId)[0].info;
    oMarker.color = $(markerId)[0].color;

    notifyUndo("Marker " + oMarker.name + " was removed", function () {
      aMarkers = [oMarker];
      Troff.addMarkers(aMarkers);
      DB.saveMarkers(Troff.getCurrentSong()); // saves end marker to DB
    });

    // Remove Marker from HTML
    $(markerId).closest("li").remove();
    Troff.setAppropriateMarkerDistance();

    // remove from DB
    DB.saveMarkers(Troff.getCurrentSong());
  }; // end removeMarker ******/

  this.toggleMoveMarkersMoreInfo = function () {
    $("#moveMarkersMoreInfoDialog").toggleClass("hidden");
    IO.blurHack();
  };

  /*
        show the move markers pop up dialog.
    */
  this.showMoveMarkers = function () {
    IO.setEnterFunction(function () {
      Troff.moveMarkers();
    });
    $("#moveMarkersDialog").removeClass("hidden");
    $("#moveMarkersNumber").select();
  };

  /*
        hide the delete markers pop up dialog.
    */
  /*Troff*/ this.hideDeleteMarkersDialog = function () {
    $("#deleteMarkersDialog").addClass("hidden");
    IO.clearEnterFunction();
  };

  /*
        hide the move markers pop up dialog.
    */
  this.hideMoveMarkers = function () {
    $("#moveMarkersDialog").addClass("hidden");
    $("#moveMarkersMoreInfoDialog").addClass("hidden");
    //$('#moveMarkersMoreInfoDialog').hide();
    $("#moveMarkersNumber").val(0);
    IO.clearEnterFunction();
  };

  /*Troff*/ this.deleteAllMarkers = function () {
    Troff.deleteMarkers(false);
  };

  /*Troff*/ this.deleteSelectedMarkers = function () {
    Troff.deleteMarkers(true);
  };

  /*Troff*/ this.stretchSelectedMarkers = function () {
    var aAllMarkers = Troff.getCurrentMarkers(),
      startNumber,
      endNumber;

    [startNumber, endNumber] = Troff.getStartAndEndMarkerNr(0, 1);

    Troff.stretchMarkers(
      $("#stretchMarkersNumber").val(),
      aAllMarkers[startNumber].timeValue,
      startNumber,
      endNumber
    );
  };

  /*Troff*/ this.stretchAllMarkers = function () {
    var baseValue = 0,
      startNumber = 0,
      endNumber = Troff.getCurrentMarkers().length;

    Troff.stretchMarkers(
      $("#stretchMarkersNumber").val(),
      baseValue,
      startNumber,
      endNumber
    );
  };

  /*Troff*/ this.stretchMarkers = function (
    stretchProcent,
    baseValue,
    startNr,
    endNr
  ) {
    var i,
      maxTime = Number(document.getElementById("timeBar").max),
      aAllMarkers = Troff.getCurrentMarkers(),
      newTime,
      markerId,
      calculatetTime;

    if (stretchProcent == 100) {
      IO.alert(
        "100% will not change markers",
        "Stretching the markers to 100% of there original position will not change the marker position.<br /><br />" +
          '<span class="small">Please change the %-value or close the Stretch markers dialog</span>.'
      );
      return;
    }

    for (i = startNr; i < endNr; i++) {
      markerId = aAllMarkers[i].id;

      calculatetTime =
        ((aAllMarkers[i].timeValue - baseValue) * stretchProcent) / 100 +
        baseValue;
      newTime = Math.max(0, Math.min(maxTime, calculatetTime));

      Troff.checkIfMarkerIndexHasSameTimeAsOtherMarkers(
        i,
        markerId,
        aAllMarkers,
        newTime
      );

      $("#" + markerId)[0].timeValue = newTime;
      $("#" + markerId + "S")[0].timeValue = newTime;
      $("#" + markerId)
        .prev()
        .html(Troff.secToDisp(newTime));
    }

    Troff.setAppropriateMarkerDistance();
    DB.saveMarkers(Troff.getCurrentSong());
    $("#stretchMarkersDialog").addClass("hidden");
    $("#stretchMarkersNumber").val(100);
  };

  /*
        copyMarkers
    */
  /*Troff*/ this.openCopyMarkersDialog = function () {
    $("#copyMarkersNumber").val(
      document.querySelector("audio, video").currentTime
    );
    $("#copyMarkersNrOfMarkers").text(Troff.getNrOfSelectedMarkers());
    $("#copyMarkersNumber").select();
    IO.setEnterFunction(function (event) {
      IO.blurHack();
      Troff.copyMarkers();
      return false;
    });
  };

  /*Troff*/ this.copyMarkers = function () {
    let aAllMarkers = nDB.get(Troff.getCurrentSong()).markers,
      i,
      timeToAddToMarkers,
      timeForFirstMarker = Number($("#copyMarkersNumber").val()),
      startNumber,
      endNumber,
      newMarker,
      nrMarkersToCopy;

    const strMarkersBeforeCopy = JSON.stringify(aAllMarkers);

    [startNumber, endNumber] = Troff.getStartAndEndMarkerNr(0, 1);

    timeToAddToMarkers = timeForFirstMarker - aAllMarkers[startNumber].time;

    for (i = startNumber; i < endNumber; i++) {
      newMarker = aAllMarkers[i];
      newMarker.time += timeToAddToMarkers;
      newMarker.id = Troff.getNewMarkerId();
      Troff.addMarkers([newMarker]); // adds marker to html
    }
    DB.saveMarkers(Troff.getCurrentSong());
    gtag("event", "Copy Markers", { event_category: "Adding Button" });

    $("#copyMarkersDialog").addClass("hidden");
    IO.clearEnterFunction();

    notifyUndo("Copied " + (endNumber - startNumber) + " markers", function () {
      const oldMarkers = JSON.parse(strMarkersBeforeCopy);
      const startId = oldMarkers[startNumber].id;
      const endId = oldMarkers[endNumber - 1].id;
      $("#markerList").children().remove(); // removes all marker from html
      Troff.addMarkers(oldMarkers); // adds marker to html
      Troff.selectMarker(startId);
      Troff.selectStopMarker(endId + "S");
      DB.saveMarkers(Troff.getCurrentSong());
    });
  };

  /*
        move all or some markers.
    */
  this.moveAllMarkersUp = function () {
    $("#moveMarkersNumber").val(-$("#moveMarkersNumber").val());
    Troff.moveMarkers(false, false);
  };
  this.moveAllMarkersDown = function () {
    Troff.moveMarkers(false, false);
  };
  this.moveSomeMarkersUp = function () {
    $("#moveMarkersNumber").val(-$("#moveMarkersNumber").val());
    Troff.moveMarkers(true, false);
  };
  this.moveSomeMarkersDown = function () {
    Troff.moveMarkers(true, false);
  };

  this.moveOneMarkerDown = function (val) {
    $("#moveMarkersNumber").val(val);
    Troff.moveMarkers(true, true);
  };

  /*Troff*/ this.getNrOfSelectedMarkers = function () {
    let [startMarkerNr, endMarkerNr] = Troff.getStartAndEndMarkerNr(0, 1);
    return endMarkerNr - startMarkerNr;
  };

  /*Troff*/ this.getStartAndEndMarkerNr = function (addToStartNr, addToEndNr) {
    addToStartNr = addToStartNr || 0;
    addToEndNr = addToEndNr || 0;

    var aAllMarkers = Troff.getCurrentMarkers(),
      startNr = 0,
      endNr = aAllMarkers.length,
      selectedId = $(".currentMarker").attr("id"),
      selectedStopId = $(".currentStopMarker").attr("id"),
      nextAttrId,
      attrId;

    for (var k = 0; k < aAllMarkers.length; k++) {
      if (selectedId == aAllMarkers.eq(k).attr("id")) startNr = k;

      nextAttrId = aAllMarkers.eq(k).next().attr("id");
      attrId = aAllMarkers.eq(k).attr("id");
      if (selectedStopId == aAllMarkers.eq(k).next().attr("id")) endNr = k;
    }
    return [startNr + addToStartNr, endNr + addToEndNr];
  };

  /*Troff*/ this.deleteMarkers = function (bDeleteSelected) {
    var i,
      markerId,
      startNumber = 1,
      markers = $("#markerList").children(),
      endNumber = markers.length - 1;

    if (bDeleteSelected) {
      var [startNumber, endNumber] = Troff.getStartAndEndMarkerNr(0, 1);
    }

    if (markers.length - (endNumber - startNumber) < 2) {
      IO.alert("You must have at least 2 markers left");
      return;
    }

    for (i = startNumber; i < endNumber; i++) {
      markerId = markers.eq(i).find("input").attr("id");
      Troff.removeMarker(markerId);
    }
    Troff.hideDeleteMarkersDialog();
  };

  /*
        move all markers.
    */
  this.moveMarkers = function (bMoveSelected, bOneMarker) {
    $("#moveMarkersDialog").addClass("hidden");
    IO.clearEnterFunction();

    var value = $("#moveMarkersNumber").val();
    $("#moveMarkersNumber").val(0);

    var aAllMarkers = Troff.getCurrentMarkers();

    var startNumber = 0;
    var endNumber = aAllMarkers.length;

    if (bOneMarker) {
      aAllMarkers = $(".currentMarker");
      endNumber = 1;
    } else if (bMoveSelected) {
      [startNumber, endNumber] = Troff.getStartAndEndMarkerNr(0, 1);
    }

    for (var i = startNumber; i < endNumber; i++) {
      var markerId = aAllMarkers[i].id;

      var markerTime = Number(aAllMarkers[i].timeValue) + Number(value);
      var maxTime = Number(document.getElementById("timeBar").max);
      var newTime = Math.max(0, Math.min(maxTime, markerTime));

      Troff.checkIfMarkerIndexHasSameTimeAsOtherMarkers(
        i,
        markerId,
        aAllMarkers,
        newTime
      );

      $("#" + markerId)[0].timeValue = newTime;
      $("#" + markerId + "S")[0].timeValue = newTime;
      $("#" + markerId)
        .prev()
        .html(Troff.secToDisp(newTime));
    }

    Troff.setAppropriateMarkerDistance();
    DB.saveMarkers(Troff.getCurrentSong());
  };

  /*Troff*/ this.checkIfMarkerIndexHasSameTimeAsOtherMarkers = function (
    markerIndex,
    markerId,
    aAllMarkers,
    newTime
  ) {
    for (var j = 0; j < markerIndex; j++) {
      if (Number(aAllMarkers[j].timeValue) == newTime) {
        var newMarkerName = $("#" + markerId).val();
        if (newMarkerName != aAllMarkers.eq(j).val())
          newMarkerName += ", " + aAllMarkers.eq(j).val();
        $("#" + markerId).val(newMarkerName);

        var newMarkerInfo = $("#" + markerId)[0].info;
        if (newMarkerInfo != aAllMarkers[j].info)
          newMarkerInfo += "\n\n" + aAllMarkers[j].info;
        $("#" + markerId)[0].info = newMarkerInfo;
        if ($("#" + markerId).hasClass("currentMarker"))
          $("#markerInfoArea").val(newMarkerInfo);

        aAllMarkers.eq(j).parent().remove();
      }
    }
  };

  /*
        editMarker, all, Editerar en markÃ¶r i bÃ¥de html och DB
    */
  this.editMarker = function (markerId) {
    var oldName = $("#" + markerId).val();
    var oldTime = Number($("#" + markerId)[0].timeValue);
    var oldMarkerInfo = $("#" + markerId)[0].info;
    var oldMarkerColor = $("#" + markerId)[0].color;
    var oldMarkerClass = MARKER_COLOR_PREFIX + oldMarkerColor;

    var text = "Please enter new marker name here";
    IO.promptEditMarker(
      markerId,
      function (newMarkerName, newMarkerInfo, newMarkerColor, newTime) {
        if (
          newMarkerName === null ||
          newMarkerName === "" ||
          newTime === null ||
          newTime === ""
        ) {
          return;
        }

        if (newTime < 0) newTime = 0;
        if (newTime > $("audio, video")[0].duration)
          newTime = $("audio, video")[0].duration;

        var updated = false;

        // Update HTML Name
        if (newMarkerName != oldName) {
          updated = true;
          $("#" + markerId).val(newMarkerName);
        }

        // update HTML Info
        if (newMarkerInfo != oldMarkerInfo) {
          updated = true;
          $("#" + markerId)[0].info = newMarkerInfo;

          if ($("#" + markerId).hasClass("currentMarker"))
            $("#markerInfoArea").val(newMarkerInfo);
        }
        if (newMarkerColor != oldMarkerColor) {
          updated = true;
          $("#" + markerId)[0].color = newMarkerColor;
          $("#" + markerId)
            .parent()
            .removeClass(oldMarkerClass);
          $("#" + markerId)
            .parent()
            .addClass(MARKER_COLOR_PREFIX + newMarkerColor);
        }

        // update HTML Time
        if (newTime != oldTime) {
          updated = true;

          $("#" + markerId)[0].timeValue = newTime;
          $("#" + markerId + "S")[0].timeValue = newTime;
          Troff.setAppropriateMarkerDistance();

          var startTime = Number($(".currentMarker")[0].timeValue);
          var stopTime = Number($(".currentStopMarker")[0].timeValue);

          if (startTime >= stopTime) {
            $(".currentStopMarker").removeClass("currentStopMarker");
            Troff.setAppropriateActivePlayRegion();
          }
          $("#" + markerId)
            .prev()
            .html(Troff.secToDisp(newTime));
        }

        // update name and time and info and color in DB, if nessessarry
        if (updated) {
          DB.updateMarker(
            markerId,
            newMarkerName,
            newMarkerInfo,
            newMarkerColor,
            Number(newTime),
            strCurrentSong
          );
          Troff.fixMarkerExtraExtendedColor();
          /*
            note: DB.updateMarker will also update the "currentStartMarker" and the
            currentStopMarker, if the updated marker is the start or stop marker.
            */
        }
      }
    ); // end prompt-Function
  }; // end editMarker ******/

  /*
        clearAllStates - HTML, clears states
    */
  this.clearAllStates = function () {
    $("#stateList").empty();
    $("#statesHelpText").show();
  }; // end clearAllStates

  /*
        clearAllMarkers - HTML, clears markers
    */
  this.clearAllMarkers = function () {
    $("#markerSection").css("height", "100%");
    $("#markerSection").css("margin-top", 0);
    var docMarkerList = document.getElementById("markerList");
    if (docMarkerList) {
      while (docMarkerList.firstChild) {
        docMarkerList.removeChild(docMarkerList.firstChild);
      }
    }
  }; // end clearAllMarkers

  /*Troff*/ this.setAppropriateActivePlayRegion = function () {
    var aFirstAndLast = Troff.getFirstAndLastMarkers();

    if (aFirstAndLast === null || aFirstAndLast === undefined) {
      setTimeout(Troff.setAppropriateActivePlayRegion, 200);
      return;
    }

    var firstMarkerId = aFirstAndLast[0];
    var lastMarkerId = aFirstAndLast[1] + "S";
    if ($(".currentMarker").length === 0) {
      $("#" + firstMarkerId).addClass("currentMarker");
      $("#markerInfoArea").val($("#" + firstMarkerId)[0].info);
    }
    if ($(".currentStopMarker").length === 0)
      $("#" + lastMarkerId).addClass("currentStopMarker");

    var timeBarHeight = $("#timeBar").height() - 12;
    var barMarginTop = parseInt($("#timeBar").css("margin-top")) + 6;

    var startTime = Troff.getStartTime();
    var stopTime = Troff.getStopTime();
    var songTime = $("audio, video")[0].duration;

    var height = ((stopTime - startTime) * timeBarHeight) / songTime;
    var top = (startTime * timeBarHeight) / songTime + barMarginTop;

    $("#activePlayRegion").height(height);
    $("#activePlayRegion").css("margin-top", top + "px");
  }; // end setAppropriateActivePlayRegion

  this.setAppropriateMarkerDistance = function () {
    $("#markerSection").removeClass("hidden");
    var child = $("#markerList li:first-child")[0];

    var timeBarHeight = $("#timeBar").height() - 10;
    var totalDistanceTop = 4;

    var barMarginTop = parseInt($("#timeBar").css("margin-top"));
    var audioVideo = document.querySelector("audio, video");
    if (audioVideo == null) {
      log.e("there is no audio or video tag");
      return;
    }
    var songTime = audioVideo.duration;

    if (!isFinite(songTime)) {
      troffData = nDB.get(Troff.getCurrentSong());
      if (
        troffData.fileData != undefined &&
        troffData.fileData.duration != undefined
      ) {
        songTime = troffData.fileData.duration;
      } else {
        songTime = Number(
          $("#markerList li:last-child")[0].childNodes[2].timeValue
        );
      }
    }

    while (child) {
      var markerTime = Number(child.childNodes[2].timeValue);
      var myRowHeight = child.clientHeight;

      var freeDistanceToTop = (timeBarHeight * markerTime) / songTime;

      var marginTop = freeDistanceToTop - totalDistanceTop + barMarginTop;
      totalDistanceTop = freeDistanceToTop + myRowHeight + barMarginTop;

      if (marginTop > 0) {
        $(child).css("border-top-width", marginTop + "px");
        $(child).css("border-top-style", "solid");
        $(child).css("margin-top", "");
      } else {
        $(child).css("border-top-width", "");
        $(child).css("border-top-style", "");
        $(child).css("margin-top", marginTop + "px");
      }
      child = child.nextSibling;
    }
    Troff.setAppropriateActivePlayRegion();
  }; // end setAppropriateMarkerDistance

  this.selectNext = function (reverse) {
    var markers = $("#markerList").children();

    var currentMarkerTime = Number($(".currentMarker")[0].timeValue, 10);
    var currentStopTime = Number($(".currentStopMarker")[0].timeValue, 10);
    markers.sort(function (a, b) {
      return (
        Number(a.childNodes[2].timeValue) - Number(b.childNodes[2].timeValue)
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

    function checkOrSelect(i) {
      if (bSelectNextStop) {
        $(markers[i].childNodes[3]).click();
        bSelectNextStop = false;
      }
      if (Number(markers[i].childNodes[3].timeValue) == currentStopTime) {
        bSelectNextStop = true;
      }
      if (bSelectNext) {
        $(markers[i].childNodes[2]).click();
        bSelectNext = false;
      }
      if (Number(markers[i].childNodes[2].timeValue) == currentMarkerTime) {
        bSelectNext = true;
      }
    }
  };

  this.zoomDontShowAgain = function () {
    $("#zoomInstructionDialog").addClass("hidden");
    Troff.dontShowZoomInstructions = true;
    DB.setZoomDontShowAgain();
    IO.clearEnterFunction();
  };

  this.zoomDialogOK = function () {
    $("#zoomInstructionDialog").addClass("hidden");
    IO.clearEnterFunction();
  };

  this.zoomOut = function () {
    IO.blurHack();
    Troff.zoom(0, Number(document.getElementById("timeBar").max));
  };

  this.zoomToMarker = function () {
    IO.blurHack();
    var startTime = Troff.getStartTime();
    var endTime = Troff.getStopTime();
    if (startTime === m_zoomStartTime && endTime == m_zoomEndTime) {
      if (!Troff.dontShowZoomInstructions) {
        IO.setEnterFunction(Troff.zoomDialogOK);
        $("#zoomInstructionDialog").removeClass("hidden");
      }
    }
    Troff.zoom(startTime, endTime);
  };

  this.zoom = function (startTime, endTime) {
    //NOTE all distances is in %, unless otherwise specified

    if (endTime === undefined) {
      return;
    }

    m_zoomStartTime = startTime;
    m_zoomEndTime = endTime;

    DB.saveZoomTimes(strCurrentSong, startTime, endTime);

    var winHeightPX = $("#markerSectionParent").height();

    var mPX = parseInt($("#timeBar").css("marginTop"));

    var mDiv = 8; //parseInt($('#timeBar').css('marginTop'))

    var oH = 100; //original Height of div
    var m = ((mPX + mDiv) * oH) / winHeightPX; // original margin between timebar and div
    var mT = 2 * m; //total margin
    var oh = oH - mT; //original Height of timebar

    var tL = Number(document.getElementById("timeBar").max);
    var t1 = startTime / tL;
    var t2 = endTime / tL;

    var zt = 1 / (t2 - t1); // == tL/(endTime - startTime);
    var zd = (zt * oh + mT) / oH;
    var mt = t1 * oh * zt;

    var height = 100 * zd;
    var marginTop = -mt;

    let marginTopPX = (winHeightPX * marginTop) / 100;

    $("#markerSection").css("height", height + "%");
    $("#markerSection").css("margin-top", marginTopPX + "px");

    Troff.setAppropriateMarkerDistance();
  };

  this.onTapTempoSavedToDb = function () {
    ifGroupSongUpdateFirestore(Troff.getCurrentSong());
  };

  this.tapTime = function () {
    previousTime = time;
    time = new Date().getTime() / 1000;
    IO.blurHack();

    if (time - previousTime > 3) {
      startTime = previousTime = time;
      nrTaps = 0;
    } else {
      nrTaps++;
    }
    let currTempo = Math.round((nrTaps * 60) / (time - startTime));

    if (Number.isInteger(currTempo)) {
      $("#tapTempo").val(currTempo);
      IO.updateCellInDataTable("TEMPO", currTempo);
    } else {
      $("#tapTempo").val("");
      IO.updateCellInDataTable("TEMPO", "");
    }

    $("#tapTempo")[0].dispatchEvent(new Event("input"));
  };

  this.fixMarkerExtraExtendedColor = function () {
    $("#markerList").children().removeClassStartingWith("extend_");

    $("#markerList")
      .children(":not(.markerColorNone)")
      .each(function (index) {
        specialColorClass = Troff.getClassStartsWith(
          $(this).attr("class"),
          "markerColor"
        );
        $(this)
          .nextUntil(":not(.markerColorNone)")
          .addClass("extend_" + specialColorClass);
      });
  };

  /* standAlone Functions */
  this.getClassStartsWith = function (classes, startString) {
    var r = $.grep(classes.split(" "), function (classes, r) {
      return 0 === classes.indexOf(startString);
    }).join();
    return r || !1;
  };

  this.secToDisp = function (seconds) {
    return st.secToDisp(seconds);
  };

  /*Troff*/ this.incrementInput = function (identifier, amount) {
    $(identifier).val(parseInt($(identifier).val()) + amount);
    $(identifier).each((i, element) => {
      element.dispatchEvent(new Event("input"));
    });
  };

  /* end standAlone Functions */

  /*Troff*/ this.checkHashAndGetSong = async () => {
    if (window.location.hash) {
      try {
        await Troff.downloadSongFromServer(window.location.hash);
      } catch (e) {
        log.e("error on downloadSongFromServer:", e);
        DB.getCurrentSong();
      }
    } else {
      DB.getCurrentSong();
    }
  };
}; // end TroffClass

// Make TroffClass available globally for browser compatibility
if (typeof window !== 'undefined') {
  window.TroffClass = TroffClass;
}

// Export TroffClass for ES6 module usage
export { TroffClass };
