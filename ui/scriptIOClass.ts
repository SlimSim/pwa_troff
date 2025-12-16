/* eslint eqeqeq: "off" */
import '../assets/internal/extend-jquery.js';
import { nDB } from '../assets/internal/db.js';
import { st } from '../assets/internal/st-script.js';
import { Troff, Rate, googleSignIn, onOnline, doSignOut } from '../script.js';
import { groupDialogSave, addGroupOwnerRow } from '../features/groupManagement.js';
import {
  clickButtNewSongList,
  onChangeSongListSelector,
  closeSongDialog,
  clickSongsDialog,
  minimizeSongPicker,
  maximizeSongPicker,
  clickAttachedSongListToggle,
  clickToggleFloatingSonglists,
  reloadSongsButtonActive,
} from '../script0.js';
import { gtag } from '../services/analytics.js';
import { clickSongList_NEW } from '../scriptTroffClass.js';
import log from '../utils/log.js';
import { TROFF_SETTING_CONFIRM_DELETE_MARKER, DATA_TABLE_COLUMNS } from '../constants/constants.js';
import { IOInput } from 'types/io.js';
import { sleep } from '../utils/timeHack.js';
import { blurHack } from '../utils/utils.js';
import { appendColorButtonsTo, markersExist } from './troffUi.js';
import { MarkerColorConfig } from 'types/markers.js';

class IOClass {
  IOEnterFunction: boolean | ((event: KeyboardEvent) => any);
  IOArrowFunction: boolean | ((event: KeyboardEvent) => any);

  constructor() {
    this.IOEnterFunction = false;
    this.IOArrowFunction = false;
  }

  /* this is used to know if button-presses should be in "pop-up"-mode
		or in regular mode */

  toggleFullScreen = () => {
    const doc = window.document as any;

    const isNotFullScreen =
      !doc.fullscreenElement &&
      !doc.mozFullScreenElement &&
      !doc.webkitFullscreenElement &&
      !doc.msFullscreenElement;

    if (isNotFullScreen) {
      const docEl = doc.documentElement as any;
      const requestFullScreen =
        docEl.requestFullscreen ||
        docEl.mozRequestFullScreen ||
        docEl.webkitRequestFullScreen ||
        docEl.msRequestFullscreen;

      requestFullScreen.call(docEl);
    } else {
      const cancelFullScreen =
        doc.exitFullscreen ||
        doc.mozCancelFullScreen ||
        doc.webkitExitFullscreen ||
        doc.msExitFullscreen;
      cancelFullScreen.call(doc);
    }
  };

  isSongSelected = () => {
    return ($('#dataSongTable') as any).DataTable().rows('.selected').data().length > 0;
  };

  updateCellInDataTable = (column: string, value: string, key?: string) => {
    console.trace();
    console.log('updateCellInDataTable ->', column, value, key);
    if (key == undefined) {
      console.log('data table get pos ', DATA_TABLE_COLUMNS.getPos(column));
      ($('#dataSongTable') as any)
        .DataTable()
        .cell('.selected', DATA_TABLE_COLUMNS.getPos(column))
        .data(value);
      console.log('updateCellInDataTable done');
      return;
    }
    ($('#dataSongTable') as any)
      .DataTable()
      .cell('[data-song-key="' + key + '"]', DATA_TABLE_COLUMNS.getPos(column))
      .data(value);
  };

  fullScreenChange = () => {
    if (document.fullscreenElement) {
      $('.toggleFullScreenExpandIcon').addClass('hidden');
      $('.toggleFullScreenCompressIcon').removeClass('hidden');
    } else {
      $('.toggleFullScreenExpandIcon').removeClass('hidden');
      $('.toggleFullScreenCompressIcon').addClass('hidden');
    }
  };

  openWindow = (event: JQuery.TriggeredEvent) => {
    const $button = $(event.target).closest('[data-href]');
    window.open($button.data('href'), $button.data('target'));
  };

  removeLoadScreenSoon = () => {
    sleep(10000).then(() => {
      this.removeLoadScreen();
    });
  };

  removeLoadScreen = () => {
    $('#loadScreen, #loadScreenStyle').remove();
  };

