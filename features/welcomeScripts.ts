import { nDB } from '../assets/internal/db.js';
import { isSafari } from '../utils/browserEnv.js';

export function welcomeStartFunc() {
  v1_9Dialog();
}

function v1_9Dialog() {
  if (!isSafari) {
    return;
  }
  const hasShownSafariV_1_9Welcome = nDB.get('TROFF_HAS_SHOWN_SAFARI_V_1_9_WELCOME');
  if (hasShownSafariV_1_9Welcome) {
    return;
  }
  $('#firstTimeIosV_1_9Dialog').removeClass('hidden');
  nDB.set('TROFF_HAS_SHOWN_SAFARI_V_1_9_WELCOME', true);
}
