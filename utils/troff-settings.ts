import { nDB } from '../assets/internal/db.js';
import { MarkerSlider } from '../components/organisms/t-marker-slider.js';
import {
  TROFF_SETTING_EXTENDED_MARKER_COLOR,
  TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR,
} from '../constants/constants.js';

export function getStartBefore(songData: any): number {
  const startBeforeValue = songData?.TROFF_VALUE_startBefore;
  if (startBeforeValue !== undefined) {
    return Number(startBeforeValue);
  }
  const defaultSavedValue = nDB.get(
    'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_START_BEFORE_VALUE'
  );
  return Number(defaultSavedValue) || 4;
}

export function getStopAfter(songData: any): number {
  const stopAfterValue = songData?.TROFF_VALUE_stopAfter;
  if (stopAfterValue !== undefined) {
    return Number(stopAfterValue);
  }
  const defaultSavedValue = nDB.get('TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_STOP_AFTER_VALUE');
  return Number(defaultSavedValue) || 2;
}

export function configureMarkerSlider(markerSlider: MarkerSlider, songData: any) {
  markerSlider.startMarkerId = songData?.currentStartMarker || '';
  markerSlider.stopMarkerId = songData?.currentStopMarker || '';
  markerSlider.startBefore = getStartBefore(songData);
  markerSlider.stopAfter = getStopAfter(songData);

  const isExtraExtended = nDB.get(TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR) === true;
  const isExtended = nDB.get(TROFF_SETTING_EXTENDED_MARKER_COLOR) === true;

  if (isExtraExtended) {
    markerSlider.fillColor = 'through';
  } else if (isExtended) {
    markerSlider.fillColor = 'marker';
  } else {
    markerSlider.fillColor = '';
  }
}
