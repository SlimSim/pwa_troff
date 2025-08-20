// @ts-check

/**
 * @typedef {Object} StApi
 * @property {(textHead: string, textBox: string, funcOk?: () => void, funcCancel?: () => void) => void} confirm
 * @property {(seconds: number) => string} secToDisp
 * @property {(millis: number) => string} millisToDisp
 * @property {(byte: number | null | undefined) => string} byteToDisp
 * @property {<T>(arg: T | undefined, val: T) => T} defaultFor
 */

/** @type {Partial<StApi> & Record<string, any>} */
const st = {};

$(document).ready(function () {
  /**
   * Show a simple confirm dialog with OK/Cancel callbacks.
   * @param {string} textHead
   * @param {string} textBox
   * @param {() => void} [funcOk]
   * @param {() => void} [funcCancel]
   */
  st.confirm = function (textHead, textBox, funcOk, funcCancel) {
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

    /** @param {KeyboardEvent} event */
    function onKeyDown(event) {
      event.preventDefault();
      if (event.keyCode === 13) {
        clickOk();
      }
      if (event.keyCode === 27) {
        clickCancel();
      }
    }

    $('body').append(outerDiv.append(innerDiv));
  }; // end confirm

  /** @param {number} seconds */
  st.secToDisp = function (seconds) {
    /** @type {number | string} */
    var sec = (seconds | 0) % 60;
    if (sec < 10) sec = '0' + sec;
    var min = (seconds / 60) | 0;
    return min + ':' + sec;
  };

  /** @param {number} millis */
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

  /** @param {number | null | undefined} byte */
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

  /** @template T @param {T | undefined} arg @param {T} val @returns {T} */
  st.defaultFor = function (arg, val) {
    return typeof arg !== 'undefined' ? arg : val;
  };

  var ST_DB = {
      // new data base
      /** @param {string} key @param {any} value */
      set: function (key, value) {
        window.localStorage.setItem(key, JSON.stringify(value));
      },
      /** @param {string} key @returns {any} */
      get: function (key) {
        const raw = window.localStorage.getItem(key);
        return raw == null ? null : JSON.parse(raw);
      },
    },
    ST_DBc = {
      //new data base callback
      /** @param {string} key @param {(v:any)=>void} callback */
      get: function (key, callback) {
        callback(ST_DB.get(key));
      },
    },
    /** @returns {void} */
    blurHack = function () {
      const el = document.getElementById('blur-hack');
      if (el) el.focus({ preventScroll: true });
    },
    /** @param {any} event */
    dataSaveValue = function (/** @type {Event} */ event) {
      blurHack();
      var $target = $(event.target),
        id = $target.attr('id'),
        value = $target.val();

      if (id == null) {
        console.error('This element is missing "id", can not save!', $target);
        return;
      }

      const key = 'TROFF_SAVE_VALUE_' + /** @type {string} */ (id);

      ST_DB.set(key, value);
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
  $('[data-st-save-current-value]').each(function (
    /** @type {number} */ i,
    /** @type {HTMLElement} */ element
  ) {
    var $target = $(element),
      key = 'TROFF_SAVE_VALUE_' + $target.attr('id');

    ST_DBc.get(key, function (value) {
      //var value = ret[key];

      if (value === undefined || value === null) {
        value = $target.data('st-save-current-value');
      }

      $target.val(value);
    });
  });

  /** @param {number} i @param {HTMLElement} v */
  $('.st-simple-on-off-button').each(function (
    /** @type {number} */ i,
    /** @type {HTMLElement} */ v
  ) {
    var $v = $(v),
      cssSelectorToHide = $v.data('st-css-selector-to-hide');
    if ($v.data('st-save-value-key')) {
      var key = $v.data('st-save-value-key');
      ST_DBc.get(key, function (savedValue) {
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
      });
    } else {
      if ($v.hasClass('active')) {
        $(cssSelectorToHide).removeClass('hidden');
      } else {
        $(cssSelectorToHide).addClass('hidden');
      }
    }
  });

  /** @param {any} event */
  $('.st-simple-on-off-button').click(function (/** @type {Event} */ event) {
    var $target = $(event.target).closest('.st-simple-on-off-button'),
      cssSelectorToHide = $target.data('st-css-selector-to-hide'),
      selectKey = $target.data('st-select-key'),
      setActive = !$target.hasClass('active');

    if (selectKey) {
      $('[data-st-select-key=' + selectKey + ']').each((
        /** @type {number} */ i,
        /** @type {HTMLElement} */ v
      ) => {
        $(v).removeClass('active');
        ST_DB.set($(v).data('st-save-value-key'), false);
      });
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
      ST_DB.set($target.data('st-save-value-key'), setActive);
    }
  });

  /* Hide and Save end */

  /** @param {any} e */
  $('.toggleNext').on('click', (/** @type {Event} */ e) => {
    $(e.target).closest('.toggleNext').toggleClass('showNext');
  });
}); // end document ready

export { st };
