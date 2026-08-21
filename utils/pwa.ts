/**
 * PWA install/update helper for Troff — jQuery-free replacement for the legacy
 * `pwa.ts` module. Tracks the installability state of the app and exposes a
 * small subscription API so UI (e.g. the settings panel) can react to changes.
 */

import log from './log.js';

export type PwaInstallState = 'unavailable' | 'available' | 'installed';

/** The non-standard beforeinstallprompt event delivered by Chromium browsers. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installState: PwaInstallState = 'unavailable';
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let initialized = false;
const listeners = new Set<(state: PwaInstallState) => void>();

function setInstallState(state: PwaInstallState): void {
  if (state === installState) return;
  installState = state;
  listeners.forEach((listener) => listener(state));
}

export function getInstallState(): PwaInstallState {
  return installState;
}

export function subscribeToInstallState(
  listener: (state: PwaInstallState) => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function promptInstall(): void {
  if (!deferredPrompt) return;
  const prompt = deferredPrompt;
  deferredPrompt = null;
  prompt.prompt();
  prompt.userChoice
    .then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        setInstallState('installed');
      } else {
        setInstallState('unavailable');
      }
    })
    .catch(() => {
      // The prompt result could not be read; drop back to 'unavailable'.
      setInstallState('unavailable');
    });
}

export function initPwa(options?: {
  onNewVersionAvailable?: () => void;
  onFirstInstall?: () => void;
}): void {
  if (initialized) return;
  initialized = true;

  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    setInstallState('available');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    setInstallState('installed');
  });

  if (
    !('serviceWorker' in navigator) ||
    typeof navigator.serviceWorker.register !== 'function'
  ) {
    log.e('PWA: navigator.serviceWorker is not available, skipping registration');
    return;
  }

  window.addEventListener(
    'load',
    () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          registration.addEventListener('updatefound', () => {
            // Defer reading registration.installing to the next tick: the spec
            // can fire updatefound before the installing worker is populated,
            // and the worker can only reach 'installed' asynchronously anyway.
            Promise.resolve().then(() => {
              const installingWorker = registration.installing;
              if (!installingWorker) return;
              installingWorker.addEventListener('statechange', () => {
                if (installingWorker.state !== 'installed') return;
                if (navigator.serviceWorker.controller) {
                  options?.onNewVersionAvailable?.();
                } else {
                  options?.onFirstInstall?.();
                }
              });
            });
          });
        })
        .catch((error) => {
          log.e('service-worker.js failed to register:', error);
        });
    },
    { once: true }
  );
}
