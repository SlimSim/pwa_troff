import { blurHack } from '../../utils/utils.js';
import { nDB } from './db.js';

export interface StandardFuntions {
  confirm: (
    textHead: string,
    textBox: string,
    funcOk?: () => void,
    funcCancel?: () => void
  ) => void;
  secToDisp: (seconds: number) => string;
  millisToDisp: (millis: number) => string;
  byteToDisp: (byte: number | null) => string;
  defaultFor: <T>(arg: T | undefined, val: T) => T;
}

const st = {} as StandardFuntions;

$(document).ready(function () {
  st.confirm = function (textHead, textBox, funcOk?, funcCancel?) {
    const outerDiv = $('<div>').addClass('outerDialog onTop');
    const innerDiv = $('<div>').addClass('innerDialog m-4');

    const clickOk = function () {
      if (funcOk) funcOk();
      document.removeEventListener('keydown', onKeyDown);
      outerDiv.remove();
    };

    const clickCancel = function () {
      if (funcCancel) funcCancel();
      document.removeEventListener('keydown', onKeyDown);
      outerDiv.remove();
    };

    const buttRow = $('<div>')
      .append(
        $('<input>')
          .addClass('regularButton')
          .attr('type', 'button')
          .attr('value', 'OK')
          .on('click', clickOk)
      )
      .append(
        $('<input>')
          .addClass('regularButton')
          .attr('type', 'button')
          .attr('value', 'Cancel')
          .on('click', clickCancel)
      );

    innerDiv
      .append($('<h2>').html(textHead))
      .append($('<p>').addClass('py-2 text-break w-auto').html(textBox))
      .append(buttRow);

    document.addEventListener('keydown', onKeyDown);

    function onKeyDown(event: KeyboardEvent) {
      event.preventDefault();
      if (event.key === 'Enter') {
        clickOk();
      }
      if (event.key === 'Escape') {
        clickCancel();
      }
    }

    $('body').append(outerDiv.append(innerDiv));
  }; // end confirm

  st.secToDisp = function (seconds) {
    var sec: number | string = (seconds | 0) % 60;
    if (sec < 10) sec = '0' + sec;
    var min: number | string = (seconds / 60) | 0;
    return min + ':' + sec;
  };

  st.millisToDisp = function (millis) {
    if (!millis || millis < 162431283500) {
      return '';
    }

    const date = new Date(millis);

    const d = date.getDate();
    const m = date.getMonth() + 1;

    const dd = d < 10 ? '0' + d : d;
    const mm = m < 10 ? '0' + m : m;
    const year = '' + date.getFullYear();

    return year + '-' + mm + '-' + dd;
  };

  st.byteToDisp = function (byte) {
    if (byte == null) {
      return '';
    }
    var nrTimes = 0;
    const units = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    while (byte >= 1000) {
      nrTimes++;
      byte = byte / 1000;
      if (nrTimes > units.length) return String(byte);
    }

    // Ensure string result
    return String(Math.round(byte * 10) / 10) + units[nrTimes];
  };

  st.defaultFor = function <T>(arg: T | undefined, val: T): T {
    return typeof arg !== 'undefined' ? arg : val;
  };

  var /** @param {any} event */
    dataSaveValue = function (event: JQuery.TriggeredEvent): void {
      blurHack();
      var $target = $(event.target),
        id = $target.attr('id'),
        value = $target.val();

      if (id == null) {
        console.error('This element is missing "id", can not save!', $target);
        return;
      }

      const key = 'TROFF_SAVE_VALUE_' + /** @type {string} */ id;

      nDB.set(key, value);
    };

  /**
   * Hide and Save
   * functionality for letting a button hide another div or such
   * also functionality for saving that value in the DB :)
   */

  /** @param {any} event */
  $('[data-st-css-selector-to-toggle]').on('click', function (/** @type {Event} */ event) {
    const $target = $(event.target).closest('[data-st-css-selector-to-toggle]');
    $($target.data('st-css-selector-to-toggle')).toggleClass('hidden');
  });

  /** @param {any} event */
  $('[data-st-css-selector-to-fade-in]').on('click', function (/** @type {Event} */ event) {
    const $target = $(event.target).closest('[data-st-css-selector-to-fade-in]');

    $($target.data('st-css-selector-to-fade-in')).toggleClass('fadeIn');
  });

  $('[data-st-save-current-value]').change(dataSaveValue);

  /** @param {number} i @param {HTMLElement} element */
  $('[data-st-save-current-value]').each(
    function (/** @type {number} */ i, /** @type {HTMLElement} */ element) {
      var $target = $(element),
        key = 'TROFF_SAVE_VALUE_' + $target.attr('id');

      const value = nDB.get(key) || $target.data('st-save-current-value');

      $target.val(value);
    }
  );

  /** @param {number} i @param {HTMLElement} v */
  $('.st-simple-on-off-button').each(
    function (/** @type {number} */ i, /** @type {HTMLElement} */ v) {
      var $v = $(v),
        cssSelectorToHide = $v.data('st-css-selector-to-hide');
      if ($v.data('st-save-value-key')) {
        var key = $v.data('st-save-value-key');
        const savedValue = nDB.get(key); //, function (savedValue) {
        //var savedValue = item[ key ];

        if (savedValue === undefined || savedValue === null) {
          if ($v.hasClass('active')) {
            $(cssSelectorToHide).removeClass('hidden');
          } else {
            $(cssSelectorToHide).addClass('hidden');
          }
        } else if (savedValue) {
          $v.addClass('active');
          $(cssSelectorToHide).removeClass('hidden');
        } else {
          $v.removeClass('active');
          $(cssSelectorToHide).addClass('hidden');
        }
      } else {
        if ($v.hasClass('active')) {
          $(cssSelectorToHide).removeClass('hidden');
        } else {
          $(cssSelectorToHide).addClass('hidden');
        }
      }
    }
  );

  /** @param {any} event */
  $('.st-simple-on-off-button').click(function (/** @type {Event} */ event) {
    var $target = $(event.target).closest('.st-simple-on-off-button'),
      cssSelectorToHide = $target.data('st-css-selector-to-hide'),
      selectKey = $target.data('st-select-key'),
      setActive = !$target.hasClass('active');

    if (selectKey) {
      $('[data-st-select-key=' + selectKey + ']').each(
        (/** @type {number} */ i, /** @type {HTMLElement} */ v) => {
          $(v).removeClass('active');
          nDB.set($(v).data('st-save-value-key'), false);
        }
      );
    }

    if (setActive) {
      $target.addClass('active');
    } else {
      $target.removeClass('active');
    }

    if (cssSelectorToHide) {
      if (setActive) {
        $(cssSelectorToHide).removeClass('hidden');
      } else {
        $(cssSelectorToHide).addClass('hidden');
      }
    }
    if ($target.data('st-save-value-key')) {
      //		var o = {};
      //		o[ $target.data( "st-save-value-key" ) ] = setActive;
      nDB.set($target.data('st-save-value-key'), setActive);
    }
  });

  /* Hide and Save end */

  /** @param {any} e */
  $('.toggleNext').on('click', (/** @type {Event} */ e) => {
    $(e.target).closest('.toggleNext').toggleClass('showNext');
  });
}); // end document ready

export { st };
