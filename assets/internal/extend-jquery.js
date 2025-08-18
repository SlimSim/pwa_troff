// @ts-check
(function () {
  /**
   * A scroll handler invoked by jQuery for these special events.
   * `this` is the scrolled element and `evt.type` is mutated to signal start/stop.
   * @callback ScrollHandler
   * @this {Element}
   * @param {Event & { type: string }} evt
   * @returns {void}
   */
  
  // from https://j11y.io/javascript/special-scroll-events-for-jquery/
  var special = jQuery.event.special,
    uid1 = 'D' + +new Date(),
    uid2 = 'D' + (+new Date() + 1);

  special.scrollStart = {
    setup: function () {
      /** @type {ReturnType<typeof setTimeout> | null} */
      var timer,
        /** @type {ScrollHandler} */
        handler = function (evt) {
          var _self = this,
            _args = arguments;

          if (timer) {
            clearTimeout(timer);
          } else {
            evt.type = 'scrollStart';
            jQuery.event.dispatch.apply(_self, _args);
          }

          timer = setTimeout(function () {
            timer = null;
          }, special.scrollStop.latency);
        };

      jQuery(this).bind('scroll', handler).data(uid1, handler);
    },
    teardown: function () {
      jQuery(this).unbind('scroll', jQuery(this).data(uid1));
    },
  };

  special.scrollStop = {
    latency: 42,
    setup: function () {
      /** @type {ReturnType<typeof setTimeout> | null} */
      var timer,
        /** @type {ScrollHandler} */
        handler = function (evt) {
          var _self = this,
            _args = arguments;

          if (timer) {
            clearTimeout(timer);
          }

          timer = setTimeout(function () {
            timer = null;
            evt.type = 'scrollStop';
            jQuery.event.dispatch.apply(_self, _args);
          }, special.scrollStop.latency);
        };

      jQuery(this).bind('scroll', handler).data(uid2, handler);
    },
    teardown: function () {
      jQuery(this).unbind('scroll', jQuery(this).data(uid2));
    },
  };
})();
