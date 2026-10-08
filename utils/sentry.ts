import log from './log.js';
import type { PlaybackErrorContext } from './playback-resilience.js';

interface SentryExceptionValue {
  type?: string;
  value?: string;
}

interface SentryEvent {
  exception?: {
    values?: SentryExceptionValue[];
  };
}

interface SentryInitOptions {
  dsn: string;
  environment: string;
  release: string;
  sendDefaultPii: boolean;
  tags: { app: 'v1' | 'v2' };
  beforeSend: (event: SentryEvent) => SentryEvent | null;
}

declare global {
  const Sentry: {
    init: (options: SentryInitOptions) => void;
    captureException: (error: Error) => void;
    // Add other methods if needed, e.g., captureException, etc.
  };
}

function isBenignPlayAbort(event: SentryEvent): boolean {
  const values = event.exception?.values ?? [];
  return values.some((entry) => {
    const type = entry.type ?? '';
    const value = entry.value ?? '';
    return (
      type === 'AbortError' ||
      value.includes('The operation was aborted') ||
      value.includes('play() request was interrupted') ||
      value.includes('interrupted by a call to pause')
    );
  });
}

let version = '0';
let environment = 'dev';
let generation: 'v1' | 'v2' = 'v1';

document.addEventListener('cookieConsentGiven', () => {
  // After user accepts, load and enable Sentry
  addAndStartSentry();
});

export function SentryCaptureException(error: Error, context?: PlaybackErrorContext) {
  if (typeof Sentry !== 'undefined') {
    if (context !== undefined) {
      (error as Error & { errorContext?: PlaybackErrorContext }).errorContext = context;
    }
    Sentry.captureException(error);
  }
}

export function setSentryVersion(v: string) {
  version = v;
}

export function setSentryEnvironment(env: string) {
  environment = env;
}

export function setSentryApp(app: 'v1' | 'v2') {
  generation = app;
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
      tags: { app: generation },
      beforeSend(event: SentryEvent) {
        // play() interrupted by pause()/load() rejects with AbortError
        // (DOMException code 20). Benign browser noise, not a real bug.
        if (isBenignPlayAbort(event)) {
          return null;
        }
        return event;
      },
    });
  }

  initSentry();
}
