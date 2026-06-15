import { nDB } from '../assets/internal/db.js';
import { MarkerSlider } from '../components/organisms/t-marker-slider.js';
import type { TroffMarker } from '../types/troff.d.js';
import {
  TROFF_SETTING_EXTENDED_MARKER_COLOR,
  TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR,
  TROFF_SETTING_SONG_DEFAULT_START_BEFORE_ON,
  TROFF_SETTING_SONG_DEFAULT_STOP_AFTER_ON,
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

export function getIncrementUntil(songData: Record<string, unknown> | null | undefined): number {
  const incrementUntilValue = songData?.TROFF_VALUE_incrementUntilValue;
  if (incrementUntilValue !== undefined) {
    return Number(incrementUntilValue);
  }
  const defaultSavedValue = nDB.get(
    'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_INCREMENT_UNTIL_VALUE'
  );
  return Number(defaultSavedValue) || 100;
}

/**
 * Check whether startBefore is disabled for a given song.
 * Returns `true` when the dial is toggled off (disabled), so the region should NOT extend.
 */
function isStartBeforeDisabled(songData: any): boolean {
  if (songData?.TROFF_CLASS_TO_TOGGLE_buttStartBefore === undefined) {
    const globalOn = nDB.get(TROFF_SETTING_SONG_DEFAULT_START_BEFORE_ON) ?? false;
    return !globalOn;
  }
  return songData.TROFF_CLASS_TO_TOGGLE_buttStartBefore === false;
}

/**
 * Check whether stopAfter is disabled for a given song.
 */
function isStopAfterDisabled(songData: any): boolean {
  if (songData?.TROFF_CLASS_TO_TOGGLE_buttStopAfter === undefined) {
    const globalOn = nDB.get(TROFF_SETTING_SONG_DEFAULT_STOP_AFTER_ON) ?? false;
    return !globalOn;
  }
  return songData.TROFF_CLASS_TO_TOGGLE_buttStopAfter === false;
}

export function configureMarkerSlider(markerSlider: MarkerSlider, songData: any) {
  markerSlider.startMarkerId = songData?.currentStartMarker || '';
  markerSlider.stopMarkerId = songData?.currentStopMarker || '';
  markerSlider.startBefore = isStartBeforeDisabled(songData) ? 0 : getStartBefore(songData);
  markerSlider.stopAfter = isStopAfterDisabled(songData) ? 0 : getStopAfter(songData);

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

/**
 * Create default Start/End markers on a song if it has no markers and song duration > 0.
 * Modifies songData.markers in place.
 * @returns The markers array (either existing or newly created defaults).
 */
export function ensureDefaultMarkers(
  songData: Record<string, unknown> | null | undefined,
  songDuration: number
): TroffMarker[] {
  if (!songData || songDuration <= 0) {
    return [];
  }
  const markers = Array.isArray(songData.markers) ? (songData.markers as TroffMarker[]) : [];
  if (markers.length > 0) {
    return markers;
  }

  const defaultMarkers: TroffMarker[] = [
    { name: 'Start', time: 0, info: '', color: 'None', id: 'markerNr0' },
    { name: 'End', time: songDuration, info: '', color: 'None', id: 'markerNr1' },
  ];
  songData.markers = defaultMarkers;
  return defaultMarkers;
}
