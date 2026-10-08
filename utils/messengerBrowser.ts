import { isMessengerInAppBrowser } from './browserEnv.js';
import { showToast } from './notification.js';

export function maybeShowMessengerBrowserNotice(): void {
  if (!isMessengerInAppBrowser()) {
    return;
  }
  showToast(
    'You are using the Messenger in-app browser.\nFor the best experience, open Troff in your regular browser!',
    'error',
    0,
    {
      label: 'Copy link',
      onClick: () => {
        const url = window.location.href;
        if ('clipboard' in navigator && navigator.clipboard) {
          void navigator.clipboard.writeText(url).catch(() => undefined);
        }
      },
    }
  );
}
