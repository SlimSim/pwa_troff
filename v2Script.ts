import './components/atom/t-butt.js';
import './components/atom/t-icon.js';
import './components/molecule/t-footer.js';
import './components/molecule/t-settings-panel.js';
import './components/molecule/t-header.js';
import './components/molecule/t-media-parent.js';
import './components/molecule/t-main-layout.js';
import './components/organisms/t-marker-slider.js';
import {
  updateHeaderWithCurrentSong,
  setCurrentSong,
  getCurrentSongMetadata,
  getCurrentSongKey,
  updateFooterWithCurrentSong,
} from './utils/current-song.js';
import { nDB } from './assets/internal/db.js';
import { audio, loadSong } from './services/audio.js';
import { formatDuration } from './utils/formatters.js';
import { MarkerSlider } from './components/organisms/t-marker-slider.js';
import {
  configureMarkerSlider,
  getStartBefore,
  getStopAfter,
  getIncrementUntil,
  ensureDefaultMarkers,
} from './utils/troff-settings.js';
import type { TroffMarker } from './types/troff.d.js';
import {
  TROFF_SETTING_ENTER_RESET_COUNTER,
  TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR,
  TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER,
  TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR,
  TROFF_SETTING_SPACE_RESET_COUNTER,
  TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR,
  TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_START_BEFORE_VALUE,
  TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_STOP_AFTER_VALUE,
  TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_PAUSE_BEFORE_VALUE,
  TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_WAIT_BETWEEN_VALUE,
  TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_SPEED_VALUE,
  TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_VOLUME_VALUE,
  TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_NR_LOOPS_VALUE,
  TROFF_SETTING_SONG_DEFAULT_START_BEFORE_ON,
  TROFF_SETTING_SONG_DEFAULT_STOP_AFTER_ON,
  TROFF_SETTING_SONG_DEFAULT_PAUSE_BEFORE_ON,
  TROFF_SETTING_SONG_DEFAULT_WAIT_BETWEEN_ON,
  TROFF_SETTING_SONG_DEFAULT_INCREMENT_UNTIL_ON,
  TROFF_SETTING_SONG_DEFAULT_NR_LOOPS_INFINIT_IS_ON,
  TROFF_SETTING_EXTENDED_MARKER_COLOR,
  TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR,
} from './constants/constants.js';

type FooterElement = HTMLElement & {
  settingsPanelVisible?: boolean;
  speed?: number;
  volume?: number;
  pauseBefore?: number;
  waitBetween?: number;
  disablePauseBefore?: boolean;
  disableWaitBetween?: boolean;
  isStartingPlayback?: boolean;
  playbackCountdown?: number;
  markerName?: string;
  isPlaying?: boolean;
  loopTimesLeftLabel?: string;
  markerDialogInitialTime?: number;
  markerDialogSuggestedName?: string;
  openMarkerDialogForEdit?: (markerData: Partial<TroffMarker>) => void;
};

// Function to update marker slider with current song markers
const updateMarkerSlider = (markerSlider: MarkerSlider, setAudioTime: boolean = true) => {
  const currentSongMetadata = getCurrentSongMetadata();
  const songDuration = audio.duration > 0 ? audio.duration : currentSongMetadata?.duration || 0;
  if (currentSongMetadata && markerSlider) {
    // Load real markers from current song
    const songKey = getCurrentSongKey();
    const currentSongData = songKey ? nDB.get(songKey) : null;
    const hadMarkers =
      Array.isArray(currentSongData?.markers) && currentSongData.markers.length > 0;
    const markers = ensureDefaultMarkers(currentSongData, songDuration);
    if (!hadMarkers && markers.length > 0 && songKey && currentSongData) {
      // ensureDefaultMarkers created default markers — save to nDB
      nDB.set(songKey, currentSongData);
    }

    markerSlider.markers = markers;
    markerSlider.min = 0;
    markerSlider.max = songDuration;
    markerSlider.unit = 's';
    if (setAudioTime) {
      audio.currentTime = markerSlider.getPlaybackStart();
    }

    configureMarkerSlider(markerSlider, currentSongData);
  } else if (markerSlider) {
    // No song selected, use default state
    markerSlider.markers = [];
    markerSlider.min = 0;
    markerSlider.max = 0;
    markerSlider.unit = '';
    markerSlider.value = 0;
    if (setAudioTime) {
      audio.currentTime = 0;
    }
  }
};

// Initialize components and set up event listeners

