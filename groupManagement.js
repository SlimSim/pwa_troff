// Group management functions

function groupDialogSave(event) {
  // Implementation for saving group dialog
}

const addGroupSongRow = (songIdObject) => {
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

const removeSongRow = (event) => {
  const row = $(event.target).closest(".form-group.row");
  row.find(".groupDialogSong").addClass("bg-danger removed");
  /*
      notifyUndo( song + " was removed.", function() {
          addGroupOwnerRow( song );
      } );
      */

  //row.remove();
};

export { groupDialogSave, addGroupSongRow };
