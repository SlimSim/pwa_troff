// @ts-check

/**
 * Minimal localStorage-backed DB used for cookie consent state.
 * @typedef {Object} CookieConsentDB
 * @property {(key: string, value: any) => void} set
 * @property {(key: string) => any} get
 */
$(document).ready(function () {
  var COOKIE_CONSENT_ACCEPTED = 'TROFF_COOKIE_CONSENT_ACCEPTED';

  /** @type {CookieConsentDB} */
  const cookie_consent_DB = {
    set: function (key, value) {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    get: function (key) {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.warn('cookie_consent_DB.get: Failed to parse JSON for key', key, e);
        return null;
      }
    },
  };

  /**
   * Render and show the cookie consent banner using notify.js
   * @returns {void}
   */
  function showCookieConsent() {
    $.notify(
      {
        title: $('<span class="d-flex flex-column">')
          .append($('<h2>').text('Cookie consent'))
          .append(
            $('<p>')
              .attr('class', 'small text-left')
              .text(
                'Cookies help us deliver our Services. By using our website or clicking "I consent", you consent to our privacy policy and our use of cookies'
              )
          )
          .append(
            $('<span class="d-flex flex-row justify-content-between align-items-center">')
              .append(
                $('<button>')
                  .text('I consent')
                  .on(
                    'click',
                    /** @this {HTMLElement} */ function () {
                      $(this).trigger('notify-hide');
                      cookie_consent_DB.set(COOKIE_CONSENT_ACCEPTED, true);
                    }
                  )
              )
              .append(
                $('<a>')
                  .text('Full privacy policy')
                  .attr('class', 'small')
                  .attr({ href: 'privacy_policy.html', target: '_blank', rel: 'noopener' })
              )
          ),
      },
      /** @type {{style: string, autoHide: boolean, clickToHide: boolean}} */ ({
        style: 'html-info',
        autoHide: false,
        clickToHide: false,
      })
    );
  } // end showCookieConsent();

  /**
   * Check persisted state and show the cookie consent banner when needed.
   * Retries on transient storage errors.
   * @returns {void}
   */
  function checkToShowCookieConsent() {
    try {
      var cookieConsentAccepted = cookie_consent_DB.get(COOKIE_CONSENT_ACCEPTED); //, cookieConsentAccepted => {
      if (cookieConsentAccepted === true) {
        return;
      }
      showCookieConsent();
      //			});
    } catch (e) {
      console.info('cc / checkToShowCookieConsent: in catch, e:', e);
      setTimeout(function () {
        checkToShowCookieConsent();
      }, 10);
    }
  }

  checkToShowCookieConsent();
});