document.addEventListener('DOMContentLoaded', () => {
  const footer = document.getElementById('footer') as FooterElement | null;
  const settingsPanel = document.getElementById('settingsPanel') as any;
  const header = document.getElementById('header') as any;
  const songList = document.getElementById('songList') as any;
  const markerSlider = document.getElementById('markerSlider') as MarkerSlider;
  let pendingPlaybackStart: number | undefined;
  let playbackCountdownInterval: number | undefined;
  let isLoopTransitionPause = false;
  let configuredLoopTimes = 1;
  let loopTimesLeft = 1;

  const withSafeNumber = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const getTimelineDuration = () => {
    const durationFromSlider = withSafeNumber(markerSlider?.max, 0);
    if (durationFromSlider > 0) {
      return durationFromSlider;
    }

    const durationFromAudio = withSafeNumber(audio.duration, 0);
    if (durationFromAudio > 0) {
      return durationFromAudio;
    }

    const metadataDuration = withSafeNumber(getCurrentSongMetadata()?.duration, 0);
    return Math.max(0, metadataDuration);
  };

  const normalizeZoomWindow = (startTime: number, endTime: number, duration: number) => {
    const boundedDuration = Math.max(0, duration);
    const boundedStart = Math.max(0, Math.min(startTime, boundedDuration));
    const boundedEnd = Math.max(0, Math.min(endTime, boundedDuration));

    if (boundedEnd <= boundedStart) {
      return { startTime: 0, endTime: boundedDuration };
    }

    return { startTime: boundedStart, endTime: boundedEnd };
  };

  const persistZoomWindow = (startTime: number, endTime: number) => {
    const songKey = getCurrentSongKey();
    if (!songKey) {
      return;
    }

    nDB.setOnSong(songKey, 'zoomStartTime', startTime);
    nDB.setOnSong(songKey, 'zoomEndTime', endTime);
  };

  const getMarkerViewportPaddingTime = (visibleWindow: number) => {
    if (!markerSlider || visibleWindow <= 0) {
      return 0;
    }

    const mainLayout = document.querySelector('t-main-layout') as HTMLElement | null;
    const mainContent = mainLayout?.shadowRoot?.querySelector(
      '.main-content'
    ) as HTMLElement | null;
    const markerElement = markerSlider.shadowRoot?.querySelector(
      '.preset-marker'
    ) as HTMLElement | null;

    if (!mainContent || !markerElement || mainContent.clientHeight <= 0) {
      return 0;
    }

    const halfMarkerHeight = markerElement.getBoundingClientRect().height / 2;
    if (halfMarkerHeight <= 0) {
      return 0;
    }

    return (visibleWindow * halfMarkerHeight) / mainContent.clientHeight;
  };

  const applyMarkerSliderZoom = async (
    startTime: number,
    endTime: number,
    persist: boolean,
    addMarkerPadding: boolean = false
  ) => {
    if (!markerSlider) {
      return;
    }

    const duration = getTimelineDuration();
    const baseZoomWindow = normalizeZoomWindow(startTime, endTime, duration);
    const paddingTime = addMarkerPadding
      ? getMarkerViewportPaddingTime(baseZoomWindow.endTime - baseZoomWindow.startTime)
      : 0;
    const zoomWindow = normalizeZoomWindow(
      baseZoomWindow.startTime - paddingTime,
      baseZoomWindow.endTime + paddingTime,
      duration
    );
    const visibleWindow = zoomWindow.endTime - zoomWindow.startTime;
    const zoomLevel = visibleWindow > 0 && duration > 0 ? duration / visibleWindow : 1;

    markerSlider.zoomLevel = Math.max(markerSlider.minZoom, zoomLevel);

    if (persist) {
      persistZoomWindow(zoomWindow.startTime, zoomWindow.endTime);
    }

    await markerSlider.updateComplete;

    const mainLayout = document.querySelector('t-main-layout') as HTMLElement | null;
    const mainContent = mainLayout?.shadowRoot?.querySelector(
      '.main-content'
    ) as HTMLElement | null;
    const sliderContainer = markerSlider.shadowRoot?.querySelector(
      '.slider-container'
    ) as HTMLElement | null;

    if (!mainContent || !sliderContainer || duration <= 0) {
      return;
    }

    const centerTime = (zoomWindow.startTime + zoomWindow.endTime) / 2;
    const centerFraction = Math.max(0, Math.min(1, centerTime / duration));

    const sliderRect = sliderContainer.getBoundingClientRect();
    const contentRect = mainContent.getBoundingClientRect();
    const targetViewportY = sliderRect.top + sliderRect.height * centerFraction;
    const delta = targetViewportY - (contentRect.top + contentRect.height / 2);
    const maxScrollTop = Math.max(0, mainContent.scrollHeight - mainContent.clientHeight);
    const nextScrollTop = Math.max(0, Math.min(maxScrollTop, mainContent.scrollTop + delta));

    mainContent.scrollTo({ top: nextScrollTop, behavior: 'smooth' });
  };

  const zoomToPlayableRegion = async () => {
    if (!markerSlider) {
      return;
    }

    await applyMarkerSliderZoom(
      markerSlider.getPlaybackStart(),
      markerSlider.getPlaybackStop(),
      true,
      true
    );
  };

  const zoomOutTimeline = async () => {
    const duration = getTimelineDuration();
    await applyMarkerSliderZoom(0, duration, true);
  };

  const applySavedZoomWindowForCurrentSong = async () => {
    const songKey = getCurrentSongKey();
    if (!songKey) {
      return;
    }

    const songData = nDB.get(songKey) || {};
    const duration = getTimelineDuration();
    const fallbackEnd = duration;

    const savedStart = withSafeNumber(songData.zoomStartTime, 0);
    const savedEnd = withSafeNumber(songData.zoomEndTime, fallbackEnd);
    const normalized = normalizeZoomWindow(savedStart, savedEnd, duration);

    await applyMarkerSliderZoom(normalized.startTime, normalized.endTime, false);
  };

  const selectFirstAndLastMarkers = () => {
    const songKey = getCurrentSongKey();
    if (!songKey) {
      return;
    }

    const songData = nDB.get(songKey) || {};
    const songDuration = audio.duration > 0 ? audio.duration : 0;
    const hadMarkers = Array.isArray(songData.markers) && songData.markers.length > 0;
    const markers = ensureDefaultMarkers(songData, songDuration);
    if (!hadMarkers && markers.length > 0) {
      // ensureDefaultMarkers created default markers — save to nDB
      nDB.set(songKey, songData);
    }
    if (markers.length === 0) {
      return;
    }

    const markerToNumericTime = (markerTime: unknown) => {
      if (markerTime === 'max') {
        return Number.POSITIVE_INFINITY;
      }

      const parsed = Number(markerTime);
      return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
    };

    markers.sort((a, b) => markerToNumericTime(a.time) - markerToNumericTime(b.time));

    const firstMarkerId = String(markers[0].id);
    const lastMarkerId = String(markers[markers.length - 1].id);

    songData.currentStartMarker = firstMarkerId;
    songData.currentStopMarker = `${lastMarkerId}S`;
    nDB.set(songKey, songData);

    markerSlider.startMarkerId = firstMarkerId;
    markerSlider.stopMarkerId = `${lastMarkerId}S`;
    markerSlider.requestUpdate();
  };

  const parseConfiguredLoopTimes = (value: unknown) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'inf' || normalized === 'infinite' || normalized === '∞') {
        return Number.POSITIVE_INFINITY;
      }
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 1;
    }

    return Math.floor(parsed);
  };

  const normalizeLoopTimesInput = (value: unknown): number | string => {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'inf' || normalized === 'infinite' || normalized === '∞') {
        return 'Inf';
      }
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 1;
    }

    return Math.floor(parsed);
  };

  const getDefaultLoopTimesValue = (): string | number => {
    const infiniteOn = nDB.get(TROFF_SETTING_SONG_DEFAULT_NR_LOOPS_INFINIT_IS_ON) === true;
    if (infiniteOn) {
      return 'Inf';
    }
    const defaultNr =
      Number(nDB.get(TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_NR_LOOPS_VALUE)) || 1;
    return defaultNr;
  };

  const updateLoopTimesDisplay = () => {
    if (footer) {
      footer.loopTimesLeftLabel = Number.isFinite(loopTimesLeft) ? String(loopTimesLeft) : '∞';
    }

    if (header) {
      header.statusLoopsLeft = Number.isFinite(loopTimesLeft) ? `${loopTimesLeft}#` : '∞#';
    }
  };

  const updateHeaderCountdownDisplay = () => {
    if (!header) {
      return;
    }

    if (pendingPlaybackStart !== undefined && footer?.isStartingPlayback) {
      header.statusCountdown = `${Math.max(1, footer.playbackCountdown ?? 1)}s`;
      return;
    }

    if (!audio.paused) {
      header.statusCountdown = '0s';
      return;
    }

    const pauseBeforeSeconds =
      footer && !footer.disablePauseBefore ? Math.max(0, footer.pauseBefore ?? 0) : 0;
    header.statusCountdown = `${pauseBeforeSeconds}s`;
  };

  const syncSettingsPanelValues = () => {
    if (!settingsPanel) {
      return;
    }

    const songKey = getCurrentSongKey();
    const songData = songKey ? nDB.get(songKey) : null;
    const rawLoopTimes =
      songData?.loopTimes !== undefined ? songData.loopTimes : getDefaultLoopTimesValue();
    const configuredLoops = parseConfiguredLoopTimes(rawLoopTimes);

    settingsPanel.loopTimesValue = Number.isFinite(configuredLoops)
      ? String(configuredLoops)
      : 'Inf';

    // Load song-specific numeric settings and their disabled states.
    // Disabled state must be set BEFORE value so the t-dial knows its disabled
    // state when receiving the new value (for correct display).
    if (songKey && songData) {
      if (songData.TROFF_CLASS_TO_TOGGLE_buttStartBefore === undefined) {
        const globalStartBeforeOn = nDB.get(TROFF_SETTING_SONG_DEFAULT_START_BEFORE_ON) ?? false;
        settingsPanel.startBeforeDisabled = !globalStartBeforeOn;
      } else {
        settingsPanel.startBeforeDisabled =
          songData.TROFF_CLASS_TO_TOGGLE_buttStartBefore === false;
      }
      settingsPanel.startBeforeValue = getStartBefore(songData);
      if (songData.TROFF_CLASS_TO_TOGGLE_buttStopAfter === undefined) {
        const globalStopAfterOn = nDB.get(TROFF_SETTING_SONG_DEFAULT_STOP_AFTER_ON) ?? false;
        settingsPanel.stopAfterDisabled = !globalStopAfterOn;
      } else {
        settingsPanel.stopAfterDisabled = songData.TROFF_CLASS_TO_TOGGLE_buttStopAfter === false;
      }
      settingsPanel.stopAfterValue = getStopAfter(songData);
      if (songData.TROFF_CLASS_TO_TOGGLE_buttIncrementUntil === undefined) {
        const globalIncrementUntilOn =
          nDB.get(TROFF_SETTING_SONG_DEFAULT_INCREMENT_UNTIL_ON) ?? false;
        settingsPanel.incrementUntillDisabled = !globalIncrementUntilOn;
      } else {
        settingsPanel.incrementUntillDisabled =
          songData.TROFF_CLASS_TO_TOGGLE_buttIncrementUntil !== true;
      }
      settingsPanel.incrementUntillValue = getIncrementUntil(songData);
    } else {
      settingsPanel.startBeforeValue = 0;
      settingsPanel.startBeforeDisabled = false;
      settingsPanel.stopAfterValue = 0;
      settingsPanel.stopAfterDisabled = false;
      settingsPanel.incrementUntillValue = 0;
      settingsPanel.incrementUntillDisabled = false;
    }

    settingsPanel.enterUseTimer = nDB.get(TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR) === true;
    settingsPanel.enterResetCounter = nDB.get(TROFF_SETTING_ENTER_RESET_COUNTER) === true;
    settingsPanel.spaceUseTimer = nDB.get(TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR) === true;
    settingsPanel.spaceResetCounter = nDB.get(TROFF_SETTING_SPACE_RESET_COUNTER) === true;
    settingsPanel.playUseTimer = nDB.get(TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR) === true;
    settingsPanel.playResetCounter = nDB.get(TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER) === true;
    settingsPanel.extendedMarkerColor = nDB.get(TROFF_SETTING_EXTENDED_MARKER_COLOR) === true;
    settingsPanel.extraExtendedMarkerColor =
      nDB.get(TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR) === true;

    // Load global default song values from nDB
    settingsPanel.defaultStartBeforeValue =
      Number(nDB.get(TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_START_BEFORE_VALUE)) || 4;
    settingsPanel.defaultStartBeforeOn =
      nDB.get(TROFF_SETTING_SONG_DEFAULT_START_BEFORE_ON) ?? false;
    settingsPanel.defaultStopAfterValue =
      Number(nDB.get(TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_STOP_AFTER_VALUE)) || 2;
    settingsPanel.defaultStopAfterOn = nDB.get(TROFF_SETTING_SONG_DEFAULT_STOP_AFTER_ON) ?? false;
    settingsPanel.defaultPauseBeforeValue =
      Number(nDB.get(TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_PAUSE_BEFORE_VALUE)) || 3;
    settingsPanel.defaultPauseBeforeOn =
      nDB.get(TROFF_SETTING_SONG_DEFAULT_PAUSE_BEFORE_ON) ?? true;
    settingsPanel.defaultWaitBetweenValue =
      Number(nDB.get(TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_WAIT_BETWEEN_VALUE)) || 1;
    settingsPanel.defaultWaitBetweenOn =
      nDB.get(TROFF_SETTING_SONG_DEFAULT_WAIT_BETWEEN_ON) ?? true;
    settingsPanel.defaultIncrementUntilValue =
      Number(nDB.get('TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_INCREMENT_UNTIL_VALUE')) || 100;
    settingsPanel.defaultIncrementUntilOn =
      nDB.get(TROFF_SETTING_SONG_DEFAULT_INCREMENT_UNTIL_ON) ?? false;
    settingsPanel.defaultNrLoopsValue =
      Number(nDB.get(TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_NR_LOOPS_VALUE)) || 1;
    settingsPanel.defaultNrLoopsInfiniteOn =
      nDB.get(TROFF_SETTING_SONG_DEFAULT_NR_LOOPS_INFINIT_IS_ON) ?? false;
    settingsPanel.defaultVolumeValue =
      Number(nDB.get(TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_VOLUME_VALUE)) || 75;
    settingsPanel.defaultSpeedValue =
      Number(nDB.get(TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_SPEED_VALUE)) || 100;
  };

  const syncLoopTimesFromSong = () => {
    const songKey = getCurrentSongKey();
    const songData = songKey ? nDB.get(songKey) : null;
    const rawLoopTimes =
      songData?.loopTimes !== undefined ? songData.loopTimes : getDefaultLoopTimesValue();
    configuredLoopTimes = parseConfiguredLoopTimes(rawLoopTimes);
    loopTimesLeft = configuredLoopTimes;
    updateLoopTimesDisplay();
  };

  const resetLoopTimesCounter = () => {
    loopTimesLeft = configuredLoopTimes;
    updateLoopTimesDisplay();
  };

  const updatePlaybackCountdown = (millisecondsLeft: number) => {
    const countdownSeconds = Math.max(1, Math.ceil(millisecondsLeft / 1000));

    if (footer) {
      footer.isStartingPlayback = true;
      footer.playbackCountdown = countdownSeconds;
    }

    if (header) {
      header.statusCountdown = `${countdownSeconds}s`;
    }
  };

  const clearPlaybackCountdown = () => {
    if (playbackCountdownInterval !== undefined) {
      window.clearInterval(playbackCountdownInterval);
      playbackCountdownInterval = undefined;
    }

    if (footer) {
      footer.isStartingPlayback = false;
      footer.playbackCountdown = 0;
    }

    updateHeaderCountdownDisplay();
  };

  const clearPendingPlaybackStart = () => {
    if (pendingPlaybackStart === undefined) {
      clearPlaybackCountdown();
      return;
    }

    window.clearTimeout(pendingPlaybackStart);
    pendingPlaybackStart = undefined;
    clearPlaybackCountdown();
  };

  const isEditableHostElement = (element: HTMLElement): boolean => {
    const tagName = element.tagName.toLowerCase();
    return tagName === 't-input' || tagName === 't-textarea';
  };

  const isEditableKeyEvent = (event: KeyboardEvent) => {
    const path = event.composedPath();
    for (const target of path) {
      if (!(target instanceof HTMLElement)) {
        continue;
      }

      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return true;
      }

      if (target.isContentEditable) {
        return true;
      }

      if (isEditableHostElement(target)) {
        return true;
      }
    }

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
      return true;
    }

    if (activeElement instanceof HTMLElement && activeElement.isContentEditable) {
      return true;
    }

    if (activeElement instanceof HTMLElement && isEditableHostElement(activeElement)) {
      return true;
    }

    if (activeElement instanceof HTMLElement) {
      const shadowActiveElement = activeElement.shadowRoot?.activeElement;
      if (
        shadowActiveElement instanceof HTMLInputElement ||
        shadowActiveElement instanceof HTMLTextAreaElement
      ) {
        return true;
      }

      if (shadowActiveElement instanceof HTMLElement && shadowActiveElement.isContentEditable) {
        return true;
      }

      if (shadowActiveElement instanceof HTMLElement && isEditableHostElement(shadowActiveElement)) {
        return true;
      }
    }

    return false;
  };

  const getPauseBeforeDelay = (settingKey: string) => {
    if (!footer || !nDB.get(settingKey) || footer.disablePauseBefore) {
      return 0;
    }

    return Math.max(0, footer.pauseBefore ?? 0) * 1000;
  };

  const getWaitBetweenDelay = () => {
    if (!footer || footer.disableWaitBetween) {
      return 0;
    }

    return Math.max(0, footer.waitBetween ?? 0) * 1000;
  };

  const schedulePlaybackAfterDelay = (delay: number) => {
    clearPendingPlaybackStart();

    if (delay <= 0) {
      clearPlaybackCountdown();
      audio.play().catch(console.error);
      return;
    }

    const targetTime = Date.now() + delay;
    updatePlaybackCountdown(delay);
    playbackCountdownInterval = window.setInterval(() => {
      const millisecondsLeft = targetTime - Date.now();
      if (millisecondsLeft <= 0) {
        return;
      }

      updatePlaybackCountdown(millisecondsLeft);
    }, 100);

    pendingPlaybackStart = window.setTimeout(() => {
      pendingPlaybackStart = undefined;
      audio.play().catch((error) => {
        clearPendingPlaybackStart();
        console.error(error);
      });
    }, delay);
  };

  const shouldResetLoopCounter = (settingKey: string) => nDB.get(settingKey) === true;

  const startPlayback = (timerSettingKey: string, resetCounterSettingKey: string) => {
    if (pendingPlaybackStart !== undefined) {
      if (shouldResetLoopCounter(resetCounterSettingKey)) {
        resetLoopTimesCounter();
      }
      clearPendingPlaybackStart();
      updateHeaderCountdownDisplay();
      return;
    }

    if (!audio.paused) {
      if (shouldResetLoopCounter(resetCounterSettingKey)) {
        resetLoopTimesCounter();
      }
      audio.pause();
      updateHeaderCountdownDisplay();
      return;
    }

    schedulePlaybackAfterDelay(getPauseBeforeDelay(timerSettingKey));
    updateHeaderCountdownDisplay();
  };

  const handlePlaybackKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing || event.repeat) {
      return;
    }

    if (event.altKey || event.ctrlKey || event.metaKey || isEditableKeyEvent(event)) {
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      startPlayback(TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR, TROFF_SETTING_ENTER_RESET_COUNTER);
      return;
    }

    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      event.stopPropagation();
      startPlayback(TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR, TROFF_SETTING_SPACE_RESET_COUNTER);
    }
  };

  document.addEventListener('keydown', handlePlaybackKeyDown, true);

  // Set CSS variables for header and footer heights (simple one-time calculation)
  const setComponentHeights = () => {
    if (header) {
      const headerHeight = header.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);
    }
    if (footer) {
      const footerHeight = footer.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--footer-height', `${footerHeight}px`);
    }
  };

  // Set heights after components are rendered
  setTimeout(setComponentHeights, 200);

  if (footer && settingsPanel) {
    // Listen for settings toggle events from footer
    footer.addEventListener('settings-toggle', (event: any) => {
      settingsPanel.visible = event.detail.visible;
      if (event.detail.visible) {
        songList.visible = false; // Close song list when settings open
      }
    });

    // Listen for settings panel close events
    settingsPanel.addEventListener('settings-panel-closed', () => {
      settingsPanel.visible = false;
      footer.settingsPanelVisible = false;
    });

    // Listen for setting changes
    settingsPanel.addEventListener('setting-changed', (event: any) => {
      const setting = String(event.detail.setting ?? '');
      const value = event.detail.value;
      const songKey = getCurrentSongKey();

      if (setting === 'playFullSong') {
        selectFirstAndLastMarkers();
        settingsPanel.playFullSong = false;
        return;
      }

      if (setting === 'startBefore' || setting === 'stopAfter' || setting === 'incrementUntill') {
        if (!songKey) {
          return;
        }

        const currentSongData = nDB.get(songKey) || {};
        if (setting === 'startBefore') {
          currentSongData.TROFF_VALUE_startBefore = value;
          markerSlider.startBefore = Number(value) || 0;
        }
        if (setting === 'stopAfter') {
          currentSongData.TROFF_VALUE_stopAfter = value;
          markerSlider.stopAfter = Number(value) || 0;
        }
        if (setting === 'incrementUntill') {
          currentSongData.TROFF_VALUE_incrementUntilValue = value;
        }

        nDB.set(songKey, currentSongData);
        markerSlider.requestUpdate();
        return;
      }

      if (
        setting === 'startBeforeDisabled' ||
        setting === 'stopAfterDisabled' ||
        setting === 'incrementUntillDisabled'
      ) {
        if (!songKey) {
          return;
        }

        const currentSongData = nDB.get(songKey) || {};
        if (setting === 'startBeforeDisabled') {
          currentSongData.TROFF_CLASS_TO_TOGGLE_buttStartBefore = !value;
        }
        if (setting === 'stopAfterDisabled') {
          currentSongData.TROFF_CLASS_TO_TOGGLE_buttStopAfter = !value;
        }
        if (setting === 'incrementUntillDisabled') {
          currentSongData.TROFF_CLASS_TO_TOGGLE_buttIncrementUntil = !value;
        }

        nDB.set(songKey, currentSongData);
        return;
      }

      if (setting === 'loopTimes') {
        if (!songKey) {
          return;
        }

        const normalizedLoopTimes = normalizeLoopTimesInput(value);
        nDB.setOnSong(songKey, 'loopTimes', normalizedLoopTimes);
        syncLoopTimesFromSong();
        syncSettingsPanelValues();
        return;
      }

      // Save global default song values to nDB
      const defaultNumericKeyBySetting: Record<string, string> = {
        defaultStartBeforeValue: TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_START_BEFORE_VALUE,
        defaultStopAfterValue: TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_STOP_AFTER_VALUE,
        defaultPauseBeforeValue: TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_PAUSE_BEFORE_VALUE,
        defaultWaitBetweenValue: TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_WAIT_BETWEEN_VALUE,
        defaultIncrementUntilValue:
          'TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_INCREMENT_UNTIL_VALUE',
        defaultNrLoopsValue: TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_NR_LOOPS_VALUE,
        defaultVolumeValue: TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_VOLUME_VALUE,
        defaultSpeedValue: TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_SPEED_VALUE,
      };
      const defaultOnKeyBySetting: Record<string, string> = {
        defaultStartBeforeOn: TROFF_SETTING_SONG_DEFAULT_START_BEFORE_ON,
        defaultStopAfterOn: TROFF_SETTING_SONG_DEFAULT_STOP_AFTER_ON,
        defaultPauseBeforeOn: TROFF_SETTING_SONG_DEFAULT_PAUSE_BEFORE_ON,
        defaultWaitBetweenOn: TROFF_SETTING_SONG_DEFAULT_WAIT_BETWEEN_ON,
        defaultIncrementUntilOn: TROFF_SETTING_SONG_DEFAULT_INCREMENT_UNTIL_ON,
        defaultNrLoopsInfiniteOn: TROFF_SETTING_SONG_DEFAULT_NR_LOOPS_INFINIT_IS_ON,
      };

      const numericKey = defaultNumericKeyBySetting[setting];
      if (numericKey) {
        nDB.set(numericKey, value);
        return;
      }

      const onKey = defaultOnKeyBySetting[setting];
      if (onKey) {
        nDB.set(onKey, value === true);
        return;
      }

      const settingsKeyByPanelSetting: Record<string, string> = {
        enterUseTimer: TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR,
        enterResetCounter: TROFF_SETTING_ENTER_RESET_COUNTER,
        spaceUseTimer: TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR,
        spaceResetCounter: TROFF_SETTING_SPACE_RESET_COUNTER,
        playUseTimer: TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR,
        playResetCounter: TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER,
        extendedMarkerColor: TROFF_SETTING_EXTENDED_MARKER_COLOR,
        extraExtendedMarkerColor: TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR,
      };

      const storageKey = settingsKeyByPanelSetting[setting];
      if (!storageKey) {
        return;
      }

      nDB.set(storageKey, value === true);
      syncSettingsPanelValues();

      if (setting === 'extendedMarkerColor' || setting === 'extraExtendedMarkerColor') {
        const songKey = getCurrentSongKey();
        const songData = songKey ? nDB.get(songKey) : null;
        configureMarkerSlider(markerSlider, songData);
        markerSlider.requestUpdate();
      }
    });

    settingsPanel.addEventListener('song-action-requested', async (event: Event) => {
      const customEvent = event as CustomEvent<{ action?: string }>;
      const action = String(customEvent.detail?.action ?? '');

      if (action === 'zoom') {
        await zoomToPlayableRegion();
        return;
      }

      if (action === 'zoomOut') {
        await zoomOutTimeline();
      }
    });
  }

  if (footer) {
    updateFooterWithCurrentSong();
    syncLoopTimesFromSong();
    syncSettingsPanelValues();
    updateHeaderCountdownDisplay();

    // Listen for nav-click events
    footer.addEventListener('nav-click', (event: any) => {
      if (event.detail.action === 'play') {
        startPlayback(
          TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR,
          TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER
        );
      }
    });

    // Listen for speed and volume changes
    footer.addEventListener('speed-changed', (event: any) => {
      audio.playbackRate = event.detail.speed / 100;
      const songKey = getCurrentSongKey();
      if (songKey) {
        nDB.setOnSong(songKey, 'TROFF_VALUE_speedBar', event.detail.speed);
      }
    });

    footer.addEventListener('volume-changed', (event: any) => {
      audio.volume = event.detail.volume / 100;
      const songKey = getCurrentSongKey();
      if (songKey) {
        nDB.setOnSong(songKey, 'TROFF_VALUE_volumeBar', event.detail.volume);
      }
    });

    // Listen for pause before and wait between changes
    footer.addEventListener('pause-before-changed', (event: any) => {
      const songKey = getCurrentSongKey();
      if (songKey) {
        nDB.setOnSong(songKey, 'TROFF_VALUE_pauseBeforeStart', event.detail.pauseBefore);
        nDB.setOnSong(songKey, 'TROFF_CLASS_TO_TOGGLE_buttPauseBefStart', !event.detail.disabled);
      }
      updateHeaderCountdownDisplay();
    });

    footer.addEventListener('wait-between-changed', (event: any) => {
      const songKey = getCurrentSongKey();
      if (songKey) {
        nDB.setOnSong(songKey, 'TROFF_VALUE_waitBetweenLoops', event.detail.waitBetween);
        nDB.setOnSong(
          songKey,
          'TROFF_CLASS_TO_TOGGLE_buttWaitBetweenLoops',
          !event.detail.disabled
        );
      }
    });

    footer.addEventListener('marker-created', (event: any) => {
      // Save the marker to localStorage (following existing pattern)
      const songKey = getCurrentSongKey();
      if (songKey && event.detail.marker) {
        const currentSongData = nDB.get(songKey) || {};
        const existingMarkers = currentSongData.markers || [];
        existingMarkers.push(event.detail.marker);
        nDB.setOnSong(songKey, 'markers', existingMarkers);
      }

      // Update the marker slider UI
      updateMarkerSlider(markerSlider, false);
    });

    footer.addEventListener('marker-dialog-opened', () => {
      const songKey = getCurrentSongKey();
      const currentSongData = songKey ? nDB.get(songKey) : null;
      const existingMarkers = (currentSongData?.markers || []) as TroffMarker[];

      footer.markerDialogInitialTime = audio.currentTime || 0;
      footer.markerDialogSuggestedName = `marker nr ${existingMarkers.length + 1}`;
    });

    footer.addEventListener('marker-updated', (event: any) => {
      // Update the marker in localStorage
      const songKey = getCurrentSongKey();
      if (songKey && event.detail.marker) {
        const currentSongData = nDB.get(songKey) || {};
        const existingMarkers = currentSongData.markers || [];
        const markerIndex = existingMarkers.findIndex((m: any) => m.id === event.detail.marker.id);
        if (markerIndex !== -1) {
          existingMarkers[markerIndex] = event.detail.marker;
          nDB.setOnSong(songKey, 'markers', existingMarkers);
        }
      }

      // Update the marker slider UI
      updateMarkerSlider(markerSlider, false);
    });

    footer.addEventListener('marker-deleted', (event: Event) => {
      const customEvent = event as CustomEvent<{ markerId?: string }>;
      // Remove the marker from localStorage
      const songKey = getCurrentSongKey();
      if (songKey && customEvent.detail.markerId) {
        const currentSongData = nDB.get(songKey) || {};
        const existingMarkers = currentSongData.markers || [];
        const updatedMarkers = existingMarkers.filter(
          (m: TroffMarker) => m.id !== customEvent.detail.markerId
        );
        nDB.setOnSong(songKey, 'markers', updatedMarkers);
      }

      // Update the marker slider UI
      updateMarkerSlider(markerSlider, false);
    });

    // Listen for marker-edit events from t-marker components
    document.addEventListener('marker-edit', (event: Event) => {
      const customEvent = event as CustomEvent<{ marker?: Partial<TroffMarker> }>;
      if (footer && customEvent.detail?.marker && footer.openMarkerDialogForEdit) {
        footer.openMarkerDialogForEdit(customEvent.detail.marker);
      }
    });
  }

  if (header) {
    // Listen for header expand events
    header.addEventListener('header-expand', (event: any) => {
      const expanded = event.detail.expanded;

      // Toggle song list visibility
      if (songList) {
        songList.visible = expanded;
        if (expanded) {
          settingsPanel.visible = false; // Close settings panel when song list opens
          if (footer) {
            footer.settingsPanelVisible = false;
          }
        }
      }
    });

    // Listen for song list close events
    if (songList) {
      songList.addEventListener('song-list-closed', () => {
        header.expanded = false;
      });

      // Listen for song selection
      songList.addEventListener('media-selected', (event: any) => {
        // Update current song in localStorage
        const songKey = event.detail.songKey;
        if (songKey) {
          clearPendingPlaybackStart();
          setCurrentSong(songKey);
          loadSong(songKey);

          updateFooterWithCurrentSong();
          syncLoopTimesFromSong();
          syncSettingsPanelValues();
          updateHeaderCountdownDisplay();

          // Update marker slider with new song markers
          updateMarkerSlider(markerSlider);
          void applySavedZoomWindowForCurrentSong();
        }
      });
    }

    // Initialize header with current song data
    updateHeaderWithCurrentSong();

    const currentSongKey = getCurrentSongKey();
    if (currentSongKey) {
      clearPendingPlaybackStart();
      loadSong(currentSongKey);
      syncLoopTimesFromSong();
      syncSettingsPanelValues();
      updateHeaderCountdownDisplay();
      void applySavedZoomWindowForCurrentSong();
    }

    // Add audio event listeners for timing
    audio.addEventListener('loadedmetadata', () => {
      header.totalTime = formatDuration(audio.duration);
      updateMarkerSlider(markerSlider);
      selectFirstAndLastMarkers();
      void applySavedZoomWindowForCurrentSong();
    });
    audio.addEventListener('timeupdate', () => {
      header.currentTime = formatDuration(audio.currentTime);
      markerSlider.value = audio.currentTime;

      // Check if playback reached the stop point
      if (audio.currentTime >= markerSlider.getPlaybackStop()) {
        const playbackStart = markerSlider.getPlaybackStart();
        if (Number.isFinite(loopTimesLeft)) {
          if (loopTimesLeft <= 1) {
            audio.pause();
            audio.currentTime = playbackStart;
            resetLoopTimesCounter();
            return;
          }

          loopTimesLeft -= 1;
          updateLoopTimesDisplay();
        }

        const waitBetweenDelay = getWaitBetweenDelay();
        isLoopTransitionPause = true;
        audio.pause();
        audio.currentTime = playbackStart;
        schedulePlaybackAfterDelay(waitBetweenDelay);
      }
    });
    audio.addEventListener('play', () => {
      clearPlaybackCountdown();
      if (footer) {
        footer.isPlaying = true;
      }
      updateHeaderCountdownDisplay();
    });
    audio.addEventListener('pause', () => {
      if (isLoopTransitionPause) {
        isLoopTransitionPause = false;
      } else {
        clearPendingPlaybackStart();
      }
      if (footer) {
        footer.isPlaying = false;
      }
      updateHeaderCountdownDisplay();
    });
    audio.addEventListener('ended', () => {
      clearPendingPlaybackStart();
      if (footer) {
        footer.isPlaying = false;
      }
      updateHeaderCountdownDisplay();
    });
  }

  // Set up marker slider with real markers from current song
  if (markerSlider) {
    // Initialize marker slider with current song markers
    updateMarkerSlider(markerSlider);

    // Listen for slider value changes
    markerSlider.addEventListener('value-changed', (event: any) => {
      audio.currentTime = event.detail.value;
    });

    // Listen for start marker selection
    markerSlider.addEventListener('set-start-marker', (event: any) => {
      const markerId = event.detail.markerId;
      const songKey = getCurrentSongKey();
      if (songKey) {
        const currentSongData = nDB.get(songKey);
        if (currentSongData) {
          currentSongData.currentStartMarker = markerId;
          nDB.set(songKey, currentSongData);
          updateMarkerSlider(markerSlider);
        }
      }
    });

    // Listen for stop marker selection
    markerSlider.addEventListener('set-stop-marker', (event: any) => {
      const markerId = event.detail.markerId;
      const songKey = getCurrentSongKey();
      if (songKey) {
        const currentSongData = nDB.get(songKey);
        if (currentSongData) {
          currentSongData.currentStopMarker = markerId + 'S';
          nDB.set(songKey, currentSongData);
          updateMarkerSlider(markerSlider, false);
        }
      }
    });
  }
});
