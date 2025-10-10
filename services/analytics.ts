import { GoogleTagArgs } from 'types/analytics.js';

import { analytics, logEvent } from './firebaseClient.js';
import log from '../utils/log.js';

function gtag(type: string, identifier: string, args: GoogleTagArgs): void {
  log.d('gtag -> arguments:', arguments);

  if (!analytics) {
    log.w('Analytics not available:', type, identifier, args);
    return;
  }

  try {
    // Map gtag calls to Firebase Analytics
    if (type === 'event') {
      // identifier is the event name
      logEvent(analytics, identifier, args);
    } else if (type === 'config') {
      // For 'config' calls, you might not need to do anything
      // as Firebase auto-configures, but you could log if needed
      log.i('Analytics config:', identifier, args);
    }
  } catch (error) {
    console.error('Analytics error:', error);
  }
}

export { gtag };
