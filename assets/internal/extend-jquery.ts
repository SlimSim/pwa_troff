(function () {
  /**
   * A scroll handler invoked by jQuery for these special events.
   * `this` is the scrolled element and `evt.type` is mutated to signal start/stop.
   */

  // from https://j11y.io/javascript/special-scroll-events-for-jquery/
  var special = jQuery.event.special,
    uid1 = 'D' + +new Date(),
    uid2 = 'D' + (+new Date() + 1);

  special.scrollStart = {
    setup: function () {
      var timer: null | number,
        handler = function (this: EventTarget, event: JQuery.Event) {
          var _self = this,
            _args = arguments;

          if (timer) {
            clearTimeout(timer);
          } else {
            event.type = 'scrollStart';
            (jQuery.event as any).dispatch.apply(_self, _args);
          }

          timer = setTimeout(
            function () {
              timer = null;
            },
            (special.scrollStop as any).latency
          );
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
      var timer: null | number,
        handler = function (this: EventTarget, event: JQuery.Event) {
          var _self = this,
            _args = arguments;

          if (timer) {
            clearTimeout(timer);
          }

          timer = setTimeout(
            function () {
              timer = null;
              event.type = 'scrollStop';
              (jQuery.event as any).dispatch.apply(_self, _args);
            },
            (special.scrollStop as any).latency
          );
        };

      jQuery(this).bind('scroll', handler).data(uid2, handler);
    },
    teardown: function () {
      jQuery(this).unbind('scroll', jQuery(this).data(uid2));
    },
  };
})();
