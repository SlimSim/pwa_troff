// DataTable-related functions

import { gtag } from './services/analytics.js';
import { DATA_TABLE_COLUMNS } from './constants/constants.js';
import { TROFF_SETTING_SONG_COLUMN_TOGGLE } from './constants/constants.js';
import { createSongAudio, DB, Troff } from './script.js';
import { openEditSongDialog } from './songManagement.js';
import log from './utils/log.js';

function dataTableColumnPicker(event: JQuery.ClickEvent) {
  var $target = $(event.target);
  // Get the column API object
  var column = ($('#dataSongTable') as any).DataTable().column($target.data('column'));

  $target.toggleClass('active');

  const columnVisibilityObject: Record<string, boolean> = {};

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
  var dataSongTable: any,
    selectAllCheckbox = $(
      '<div class="checkbox preventSongLoad"><label><input type="checkbox" value=""><span class="cr"><i class="cr-icon fa-check"></i></span></label></div>'
    );

  selectAllCheckbox.click(() => {
    var headerCheckbox = $('#dataSongTable').find('th').find('input[type=checkbox]'),
      allCheckboxes = $('#dataSongTable').find('td').find('input[type=checkbox]');
    allCheckboxes.prop('checked', headerCheckbox.is(':checked'));
  });

  for (let i = 0; i < DATA_TABLE_COLUMNS.list.length; i++) {
    $('#dataSongTable')
      .find('thead')
      .find('tr')
      .append($('<th>').addClass('primaryColor').text(DATA_TABLE_COLUMNS.list[i].header));
  }

  $('#dataSongTable')
    .find('thead')
    .find('tr')
    .children()
    .eq(DATA_TABLE_COLUMNS.getPos('CHECKBOX'))
    .text('')
    .append(selectAllCheckbox);

  dataSongTable = ($('#dataSongTable') as any)
    .DataTable({
      language: {
        emptyTable:
          '<h1 class="lead">No files added!</h1>' +
          '<br /><a href="/#2582986745&demo.mp4">Download the demo-video</a>,' +
          '<br /><br />find new songs at <a href="/find.html">troff.app/find.html</a>' +
          '<br /><br />or add your own songs by clicking the <br / >' +
          '<label ' +
          'title="Add songs, videos or pictures to Troff"' +
          'class="cursor-pointer mr-2 regularButton fa-stack Small full-height-on-mobile"' +
          'for="fileUploader">' +
          '<i class="fa-music fa-stack-10x m-relative-7 font-size-relative-1"></i>' +
          '<i class="fa-plus fa-stack-10x m-relative-4 font-size-relative-65"></i>' +
          '</label>' +
          '-button at the top<br />of the song-dialog',
      },
      fixedHeader: true,
      paging: false,
      createdRow: (row: string) => {
        $(row).attr('draggable', 'true');
      },
      columnDefs: [
        {
          targets: DATA_TABLE_COLUMNS.getPos('CHECKBOX'),
          data: null,
          className: 'preventSongLoad secondaryColor',
          orderable: false,
          defaultContent:
            '<div class="checkbox"><label><input type="checkbox" value=""><span class="cr"><i class="cr-icon fa fa-check"></i></span></label></div>',
        },
        {
          targets: DATA_TABLE_COLUMNS.getPos('DISPLAY_NAME'),
          className: 'min-w-200-on-attached secondaryColor',
        },
        {
          targets: DATA_TABLE_COLUMNS.getPos('EDIT'),
          data: null,
          className: 'preventSongLoad secondaryColor onClickOpenEditSongDialog',
          orderable: false,
          defaultContent:
            '<button class="regularButton"><i class="cr-icon fa fa-pencil"></i></button>',
        },
        {
          targets: DATA_TABLE_COLUMNS.getPos('TYPE'),
          className: 'secondaryColor text-center',
        },
        {
          targets: ['_all'],
          className: 'secondaryColor',
        },
      ],
    })
    .on('dragstart', 'tr', (event: any) => {
      //function dragSongToSonglist(event){
      if (event.dataTransfer === undefined) {
        event.dataTransfer = event.originalEvent.dataTransfer;
      }

      const jsonDataInfo = dataSongTable.row($(event.currentTarget)).data()[
        DATA_TABLE_COLUMNS.getPos('DATA_INFO')
      ];

      event.dataTransfer.setData('jsonDataInfo', jsonDataInfo);
    })
    .on('click', 'tbody tr', function (event: JQuery.ClickEvent) {
      Troff.iOSHasLoadedSong = true;
      const $td = $(event.target).closest('td, th');

      const songKey = $(event.currentTarget).data('song-key');
      if ($td.hasClass('onClickOpenEditSongDialog')) {
        openEditSongDialog(songKey);
      }

      if ($td.hasClass('preventSongLoad') || $td.hasClass('dataTables_empty')) {
        return;
      }

      ($('#dataSongTable') as any)
        .DataTable()
        .rows('.selected')
        .nodes()
        .to$()
        .removeClass('selected');
      $(event.currentTarget).addClass('selected');

      gtag('event', 'Change Song', { event_category: 'Perform change', event_label: '' });

      createSongAudio(songKey);
    });

  /*
	//något att titta på: ???????? slim sim :)  (för att ordna kolumnerna :) (fixa DB sparning, o interface...x ) )
	var table = $('#table').DataTable({ colReorder: true });
	$('button#newOrder').click(function() {
			table.colReorder.order([3,4,2,0,1], true);
	});
	*/

  //to make header primaryColor:
  $('#dataSongTable thead th').removeClass('secondaryColor');

  // to move the searchbar away from the scrolling-area
  $('#dataSongTable_filter').detach().prependTo($('#newSearchParent'));
  $('#dataSongTable_filter')
    .find('input')
    .attr('placeholder', 'Search (Ctrl + F)')
    .addClass('form-control-sm')
    .detach()
    .prependTo($('#dataSongTable_filter'))
    .on('click', Troff.enterSerachDataTableSongList)
    .on('keyup', Troff.onSearchKeyup)
    .on('blur', Troff.exitSerachDataTableSongList);

  $('#dataSongTable_filter').find('label').remove();

  if ($('#toggleSonglistsId').hasClass('active')) {
    $('#buttAttachedSongListToggle').addClass('active');
  }

  // Options for the observer (which mutations to observe)
  const songListsObserverConfig = {
    attributes: true,
    childList: false,
    subtree: false,
  };

  // Callback function to execute when mutations are observed
  var songListsObserverCallback = (mutationsList: MutationRecord[]) => {
    for (var mutation of mutationsList) {
      if (mutation.attributeName === 'class') {
        if ($(mutation.target).hasClass('active')) {
          $('#buttAttachedSongListToggle').addClass('active');
        } else {
          $('#buttAttachedSongListToggle').removeClass('active');
        }
        return;
      }
    }
  };

  // Create an observer instance linked to the callback function
  var songListsObserver = new MutationObserver(songListsObserverCallback);
  // Start observing the target node for configured mutations
  songListsObserver.observe($('#toggleSonglistsId')[0], songListsObserverConfig);
}

export { dataTableColumnPicker, initSongTable };
