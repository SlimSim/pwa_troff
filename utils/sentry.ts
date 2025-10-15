import log from './log.js';

declare global {
  const Sentry: {
    init: (options: any) => void;
    // Add other methods if needed, e.g., captureException, etc.
  };
}

let version = '0';
let environment = 'dev';

document.addEventListener('cookieConsentGiven', () => {
  // After user accepts, load and enable Sentry
  addAndStartSentry();
});

export function setSentryVersion(v: string) {
  version = v;
}

export function setSentryEnvironment(env: string) {
  environment = env;
}

export function addAndStartSentry() {
  const script = document.createElement('script');
  script.src = 'https://js-de.sentry-cdn.com/44b623ba6268a114c45ccffad2af8c3b.min.js';
  script.crossOrigin = 'anonymous';
  script.onerror = function () {
    log.w('Failed to load Sentry script');
  };
  document.head.appendChild(script);
  checkSentry();
}

function checkSentry() {
  if (typeof Sentry === 'undefined') {
    setTimeout(checkSentry, 100);
    return;
  }

  function initSentry() {
    Sentry.init({
      dsn: 'https://44b623ba6268a114c45ccffad2af8c3b@o4510182185631744.ingest.de.sentry.io/4510182202277968',
      environment: environment,
      release: 'pwa_troff@' + version,
      sendDefaultPii: false,
      beforeSend(event: any) {
        return event;
      },
    });
  }

  initSentry();
}
