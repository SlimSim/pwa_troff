// Song management functions

import { getFileExtension } from "./utils/utils.js";
import { getFileTypeFaIcon } from "./script0.js";
import { sortAndValue } from "./script0.js";
import { DATA_TABLE_COLUMNS } from "./constants/constants.js";
import { Troff } from "./script.js";
import { DB } from "./script.js";
import { st } from "./assets/internal/st-script.js";
import { SongToGroup } from "./scriptASimple.js";

function addItem_NEW_2(key) {
  var galleryId = "pwa-galleryId";
  var extension = getFileExtension(key);
  var faType = getFileTypeFaIcon(key);

  var selected_path = Troff.getCurrentSong();
  var selected_galleryId = Troff.getCurrentGalleryId();

  var dataInfo = {
    galleryId: galleryId,
    fullPath: key,
  };

  const strDataInfo = JSON.stringify(dataInfo);
  const thisSongAlreadyAdded = $("#dataSongTable")
    .DataTable()
    .column(DATA_TABLE_COLUMNS.getPos("DATA_INFO"))
    .data()
    .toArray()
    .includes(strDataInfo);
  if (thisSongAlreadyAdded) {
    return;
  }

  DB.getVal(key, function (song) {
    var tempo = "",
      info = "",
      duration = sortAndValue(0, ""),
      lastModified = "",
      size = "",
      customName = "",
      choreography = "",
      choreographer = "",
      title = "",
      artist = "",
      album = "",
      genre = "",
      tags = "",
      titleOrFileName = "";

    if (song != undefined) {
      if (song.TROFF_VALUE_tapTempo != undefined)
        tempo = song.TROFF_VALUE_tapTempo;
      if (song.info != undefined) info = song.info;
    }

    if (song && song.fileData) {
      if (song.fileData.duration) {
        duration = sortAndValue(
          song.fileData.duration,
          Troff.secToDisp(song.fileData.duration)
        );
      }
      if (song.fileData.lastModified) {
        lastModified = st.millisToDisp(song.fileData.lastModified);
      }
      if (song.fileData.size) {
        size = sortAndValue(
          song.fileData.size,
          st.byteToDisp(song.fileData.size)
        );
      }
      customName = song.fileData.customName;
      choreography = song.fileData.choreography;
      choreographer = song.fileData.choreographer;
      title = song.fileData.title;
      artist = song.fileData.artist;
      album = song.fileData.album;
      genre = song.fileData.genre;
      tags = song.fileData.tags;
    }

    titleOrFileName =
      customName || choreography || title || Troff.pathToName(key);

    let columns = [];

    (columns[DATA_TABLE_COLUMNS.getPos("DATA_INFO")] = strDataInfo),
      (columns[DATA_TABLE_COLUMNS.getPos("TYPE")] = sortAndValue(
        faType,
        '<i class="fa ' + faType + '"></i>'
      )), //type
      (columns[DATA_TABLE_COLUMNS.getPos("DURATION")] = duration),
      (columns[DATA_TABLE_COLUMNS.getPos("DISPLAY_NAME")] = titleOrFileName),
      (columns[DATA_TABLE_COLUMNS.getPos("CUSTOM_NAME")] = customName || ""),
      (columns[DATA_TABLE_COLUMNS.getPos("CHOREOGRAPHY")] = choreography || ""),
      (columns[DATA_TABLE_COLUMNS.getPos("CHOREOGRAPHER")] =
        choreographer || ""),
      (columns[DATA_TABLE_COLUMNS.getPos("TITLE")] = title || ""),
      (columns[DATA_TABLE_COLUMNS.getPos("ARTIST")] = artist || ""),
      (columns[DATA_TABLE_COLUMNS.getPos("ALBUM")] = album || ""),
      (columns[DATA_TABLE_COLUMNS.getPos("TEMPO")] = tempo || ""),
      (columns[DATA_TABLE_COLUMNS.getPos("GENRE")] = genre || ""),
      (columns[DATA_TABLE_COLUMNS.getPos("TAGS")] = tags || ""),
      (columns[DATA_TABLE_COLUMNS.getPos("LAST_MODIFIED")] = lastModified),
      (columns[DATA_TABLE_COLUMNS.getPos("FILE_SIZE")] = size),
      (columns[DATA_TABLE_COLUMNS.getPos("INFO")] = info),
      (columns[DATA_TABLE_COLUMNS.getPos("EXTENSION")] = "." + extension);

    var newRow = $("#dataSongTable")
      .DataTable()
      .row.add(columns)
      //.onClick => .on('click', 'tbody tr', function(event) i funktionen initSongTable
      //						onSongLoad [loadedmetadata] finns i, addAudioToContentDiv och addVideoToContentDiv (dom anropar bla setMetadata)
      .draw(false)
      .node();

    // todo: remove DATA_INFO and use this data-song-key instead!
    $(newRow).attr("data-song-key", key);
    if (SongToGroup.getNrOfGroupsThisSongIsIn(key) > 0) {
      $(newRow).addClass("groupIndication");
    }

    if (selected_path == key && selected_galleryId == galleryId) {
      $("#dataSongTable").find("tbody tr").removeClass("selected");
      $(newRow).addClass("selected");
    }
  }); // end DB.getVal
}

export { addItem_NEW_2 };