  startFunc = () => {
    if (nDB.get('TROFF_FIREBASE_PREVIOUS_SIGNED_IN')) {
      $('.hide-on-sign-out').removeClass('hidden');
      $('.hide-on-sign-in').addClass('hidden');
    }

    document.addEventListener('keydown', this.keyboardKeydown);
    document.addEventListener('fullscreenchange', this.fullScreenChange);

    $('.outerDialog').click((event) => {
      if ($(event.target).hasClass('outerDialog') && !$(event.target).hasClass('noCloseOnClick')) {
        $(event.target).addClass('hidden');
      }
    });

    // this is to not change volume or speed when scrolling horizontally on mobile (require https://j11y.io/javascript/special-scroll-events-for-jquery/)
    $(document).on('scrollStart', () => {
      $('.sliderRange, #timeBar').prop('disabled', true);
    });
    $(document).on('scrollStop', () => {
      $('.sliderRange, #timeBar').prop('disabled', false);
      $('#volumeBar').val(Number($('#volume').text()));
      $('#speedBar').val(Number($('#speed').text()));
    });

    $('[data-st-css-selector-to-toggle]').on('click', (event) => {
      blurHack();
      var $target = $(event.target),
        $value = $($target.data('st-css-selector-to-toggle'));

      if ($target.hasClass('stOnOffButton')) {
        if ($value.hasClass('hidden')) {
          $target.removeClass('active');
        } else {
          $target.addClass('active');
        }
      }
    });

    $('[data-st-css-selector-to-fade-in]').on('click', (event) => {
      blurHack();
      var $target = $(event.target),
        $value = $($target.data('st-css-selector-to-fade-in'));

      if ($target.hasClass('stOnOffButton')) {
        if ($value.hasClass('fadeIn')) {
          $target.addClass('active');
        } else {
          $target.removeClass('active');
        }
      }
    });

    $('.regularButton').on('click', blurHack);

    //TODO: fix so that all cancelButtons use this class, and remove there id, and event-listener :)
    $('.dialogCancelButton').click((event) => {
      event.preventDefault();
      $(event.target).closest('.outerDialog').addClass('hidden');
    });

    $('[data-href]').on('click', this.openWindow);
    $('.onClickToggleFullScreen').on('click', this.toggleFullScreen);
    $('.blurOnClick').on('click', blurHack);
    $('.showUploadSongToServerDialog').on('click', Troff.showUploadSongToServerDialog);
    $('#buttCopyUrlToClipboard').on('click', Troff.buttCopyUrlToClipboard);
    $('.onClickCopyTextToClipboard').on('click', this.onClickCopyTextToClipboard);

    $('#groupDialogSave').on('click', groupDialogSave);

    $('#buttNewSongList').on('click', clickButtNewSongList);
    $('#songListAll').click(clickSongList_NEW);
    $('#clickSongListAll').click(() => $('#songListAll').click());
    $('#songListSelector').change(onChangeSongListSelector);

    $('.buttSettingsDialog').click(Troff.openSettingsDialog);
    $('#buttCloseSettingPopUpSquare').click(Troff.closeSettingsDialog);

    $('.buttCloseSongsDialog').click(closeSongDialog);
    $('#buttAttachedSongListToggle').click(clickAttachedSongListToggle);
    $('.emptyAddAddedSongsToSongList_songs').on('click', Troff.emptyAddAddedSongsToSongList_songs);

    $('#buttSongsDialog').click(clickSongsDialog);
    $('.buttSetSongsDialogToAttachedState').click(minimizeSongPicker);
    $('.buttSetSongsDialogToFloatingState').click(maximizeSongPicker);
    $('#outerSongListPopUpSquare').click(reloadSongsButtonActive);

    $('#TROFF_SETTING_SONG_LIST_FLOATING_DIALOG').click(clickToggleFloatingSonglists);

    $('#toggleExtendedMarkerColor').click(Troff.toggleExtendedMarkerColor);
    $('#toggleExtraExtendedMarkerColor').click(Troff.toggleExtraExtendedMarkerColor);

    $('#themePickerParent').find('input').click(Troff.setTheme);

    $('#buttPlayUiButtonParent').on('butt-clicked', Troff.playUiButton);

    $('#timeBar')[0].addEventListener('input', Troff.timeUpdate);
    $('#volumeBar')[0].addEventListener('input', Troff.volumeUpdate);
    $('#speedBar')[0].addEventListener('input', Troff.speedUpdate);
    $('#speedBar').on('change', (e) => {
      gtag('event', 'Set Speed', {
        event_category: 'Perform change',
        event_label: $(e.target).val() as string,
      });
    });

    $('#buttRememberState').click(Troff.rememberCurrentState);
    $('#buttMarker').click(Troff.createMarker);
    $('#okCopyMarkersDialog').click(Troff.copyMarkers);
    $('#buttOpenCopyMarkersDialog').click(Troff.openCopyMarkersDialog);
    $('#okMoveAllMarkersDialogUp').click(Troff.moveAllMarkersUp);
    $('#okMoveAllMarkersDialogDown').click(Troff.moveAllMarkersDown);
    $('#okMoveSomeMarkersDialogUp').click(Troff.moveSomeMarkersUp);
    $('#okMoveSomeMarkersDialogDown').click(Troff.moveSomeMarkersDown);
    $('#okDeleteSelectedMarkersDialog').click(Troff.deleteSelectedMarkers);
    $('#okDeleteAllMarkersDialog').click(Troff.deleteAllMarkers);
    $('#okStretchSelectedMarkersDialog').click(Troff.stretchSelectedMarkers);
    $('#okStretchAllMarkersDialog').click(Troff.stretchAllMarkers);

    // $('#openExportGlobalSettingsDialog').on('click', Troff.openExportGlobalSettingsDialog);
    // $('#openExportAllDataDialog').on('click', Troff.openExportAllDataDialog);
    // $('#okImportAllDataDialog').on('click', Troff.okImportAllDataDialog);
    // $('#okClearAndImportAllDataDialog').on('click', Troff.okClearAndImportAllDataDialog);
    // $('#okImportGlobalSettingsDialog').on('click', Troff.okImportGlobalSettingsDialog);

    $('.writableField').on('click', Troff.enterWritableField);
    $('.writableField').on('blur', Troff.exitWritableField);

    $('#editSongDialogSave').on('click', Troff.editSongDialogSave);
    $('.onEditUpdateName').on('change', Troff.onEditUpdateName);

    $('#buttCancelMoveMarkersDialog').click(Troff.hideMoveMarkers);
    $('#buttPromptMoveMarkers').click(Troff.showMoveMarkers);
    $('#buttPromptMoveMarkersMoreInfo').click(Troff.toggleMoveMarkersMoreInfo);
    $('#buttImportExportMarker').click(Troff.toggleImportExport);
    $('#buttCancelImportExportPopUpSquare').click(Troff.toggleImportExport);
    $('#buttExportMarker').click(Troff.exportStuff);
    $('#buttImportMarker').click(Troff.importStuff);

    $('[data-save-on-song-toggle-class]').click(this.saveOnSongToggleClass);

    $('#songlistIconPicker').find('button').on('click', Troff.setSonglistIcon);

    // The jQuery version doesn't update as the user is typing:
    $('[data-save-on-song-value]').each((i, element) => {
      $(element)[0].addEventListener('input', this.saveOnSongValue);
    });
    $('#pauseBeforeStart')[0].addEventListener('input', Troff.updateSecondsLeft);
    $('#buttPauseBefStart').click(() => {
      setTimeout(() => Troff.updateSecondsLeft(), 0);
    });
    $('#stopAfter')[0].addEventListener('input', Troff.setAppropriateActivePlayRegion);
    $('#buttStopAfter').click(() => {
      setTimeout(() => Troff.setAppropriateActivePlayRegion(), 0);
    });
    $('#startBefore')[0].addEventListener('input', Troff.updateStartBefore);
    $('#buttStartBefore').click(() => {
      setTimeout(() => Troff.updateStartBefore(), 0);
    });

    $('#buttZoom').click(Troff.zoomToMarker);
    $('#buttZoomOut').click(Troff.zoomOut);

    $('#areaSelector >').click(Troff.toggleArea);
    $('.onClickReload').click(() => window.location.reload());

    $('#markerInfoArea').change(Troff.updateMarkerInfo);
    $('#markerInfoArea').blur(Troff.exitMarkerInfo);
    $('#markerInfoArea').click(Troff.enterMarkerInfo);

    $('#songInfoArea').change(Troff.updateSongInfo);
    $('#songInfoArea').blur(Troff.exitSongInfo);
    $('#songInfoArea').click(Troff.enterSongInfo);
    $('#removeSongList').click(Troff.onClickremoveSonglist);
    $('#leaveGroup').click(Troff.onClickLeaveGroup);
    $('#shareSonglist').click(Troff.onClickShareSonglist);

    $('#buttUnselectMarkers').click(Troff.unselectMarkers);
    $('#buttResetVolume').click(() =>
      Troff.setVolume($('#TROFF_SETTING_SONG_DEFAULT_VOLUME_VALUE').val() as number)
    );
    $('#volumeMinus').click(() => {
      Troff.incrementInput('#volumeBar', -5);
    });
    $('#volumePlus').click(() => {
      Troff.incrementInput('#volumeBar', +5);
    });
    $('#buttResetSpeed, #buttResetSpeedDemo').click(() =>
      Troff.setSpeed($('#TROFF_SETTING_SONG_DEFAULT_SPEED_VALUE').val() as number)
    );
    $('#speedMinus, #speedMinusDemo').click(() => {
      Troff.incrementInput('#speedBar', -5);
      gtag('event', 'Increment Speed', {
        event_category: 'Perform change',
        event_label: $('#speedBar').val() as string,
      });
    });
    $('#speedPlus, #speedPlusDemo').click(() => {
      Troff.incrementInput('#speedBar', +5);
      gtag('event', 'Increment Speed', {
        event_category: 'Perform change',
        event_label: $('#speedBar').val() as string,
      });
    });

    $('#buttTapTempo').click(Troff.tapTime);
    $('#tapTempo').on('savedToDbEvent', Troff.onTapTempoSavedToDb);

    $('#rateDialogNoThanks').click(Rate.rateDialogNoThanks);
    $('#rateDialogAskLater').click(Rate.rateDialogAskLater);
    $('#rateDialogRateNow').click(Rate.rateDialogRateNow);

    $('#zoomInstructionDialogDontShowAgain').click(Troff.zoomDontShowAgain);
    $('#zoomInstructionDialogOK').click(Troff.zoomDialogOK);

    $('#importTroffDataToExistingSong_importNew').click(
      Troff.importTroffDataToExistingSong_importNew
    );
    $('#importTroffDataToExistingSong_merge').click(Troff.importTroffDataToExistingSong_merge);
    $('#importTroffDataToExistingSong_keepExisting').click(
      Troff.importTroffDataToExistingSong_keepExisting
    );

    $('.click-to-select-text').click((event) => {
      (event.target as HTMLInputElement).select();
    });

    $('.loopButt').click(Troff.setLoop);

    $('.jsUploadSongButt').on('click', Troff.uploadSongToServer);

    $('#signOut').on('click', doSignOut);
    $('.googleSignIn').on('click', googleSignIn);

    $('#groupAddOwnerButt').on('click', () => {
      addGroupOwnerRow();
    });
    window.addEventListener('resize', () => {
      if (!markersExist()) {
        return;
      }
      Troff.setAppropriateMarkerDistance();
    });

    Troff.recallGlobalSettings();

    window.addEventListener('online', onOnline);

    if (navigator.onLine) {
      //checking if we are CURRENTLY online
      onOnline();
    }

    if (!document.fullscreenEnabled) {
      $('.onClickToggleFullScreen').addClass('hidden');
    }
  }; //end startFunc

