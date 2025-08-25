import log from './utils/log.js';
import { nDB } from './assets/internal/db.js';

if ('serviceWorker' in navigator) {
  const serviceWorkerPath = './service-worker.js';
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(serviceWorkerPath).catch((error) => {
      log.e('service-worker.js failed to register:', error);
    });
  });
} else {
  log.e('No "serviceWorker" in navigator');
}

var PWA = {};

PWA.listenForInstallPrompt = () => {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Prevents prompt display

    if ($('#pwaAddToHomeScreen').length === 0) {
      log.e('No #pwaAddToHomeScreen detected, can not show add-prompt!');
      if (confirm('Do you want to install this app?')) {
        PWA.showPrompt(e);
      }
    }

    $('#pwaAddToHomeScreen').removeClass('hidden');
    $('#pwaAddToHomeScreen').on('click', () => {
      PWA.showPrompt(e);
    });
    // The event was re-dispatched in response to our request
    // ...
  });
};

PWA.listenForBroadcastChannel = () => {
  if (typeof BroadcastChannel === 'undefined') {
    return;
  }

  const channel = new BroadcastChannel('service-worker-broadcastChanel');
  channel.addEventListener('message', (event) => {
    if (event.data === 'install') {
      const millisSinceFirstLoad = new Date().getTime() - nDB.get('millisFirstTimeStartingApp');

      if (millisSinceFirstLoad < 5000) {
        $.notify('Troff is now cached and will work offline.\nHave fun!', 'success');
        return;
      }

      $.notify(
        {
          title: $('<span class="d-flex flex-column">')
            .append($('<h2>').text('New version'))
            .append(
              $('<p>')
                .attr('class', 'small text-left')
                .text(
                  'A new version of Troff is available! Please reload to start using the new version!'
                )
            )
            .append(
              $('<span class="d-flex flex-row justify-content-between align-items-center">').append(
                $('<button>')
                  .text('RELOAD')
                  .on('click', () => {
                    $(this).trigger('notify-hide');
                    window.location.reload();
                    return false;
                  })
              )
            ),
        },
        {
          style: 'html-info',
          autoHide: false,
          clickToHide: false,
        }
      );
    }
  });
};

PWA.showPrompt = (e) => {
  e.prompt(); // Throws if called more than once or default not prevented

  e.userChoice.then(
    (choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        $('#pwaAddToHomeScreen').addClass('hidden');
        $.notify('Thank you for installing Troff.\nHave fun!', 'success');
      }
    },
    (err) => {
      log.e('err', err);
    }
  );
};

PWA.listenForInstallPrompt(); // should it be in document ready? i cant se why it should be there...
PWA.listenForBroadcastChannel();
