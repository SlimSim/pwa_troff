// DataTable-related functions

import { DATA_TABLE_COLUMNS } from './constants/constants.js';
import { TROFF_SETTING_SONG_COLUMN_TOGGLE } from './constants/constants.js';
import { DB } from './script.js';

function dataTableColumnPicker(event) {
  console.log('dataTAbleColumnPicker ->');
  var $target = $(event.target);
  // Get the column API object
  var column = $('#dataSongTable').DataTable().column($target.data('column'));

  $target.toggleClass('active');

  const columnVisibilityObject = {};

  $('#columnToggleParent')
    .children()
    .map((i, v) => {
      const dataColumn = $(v).data('column');
      const columnId = DATA_TABLE_COLUMNS.list[dataColumn].id;
      columnVisibilityObject[columnId] = $(v).hasClass('active');
    });

  DB.saveVal(TROFF_SETTING_SONG_COLUMN_TOGGLE, columnVisibilityObject);

  // Toggle the visibility
  column.visible(!column.visible());
}

function initSongTable() {
  // Implementation for initializing the song table
}

export { dataTableColumnPicker, initSongTable };