  onClickCopyTextToClipboard = (event: JQuery.ClickEvent) => {
    this.copyTextToClipboard($(event.target).val());
  };

  copyTextToClipboard = async (text: string) => {
    if (!navigator.clipboard) {
      this.fallbackCopyTextToClipboard(text);
      return;
    }

    navigator.clipboard.writeText(text).then(
      () => {
        this.copyToClipboardSuccessful(text);
      },
      () => {
        this.copyToClipboardFailed(text);
      }
    );
  };

  fallbackCopyTextToClipboard = (text: string) => {
    var textArea = document.createElement('textarea');
    textArea.value = text;

    // Avoid scrolling to bottom
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      var successful = document.execCommand('copy');

      if (successful) {
        this.copyToClipboardSuccessful(text);
      } else {
        this.copyToClipboardFailed(text);
      }
    } catch {
      this.copyToClipboardFailed(text);
    }

    document.body.removeChild(textArea);
  };

  copyToClipboardSuccessful = (text: string) => {
    $.notify(`Copied "${text}" to clipboard!`, {
      className: 'success',
      autoHide: true,
      clickToHide: true,
    });
  };

  copyToClipboardFailed = (text: string) => {
    $.notify(`Could not copy "${text}" to clipboard, please copy the text manually`, {
      className: 'error',
      autoHide: false,
      clickToHide: true,
    });
  };

  keyboardKeydown = (event: KeyboardEvent): void => {
    if (event.altKey) {
      event.preventDefault();
    }

    if (typeof this.IOEnterFunction === 'function' && event != null) {
      if (event.keyCode == 9 && event.target != null && $(event.target).hasClass('allow-tab')) {
        $(event.target).addClass('tab-activated');
      }

      if (event.keyCode == 13) {
        this.IOEnterFunction(event);
      }
      if (typeof this.IOArrowFunction === 'function') {
        if ([37, 38, 39, 40].indexOf(event.keyCode) != -1) {
          this.IOArrowFunction(event);
        }
      }
      return;
    }

    if (event.keyCode == 229) {
      // weird thing but ok...
      return;
    }

    //if 0 to 9 or bakspace, del, alt, arrows in a input-field, return,
    //---- site add "numpad"
    if ($(':input[type="number"]').is(':focus')) {
      if (
        (event.keyCode >= 48 && event.keyCode <= 57) || //numbers
        (event.keyCode >= 96 && event.keyCode <= 105) || //numpad
        event.keyCode == 8 || //backspace
        event.keyCode == 18 || //alt
        event.keyCode == 37 || //left arrow
        event.keyCode == 39 || //right arrow
        event.keyCode == 46 //del
      ) {
        return;
      } else if (
        event.keyCode == 13 // Enter
      ) {
        $(':input[type="number"]').blur();
        blurHack();
        return;
      }
    }
    blurHack();

    if (event.keyCode >= 48 && event.keyCode <= 57) {
      // pressed a number
      var number = event.keyCode - 48;
      Troff.setLoopTo(number);
      gtag('event', 'Change loop', {
        event_category: 'Perform change',
        event_label: String(number || '∞'),
      });
    }

    var altTime = 0.08333333333; // one frame
    var regularTime = 0.8333333333; // 10 freames
    var shiftTime = 8.333333333; // 100 frames

    let forceReturn = false;

    $('[data-hot-key]').each((i, element) => {
      const $target = $(element),
        incrementsSelector = $target.data('hot-key-increments'),
        incrementAmount = $target.data('hot-key-increment-amount') || 1;
      if (String.fromCodePoint(event.keyCode) != $target.data('hot-key').toUpperCase()) {
        return;
      }
      if (event.ctrlKey) {
        return;
      }

      if (event.shiftKey || event.altKey) {
        if (incrementsSelector == undefined) {
          return;
        }
        if (event.shiftKey) Troff.incrementInput(incrementsSelector, incrementAmount);
        if (event.altKey) Troff.incrementInput(incrementsSelector, -incrementAmount);
        forceReturn = true;
        return;
      }

      const isTextInput = $target.is('input') && $target.attr('type') == 'text';
      const isTextArea = $target.is('textarea');
      if (isTextInput || isTextArea) {
        forceReturn = true;
        if ($target.is(':hidden')) {
          return;
        }
        setTimeout(() => {
          $target.trigger('click');
          $target.focus();
        }, 42);
      } else {
        forceReturn = true;
        $target.trigger('click');
      }
    });
    if (forceReturn) {
      return;
    }

    switch (event.keyCode) {
      case 32: //space bar
        Troff.space();
        break;
      case 13: // return
        Troff.enterKnappen();
        break;
      case 27: // esc
        Troff.pauseSong();
        Troff.forceNoFullscreen();
        break;
      case 78: // N
        if (event.shiftKey) {
          Troff.selectNext(/*reverse = */ true);
        } else {
          Troff.selectNext(/*reverse = */ false);
        }
        break;
      case 40: // downArrow
        if (event.shiftKey && event.altKey) Troff.moveOneMarkerDown(shiftTime);
        else if (event.shiftKey) Troff.moveOneMarkerDown(regularTime);
        else if (event.altKey) Troff.moveOneMarkerDown(altTime);
        break;
      case 38: // uppArrow ?
        if (event.shiftKey && event.altKey) Troff.moveOneMarkerDown(-shiftTime);
        else if (event.shiftKey) Troff.moveOneMarkerDown(-regularTime);
        else if (event.altKey) Troff.moveOneMarkerDown(-altTime);
        break;
      case 39: // rightArrow
        if (event.shiftKey) ($('audio, video')[0] as any).currentTime += shiftTime;
        else if (event.altKey) ($('audio, video')[0] as any).currentTime += altTime;
        else ($('audio, video')[0] as any).currentTime += regularTime;
        break;
      case 37: // leftArrow
        if (event.shiftKey) ($('audio, video')[0] as any).currentTime -= shiftTime;
        else if (event.altKey) ($('audio, video')[0] as any).currentTime -= altTime;
        else ($('audio, video')[0] as any).currentTime -= regularTime;
        break;
      case 70: // F
        if (event.ctrlKey) {
          event.preventDefault();
          Troff.showSearchAndActivate();
        } else Troff.forceFullscreenChange();
        break;
      case 71: // G
        Troff.goToStartMarker();
        break;
      case 85: // U
        if (event.shiftKey) Troff.unselectStartMarker();
        else if (event.altKey) Troff.unselectStopMarker();
        else Troff.unselectMarkers();
        break;
      case 90: // Z
        if (event.shiftKey) Troff.zoomOut();
        else Troff.zoomToMarker();
        break;
      //default:
      //console.info("key " + event.keyCode);
    } // end switch
  }; // end keyboardKeydown *****************/

  setEnterFunction = (
    func: (event: KeyboardEvent) => any,
    arrowFunc?: (event: KeyboardEvent) => any
  ) => {
    this.IOEnterFunction = func;
    if (arrowFunc !== undefined) this.IOArrowFunction = arrowFunc;
    else this.IOArrowFunction = false;
  };

  clearEnterFunction = () => {
    if ($('.tab-activated').length != 0) {
      $('.tab-activated').removeClass('tab-activated');
      return;
    }

    this.IOEnterFunction = false;
    this.IOArrowFunction = false;
  };

  promptEditMarker = (
    markerId: string | false,
    func: (name: string, info: string, color: string, time: number) => void,
    funcCancle?: () => void
  ) => {
    'use strict';

    var markerName;
    var markerInfo;
    var selectedColorName: string;
    var markerTime;
    var strHeader;

    if (markerId) {
      markerName = $('#' + markerId).val();
      markerInfo = ($('#' + markerId)[0] as any).info;
      selectedColorName = ($('#' + markerId)[0] as any).color || 'None';
      markerTime = Number(($('#' + markerId)[0] as any).timeValue);
      strHeader = 'Edit marker';
    } else {
      markerName = 'marker nr ' + ($('#markerList li').length + 1);
      markerInfo = '';
      selectedColorName = 'None';
      markerTime = ($('audio, video')[0] as any).currentTime;
      strHeader = 'Create new marker';
    }

    var buttOK = $('<input>', {
      type: 'button',
      class: 'regularButton',
      value: 'OK',
    });

    var buttCancel = $('<input>', {
      type: 'button',
      class: 'regularButton',
      value: 'Cancel',
    });

    var buttRemove = $('<input>', {
      type: 'button',
      class: 'regularButton',
      value: 'Remove',
    });

    const setColor = (event: JQuery.ClickEvent) => {
      $('.colorPickerSelected').removeClass('colorPickerSelected');
      event.currentTarget.classList.add('colorPickerSelected');

      selectedColorName = event.currentTarget.dataset.colorName as string;
      $colorText.find('span').html(selectedColorName);
      blurHack();
    };

    const generateColorBut = (col: MarkerColorConfig) => {
      var clas = 'colorPicker markerBackgroundColor';

      if (col.name === selectedColorName) {
        clas += ' colorPickerSelected';
      }
      const colorButt = $('<input>', {
        type: 'button',
        value: '',
        class: clas,
      }).on('click', setColor);

      colorButt[0].style.setProperty('--marker-bg-color', col.color);
      colorButt[0].dataset.colorName = col.name;
      colorButt[0].dataset.colorValue = col.color;
      colorButt[0].dataset.onColorValue = col.onColor;
      return colorButt;
    };

    var row0 = $('<span>', { class: 'oneRow' }).append($('<h2>').append(strHeader));

    const $markerName = $('<input>', {
      type: 'text',
      value: markerName,
      class: 'ml-2',
    });

    var row1 = $('<span>', { class: 'oneRow' })
      .append($('<p>').append('Name:'))
      .append($markerName);

    const $markerTime = $('<input>', {
      type: 'number',
      value: markerTime,
      class: 'w-auto p-2 ml-3 text-left',
    });

    var row2 = $('<span>', { class: 'oneRow' })
      .append($('<p>').append('Time:'))
      .append($markerTime)
      .append($('<p>').append('seconds'));

    const $markerInfo = $('<textarea>', {
      placeholder: 'Put extra marker info here',
      text: markerInfo,
      rows: 6,
      class: 'ml-4 p-2',
    });

    var row3 = $('<span>', { class: 'oneRow' })
      .append($('<p>').append('Info:'))
      .append($markerInfo);

    const $colorText = $('<div>', { class: 'flexCol flex' })
      .append($('<p>').append('Color:'))
      .append($('<span>').append(''));

    const noneColor: MarkerColorConfig = { name: 'None', color: 'transparent', onColor: '' };

    var row4 = $('<span>', { class: 'oneRow' })
      .append($colorText)
      .append($('<div>', { class: 'flexRowWrap' }).append(generateColorBut(noneColor)));

    const colorParent = $('<div>', { class: 'flexCol flex-sm-row' });

    appendColorButtonsTo(colorParent, generateColorBut);

    // let colorRow = $('<div>', { class: 'flexRow flex-sm-col' });
    // let colorCounter = 0;
    // MARKER_COLORS.forEach((col) => {
    //   colorRow.append(generateColorBut(col));
    //   colorCounter++;
    //   if (colorCounter == 5) {
    //     colorParent.append(colorRow);
    //     colorRow = $('<div>', { class: 'flexRow flex-sm-col' });
    //     colorCounter = 0;
    //   }
    // });
    // if (colorCounter > 0) {
    //   colorParent.append(colorRow);
    // }

    row4.append(colorParent);

    var row5: JQuery<HTMLElement> | string = '';
    if (markerId) {
      row5 = $('<span>', { class: 'oneRow' })
        .append($('<p>').append('Remove this marker:'))
        .append(buttRemove);
    }
    var row6 = $('<span>', { class: 'oneRow' }).append(buttOK).append(buttCancel);

    const $outerDialog = $('<div>', { class: 'outerDialog' }).append(
      $('<div>', {
        class: 'innerDialog secondaryColor w-auto mw-100 vScroll mh-100',
      })
        .append(row0)
        .append($('<div>').append(row1).append(row2).append(row3).append(row4).append(row5))
        .append(row6)
    );

    $('body').append($outerDialog);

    this.IOEnterFunction = () => {
      if (func)
        func(
          $markerName.val() as string,
          $markerInfo.val() as string,
          selectedColorName,
          $markerTime.val() as number
        );
      $outerDialog.remove();
      this.IOEnterFunction = false;
    };

    if (typeof this.IOEnterFunction === 'function') {
      buttOK.click(this.IOEnterFunction as any);
    }
    buttCancel.on('click', () => {
      if (funcCancle) funcCancle();
      $outerDialog.remove();
      this.IOEnterFunction = false;
    });

    buttRemove.click(() => {
      var confirmDelete = $('#' + TROFF_SETTING_CONFIRM_DELETE_MARKER).hasClass('active');
      $outerDialog.remove();
      this.IOEnterFunction = false;

      if ($('#markerList li').length <= 2) {
        this.alert(
          'Minimum number of markers',
          'You can not remove this marker at the moment, ' + 'you can not have fewer than 2 markers'
        );
        return;
      }

      if (markerId) {
        if (confirmDelete) {
          this.confirm('Remove marker', 'Are you sure?', () => {
            Troff.removeMarker(markerId);
          });
        } else {
          Troff.removeMarker(markerId);
        }
      }
    });

    var quickTimeOut = setTimeout(() => {
      $markerName.select();
      $colorText.find('span').html(selectedColorName);
      clearInterval(quickTimeOut);
    }, 0);
  }; // end promptEditMarker   *******************/

  promptDouble = (
    oInput: IOInput,
    func?: (strInput: string, strTextarea: string) => void,
    funcCancle?: () => void
  ) => {
    var textHead = oInput.strHead;
    var textBox = oInput.strInput;
    var bDouble = oInput.bDouble;
    var strTextarea = oInput.strTextarea || '';
    var strTextareaPlaceholder = oInput.strTextareaPlaceholder || '';

    var time = Date.now();
    var buttEnterId = 'buttOkId' + time;

    var textId = 'textId' + time;
    var textareaId = 'textareaId' + time;
    var buttCancelId = 'buttCancelId' + time;
    var innerId = 'innerId' + time;
    var outerId = 'outerId' + time;
    var outerDivStyle =
      '' +
      'position: fixed; ' +
      'top: 0px;left: 0px; ' +
      'width: 100vw; ' +
      'height: 100%; ' +
      'background-color: rgba(0, 0, 0, 0.5);' +
      'z-index: 99;' +
      'display: flex;align-items: center;justify-content: center;';
    var innerDivStyle = '' + 'width: 200px;' + 'padding: 10px 15px;';
    var pStyle = '' + 'font-size: 18px;';

    var strTextareaHTML = '';
    if (bDouble) {
      strTextareaHTML =
        "<textarea placeholder='" +
        strTextareaPlaceholder +
        "'" +
        "id='" +
        textareaId +
        "'>" +
        strTextarea +
        '</textarea>';
    }

    $('body').append(
      $(
        "<div id='" +
          outerId +
          "' style='" +
          outerDivStyle +
          "'><div id='" +
          innerId +
          "' style='" +
          innerDivStyle +
          "' class='secondaryColor'><p style='" +
          pStyle +
          "'>" +
          textHead +
          "</p><input type='text' class=\"full-width\" id='" +
          textId +
          "'/> " +
          strTextareaHTML +
          "<input type='button' class='regularButton' id='" +
          buttEnterId +
          "' value='OK'/><input type='button' class='regularButton' id='" +
          buttCancelId +
          "' value='Cancel'/></div></div>"
      )
    );

    $('#' + textId).val(textBox);
    var quickTimeOut = setTimeout(() => {
      $('#' + textId).select();
      clearInterval(quickTimeOut);
    }, 0);

    this.IOEnterFunction = () => {
      if (func) func($('#' + textId).val() as string, $('#' + textareaId).val() as string);
      $('#' + outerId).remove();
      this.IOEnterFunction = false;
    };
    $('#' + buttEnterId).click(this.IOEnterFunction as any);
    $('#' + buttCancelId).click(() => {
      if (funcCancle) funcCancle();
      $('#' + outerId).remove();
      this.IOEnterFunction = false;
    });
  }; // end promptDouble

  prompt = (
    textHead: string,
    textBox: string,
    func?: (strInput: string, strTextarea: string) => void,
    funcCancle?: () => void
  ) => {
    var oFI = {} as IOInput;
    oFI.strHead = textHead;
    oFI.strInput = textBox;
    oFI.bDouble = false;
    oFI.strTextarea = '';
    oFI.strTextareaPlaceholder = '';
    this.promptDouble(oFI, func, funcCancle);
  }; // end prompt

  confirm = (
    textHead: string,
    textBox: string,
    func?: () => void,
    funcCancel?: () => void,
    confirmButtonText?: string,
    declineButtonText?: string
  ) => {
    confirmButtonText = st.defaultFor(confirmButtonText, 'OK');
    declineButtonText = st.defaultFor(declineButtonText, 'Cancel');

    const outerDiv = $('<div>').addClass('outerDialog onTop');
    const innerDiv = $('<div>').addClass('innerDialog m-4');

    const clickCancel = () => {
      if (funcCancel) funcCancel();
      outerDiv.remove();
      this.IOEnterFunction = false;
    };

    this.IOEnterFunction = () => {
      if (func) func();
      outerDiv.remove();
      this.IOEnterFunction = false;
    };

    const buttRow = $('<div>')
      .append(
        $('<input>')
          .addClass('regularButton')
          .attr('type', 'button')
          .attr('value', confirmButtonText)
          .on('click', this.IOEnterFunction as any)
      )
      .append(
        $('<input>')
          .addClass('regularButton')
          .attr('type', 'button')
          .attr('value', declineButtonText)
          .on('click', clickCancel)
      );

    innerDiv
      .append($('<h2>').html(textHead))
      .append($('<p>').addClass('py-2 text-break w-auto').html(textBox))
      .append(buttRow);

    $('body').append(outerDiv.append(innerDiv));
  }; // end confirm

  alert = (textHead: string, textBox?: string, func?: (strInput: string) => void) => {
    var time = Date.now();
    var buttEnterId = 'buttOkId' + time;

    var textId = 'textId' + time;
    var innerId = 'innerId' + time;
    var outerId = 'outerId' + time;

    if (textBox) {
      $('body').append(
        $(
          "<div id='" +
            outerId +
            "' class='outerDialog'>" +
            "<div id='" +
            innerId +
            "' " +
            ' class=\'secondaryColor p-4 w-exact-200\'><h2 class="Big">' +
            textHead +
            "</h2><p class=\"full-width my-3 normalSize\" type='text' id='" +
            textId +
            "'>" +
            textBox +
            "</p> <input type='button' id='" +
            buttEnterId +
            "'class='regularButton' value='OK'/></div></div>"
        )
      );
      $('#' + textId)
        .val(textBox)
        .select();
    } else {
      $('body').append(
        $(
          "<div id='" +
            outerId +
            "' class='outerDialog'>" +
            "<div id='" +
            innerId +
            "' " +
            ' class=\'secondaryColor p-4 w-exact-200\'><p class="normalSize" >' +
            textHead +
            "</p><input type='button' id='" +
            buttEnterId +
            "' class='regularButton' value='OK'/></div></div>"
        )
      );
    }
    this.IOEnterFunction = () => {
      if (func) func($('#' + textId).val() as string);
      $('#' + outerId).remove();
      this.IOEnterFunction = false;
    };
    $('#' + buttEnterId).click(this.IOEnterFunction as any);
  }; // end alert

  loopTimesLeft = (input?: string): string | undefined => {
    if (!input) return $('.loopTimesLeft').eq(0).text();
    if (input == '-1')
      $('.loopTimesLeft').html(String(Number($('.loopTimesLeft').eq(0).text()) - 1));
    else $('.loopTimesLeft').html(input);
  };

  saveOnSongValue = (event: Event) => {
    var $target = $(event.target as HTMLElement),
      id = $target.attr('id'),
      value = $target.val();

    if (id == undefined) {
      log.e('this element is missing "id", can not save!', $target);
      return;
    }

    const key = 'TROFF_VALUE_' + id;
    nDB.setOnSong(Troff.getCurrentSong(), key, value);
    event.target?.dispatchEvent(new Event('savedToDbEvent'));
  };

  saveOnSongToggleClass = (event: JQuery.ClickEvent) => {
    blurHack();

    var $target = $(event.target),
      id = $target.attr('id'),
      classToToggleAndSave = $target.data('save-on-song-toggle-class');

    if (id == undefined) {
      log.e('this element is missing "id", can not save!', $target);
      return;
    }

    if (classToToggleAndSave == undefined) {
      log.e('this element is missing "classToToggleAndSave", can not toggle!', $target);
      return;
    }

    $target.toggleClass(classToToggleAndSave);

    const key = 'TROFF_CLASS_TO_TOGGLE_' + id;
    const value = $target.hasClass(classToToggleAndSave);

    nDB.setOnSong(Troff.getCurrentSong(), key, value);
  };
} // end IOClass

export default IOClass;
