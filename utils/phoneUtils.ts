import { nDB } from '../assets/internal/db.js';

export function isPhoneWidth(): boolean {
  return window.innerWidth < 576;
}

export function optimizeMobile() {
  const screenWidth = window.innerWidth;
  if (screenWidth < 576) {
    const valueInDB = nDB.get('TROFF_SETTING_SONG_LIST_DOCKED_EXIT_ON_SELECT');
    if (valueInDB == null) {
      $('#TROFF_SETTING_SONG_LIST_DOCKED_EXIT_ON_SELECT').addClass('active');
    }
  }
}
