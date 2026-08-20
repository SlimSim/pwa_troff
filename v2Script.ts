import './components/atom/t-butt.js';
import './components/atom/t-icon.js';
import './assets/external/jquery-3.6.0.min.js';
import './components/molecule/t-footer.js';
import './components/molecule/t-settings-panel.js';
import './components/molecule/t-header.js';
import './components/molecule/t-media-parent.js';
import './components/molecule/t-main-layout.js';
import './components/molecule/t-current-song-controls.js';
import './components/molecule/t-group-dialog.js';
import './components/molecule/t-song-edit-dialog.js';
import type { SongEditDialog } from './components/molecule/t-song-edit-dialog.js';
import type { ShareSongDialog } from './components/molecule/t-share-song-dialog.js';
import './components/molecule/t-import-export-dialog.js';
import './components/molecule/t-marker-tools-dialog.js';
import './components/molecule/t-share-song-dialog.js';
import './components/organisms/t-marker-slider.js';
import './components/organisms/t-video-player.js';
import {
  updateHeaderWithCurrentSong,
  setCurrentSong,
  getCurrentSongMetadata,
  getCurrentSongKey,
  updateFooterWithCurrentSong,
} from './utils/current-song.js';
import { nDB } from './assets/internal/db.js';
import { audio, loadSong } from './services/audio.js';
import { formatDuration, countLast30Days } from './utils/formatters.js';
import {
  getSelectedMarkerRange,
  copyMarkers,
  moveMarkers,
  stretchMarkers,
  deleteMarkers,
  normalizeMarkerTime,
  mergeNearbyMarkers,
} from './utils/marker-actions.js';
import { mergeImportedMarkers } from './utils/marker-import.js';
import { MarkerSlider } from './components/organisms/t-marker-slider.js';
import {
  configureMarkerSlider,
  getStartBefore,
  getStopAfter,
  getIncrementUntil,
  ensureDefaultMarkers,
} from './utils/troff-settings.js';
import type {
  TroffMarker,
  State,
  State_WithTime,
  TroffManualImportExport,
  TroffFileData,
} from './types/troff.d.js';
import {
  TROFF_SETTING_ENTER_RESET_COUNTER,
  TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR,
  TROFF_SETTING_ENTER_GO_TO_MARKER_BEHAVIOUR,
  TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER,
  TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR,
  TROFF_SETTING_PLAY_UI_BUTTON_GO_TO_MARKER_BEHAVIOUR,
  TROFF_SETTING_SPACE_RESET_COUNTER,
  TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR,
  TROFF_SETTING_SPACE_GO_TO_MARKER_BEHAVIOUR,
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
import log from './utils/log.js';
import { showToast } from './utils/notification.js';
import { initPwa } from './utils/pwa.js';
import { syncFirebaseGroups } from './utils/firebase-sync.js';
import { toSongKey } from './utils/utils.js';
import {
  setupListeners,
  setupGroupSongListeners,
  teardownListeners,
  saveSongData,
  setLiveUpdateCallback,
  setGroupUpdateCallback,
} from './utils/firebase-realtime.js';
import {
  setSentryEnvironment,
  setSentryVersion,
  setSentryApp,
  addAndStartSentry,
} from './utils/sentry.js';
import { getManifest } from './utils/manifestHelper.js';

// Hostname→Sentry environment mapping — mirrors utils/firebase-getter.ts
// (which itself mirrors the legacy assets/internal/environment.ts selection).
function getSentryEnvironment(): 'dev' | 'test' | 'prod' {
  switch (window.location.hostname) {
    case 'slimsim.github.io':
    case 'beta.troff.app':
      return 'test';
    case 'troff.app':
    case 'ios.troff.app':
    case 'troff.slimsim.heliohost.org':
    case 'troff.ternsjo-it.heliohost.us':
      return 'prod';
    default:
      return 'dev';
  }
}

// Bootstrap PWA install/update handling (registers the service worker on load,
// surfaces the install prompt and notifies the user of new versions).
initPwa({
  onFirstInstall: () =>
    showToast('Troff is now cached and will work offline. Have fun!', 'success'),
  onNewVersionAvailable: () =>
    showToast(
      'A new version of Troff is available. Please reload to start using it!',
      'info',
      8000,
      {
        label: 'Reload',
        onClick: () => window.location.reload(),
      }
    ),
});

// The media element currently playing (audio singleton, or the #videoElement when
// a video song is loaded). Defaults to audio so audio-only playback is unchanged.
let activeMedia: HTMLMediaElement = audio;
const getActiveMedia = () => activeMedia;

const tempoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
  openMarkerDialog?: () => void;
};

type ImportExportDialogElement = HTMLElement & {
  open: boolean;
  exportData: TroffManualImportExport | null;
  addEventListener(
    type: 'import-requested' | 'dialog-cancelled',
    listener: (ev: CustomEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener(
    type: 'import-requested' | 'dialog-cancelled',
    listener: (ev: CustomEvent) => void,
    options?: boolean | EventListenerOptions
  ): void;
};

type MarkerToolsDialogElement = HTMLElement & {
  open: boolean;
  mode: 'copy' | 'move' | 'delete' | 'stretch';
  nrOfSelectedMarkers: number;
  initialTime: number;
  totalMarkers: number;
  addEventListener(
    type: 'marker-tools-action' | 'dialog-cancelled',
    listener: (ev: CustomEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener(
    type: 'marker-tools-action' | 'dialog-cancelled',
    listener: (ev: CustomEvent) => void,
    options?: boolean | EventListenerOptions
  ): void;
};

interface VideoPlayerWithMarkerProps {
  markers: TroffMarker[];
  startMarkerId: string;
  speed?: number;
}

// Function to update marker slider with current song markers
const updateMarkerSlider = (markerSlider: MarkerSlider, setAudioTime: boolean = true) => {
  console.log('updateMarkerSlider -> setAudioTime:', setAudioTime);
  const currentSongMetadata = getCurrentSongMetadata();
  const songDuration =
    getActiveMedia().duration > 0 ? getActiveMedia().duration : currentSongMetadata?.duration || 0;
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
    const videoPlayerEl = document.getElementById('videoPlayer') as
      | (HTMLElement & VideoPlayerWithMarkerProps)
      | null;
    // Only feed the video player when it is actually shown (a video song is
    // loaded): it starts hidden and gains `hidden = false` once the video
    // finishes loading.
    if (videoPlayerEl && !videoPlayerEl.hidden) {
      videoPlayerEl.markers = markers;
      videoPlayerEl.startMarkerId = markerSlider.startMarkerId;
      const defaultSpeed =
        Number(nDB.get(TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_SPEED_VALUE)) || 100;
      const storedSpeed = Number(currentSongData?.TROFF_VALUE_speedBar);
      videoPlayerEl.speed =
        Number.isFinite(storedSpeed) && storedSpeed > 0 ? storedSpeed : defaultSpeed;
    }
    markerSlider.min = 0;
    markerSlider.max = songDuration;
    markerSlider.unit = 's';
    if (setAudioTime) {
      console.log('markerSlider.getPlaybackStart()', markerSlider.getPlaybackStart());
      console.log('markerSlider.startMarkerId', markerSlider.startMarkerId);
      setTimeout(() => {
        console.log('markerSlider.getPlaybackStart()', markerSlider.getPlaybackStart());
        console.log('markerSlider.startMarkerId', markerSlider.startMarkerId);
      }, 30);

      getActiveMedia().currentTime = markerSlider.getPlaybackStart();
    }

    configureMarkerSlider(markerSlider, currentSongData);
  } else if (markerSlider) {
    // No song selected, use default state
    markerSlider.markers = [];
    const videoPlayerEl = document.getElementById('videoPlayer') as
      | (HTMLElement & VideoPlayerWithMarkerProps)
      | null;
    if (videoPlayerEl && !videoPlayerEl.hidden) {
      videoPlayerEl.markers = [];
      videoPlayerEl.startMarkerId = '';
      videoPlayerEl.speed = 100;
    }
    markerSlider.min = 0;
    markerSlider.max = 0;
    markerSlider.unit = '';
    markerSlider.value = 0;
    if (setAudioTime) {
      getActiveMedia().currentTime = 0;
    }
  }
};

/** Record a song start: increment nrTimesLoaded and save a timestamp for the month badge */
function recordSongStart(songKey: string): void {
  const songData = nDB.get(songKey);
  if (!songData) return;
  const localInfo = songData.localInformation || {};

  // Increment total play count
  const nrTimesLoaded = localInfo.nrTimesLoaded || 0;
  nDB.setOnSong(songKey, ['localInformation', 'nrTimesLoaded'], nrTimesLoaded + 1);

  // Track song starts for last-30-days count
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const songStarts = (localInfo.songStartsLastMonth || []).filter(
    (t: number) => now - t < thirtyDaysMs
  );
  songStarts.push(now);
  nDB.setOnSong(songKey, ['localInformation', 'songStartsLastMonth'], songStarts);
}

/**
 * Set or clear the URL hash to show the current song.
 * When a `serverId` exists (song was uploaded/downloaded from server),
 * the hash is `#serverId&encodedSongKey` so the URL can be shared.
 * When called with no serverId, the hash is cleared (markers/settings changed).
 */
const setUrlToSong = (serverId: string | number | undefined, songKey: string | null) => {
  if (serverId === undefined) {
    if (!window.location.hash) {
      return;
    }
    // Remove URL hash completely:
    history.pushState('', document.title, window.location.pathname + window.location.search);
    return;
  }
  if (songKey === null) {
    return;
  }
  window.location.hash = '#' + String(serverId) + '&' + encodeURIComponent(songKey);
};

// Initialize components and set up event listeners

document.addEventListener('DOMContentLoaded', () => {
  // Sentry observability — mirrors script.ts initEnvironment without legacy
  // imports. Tag every event with app: 'v2' unconditionally, then set env,
  // version, and init once consent has been given.
  setSentryApp('v2');
  setSentryEnvironment(getSentryEnvironment());
  void getManifest()
    .then((manifest) => {
      setSentryVersion(manifest.version);
      // Consent key is defined in assets/internal/cookie_consent.ts (legacy);
      // checked directly so v2 doesn't import that file.
      if (localStorage.getItem('TROFF_COOKIE_CONSENT_ACCEPTED') === 'true') {
        addAndStartSentry();
      }
    })
    .catch((error) => {
      log.w('Sentry init skipped (manifest fetch failed):', error);
    });
  const footer = document.getElementById('footer') as FooterElement | null;
  const settingsPanel = document.getElementById('settingsPanel') as any;
  const currentSongControls = document.getElementById('currentSongControls') as any;
  const header = document.getElementById('header') as any;
  const songList = document.getElementById('songList') as any;
  const markerSlider = document.getElementById('markerSlider') as MarkerSlider;
  const videoPlayer = document.getElementById('videoPlayer') as
    | (HTMLElement & VideoPlayerWithMarkerProps)
    | null;
  const videoElement = document.getElementById('videoElement') as HTMLVideoElement | null;
  let pendingPlaybackStart: number | undefined;
  let playbackCountdownInterval: number | undefined;
  let isLoopTransitionPause = false;
  let configuredLoopTimes = 1;
  let loopTimesLeft = 1;

  // Current auth state, kept in sync by the onAuthStateChanged callback below
  let currentUserSignedIn = false;
  let currentUserEmail = '';

  // Load a song from the cache and route it to the audio element or the video
  // element depending on whether the cached file is a video.
  const loadSongIntoPlayer = async (songKey: string) => {
    const result = await loadSong(songKey);
    if (!result) return;
    if (result.isVideo) {
      activeMedia = videoElement ?? audio;
      if (videoElement) {
        videoElement.src = result.url;
        videoElement.load();
        // keep volume/rate in sync with what the user has set on audio
        videoElement.volume = audio.volume;
        videoElement.playbackRate = audio.playbackRate;
      }
      if (videoPlayer) videoPlayer.hidden = false;
    } else {
      activeMedia = audio;
      audio.src = result.url;
      audio.load();
      if (videoPlayer) videoPlayer.hidden = true;
      if (videoElement) videoElement.pause();
    }
  };

  // Responsive placement: video player sits at the top on narrow screens and
  // moves into the sidebar on wide screens.
  const mq = window.matchMedia('(min-width: 768px)');
  const applyVideoPlacement = () => {
    if (videoPlayer) {
      videoPlayer.slot = mq.matches ? 'video-sidebar' : 'video-top';
    }
  };
  mq.addEventListener('change', applyVideoPlacement);
  applyVideoPlacement();

  const withSafeNumber = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const getTimelineDuration = () => {
    const durationFromSlider = withSafeNumber(markerSlider?.max, 0);
    if (durationFromSlider > 0) {
      return durationFromSlider;
    }

    const durationFromAudio = withSafeNumber(getActiveMedia().duration, 0);
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

  const handleImportExport = async () => {
    const songKey = getCurrentSongKey();
    if (!songKey) {
      return;
    }

    const songData = nDB.get(songKey) || {};

    // Ensure import/export dialog exists (create lazily like group dialog)
    let importExportDialog = document.querySelector(
      't-import-export-dialog'
    ) as ImportExportDialogElement | null;
    if (!importExportDialog) {
      importExportDialog = document.createElement(
        't-import-export-dialog'
      ) as ImportExportDialogElement;
      document.body.append(importExportDialog);
    }

    // Prepare export data
    const markers: TroffMarker[] = Array.isArray(songData.markers) ? songData.markers : [];
    const states: string[] = Array.isArray(songData.aStates) ? songData.aStates : [];
    const songInfo: string = songData.info || '';

    // Convert states from marker IDs to marker times (for portability)
    const statesWithTimes: State_WithTime[] = states.map((stateStr) => {
      try {
        const state = JSON.parse(stateStr) as State;
        const { currentMarker, currentStopMarker, ...rest } = state;
        const newState: State_WithTime = { ...rest };

        // Find marker by ID and get its time
        const startMarker = markers.find((m) => m.id === currentMarker);
        if (startMarker) {
          newState.currentMarkerTime = startMarker.time;
        }

        const stopMarker = markers.find(
          (m) => m.id === (currentStopMarker?.replace('S', '') || '')
        );
        if (stopMarker) {
          newState.currentStopMarkerTime = stopMarker.time;
        }

        return newState;
      } catch {
        // If parsing fails, return a minimal state with times
        return {
          name: 'Imported State',
          currentMarkerTime: 0,
          currentStopMarkerTime: 0,
          buttStartBefore: false,
          buttStopAfter: false,
          buttPauseBefStart: false,
          buttWaitBetweenLoops: false,
          buttIncrementUntil: false,
          currentLoop: '1',
          pauseBeforeStart: 0,
          speedBar: 100,
          startBefore: 0,
          stopAfter: 0,
          volumeBar: 75,
          waitBetweenLoops: 0,
        } as State_WithTime;
      }
    });

    const exportData: TroffManualImportExport = {
      strSongInfo: songInfo,
      aoMarkers: markers,
      aoStates: statesWithTimes,
    };

    // Set export data and open dialog
    importExportDialog.exportData = exportData;
    importExportDialog.open = true;

    // Handle dialog events (one-time listeners)
    const handleImportRequested = async (event: CustomEvent) => {
      const { data, mode } = event.detail as {
        data: TroffManualImportExport;
        mode: 'replace' | 'merge';
      };

      try {
        let finalMarkers: TroffMarker[];

        // Clamp imported marker times to the song duration so they never land
        // outside the song (no song duration -> only clamp below 0)
        const maxTime = getTimelineDuration() > 0 ? getTimelineDuration() : Infinity;

        if (mode === 'replace') {
          finalMarkers = data.aoMarkers.map((m) => ({
            ...m,
            time: normalizeMarkerTime(m.time, maxTime),
          }));
        } else {
          // Merge with existing: an imported marker within 0.001 s of an existing marker
          // is merged into it (legacy threshold scriptTroffClass.ts:2310); the rest get
          // new unique ids.
          finalMarkers = mergeImportedMarkers(
            Array.isArray(songData.markers) ? songData.markers : [],
            data.aoMarkers,
            maxTime
          );
        }

        // Convert states back from times to marker IDs
        const newStates: string[] = data.aoStates.map((stateWithTime) => {
          // Find closest markers for the times
          const startTime = stateWithTime.currentMarkerTime ?? 0;
          const stopTime = stateWithTime.currentStopMarkerTime ?? 0;

          let startMarkerId = finalMarkers[0]?.id || 'markerNr0';
          let stopMarkerId = finalMarkers[1]?.id || 'markerNr1';

          let minStartDiff = Infinity;
          let minStopDiff = Infinity;

          for (const marker of finalMarkers) {
            const markerTime = Number(marker.time);
            const startDiff = Math.abs(markerTime - startTime);
            const stopDiff = Math.abs(markerTime - stopTime);

            if (startDiff < minStartDiff) {
              minStartDiff = startDiff;
              startMarkerId = marker.id;
            }
            if (stopDiff < minStopDiff) {
              minStopDiff = stopDiff;
              stopMarkerId = marker.id;
            }
          }

          const state: State = {
            name: stateWithTime.name || 'Imported State',
            currentMarker: startMarkerId,
            currentStopMarker: stopMarkerId + 'S',
            buttStartBefore: stateWithTime.buttStartBefore ?? false,
            buttStopAfter: stateWithTime.buttStopAfter ?? false,
            buttPauseBefStart: stateWithTime.buttPauseBefStart ?? false,
            buttWaitBetweenLoops: stateWithTime.buttWaitBetweenLoops ?? false,
            buttIncrementUntil: stateWithTime.buttIncrementUntil ?? false,
            currentLoop: stateWithTime.currentLoop || '1',
            pauseBeforeStart: stateWithTime.pauseBeforeStart ?? 0,
            speedBar: stateWithTime.speedBar ?? 100,
            startBefore: stateWithTime.startBefore ?? 0,
            stopAfter: stateWithTime.stopAfter ?? 0,
            volumeBar: stateWithTime.volumeBar ?? 75,
            waitBetweenLoops: stateWithTime.waitBetweenLoops ?? 0,
          };

          return JSON.stringify(state);
        });

        // Save to nDB
        nDB.setOnSong(songKey, 'markers', finalMarkers);
        nDB.setOnSong(songKey, 'aStates', newStates);
        nDB.setOnSong(songKey, 'info', data.strSongInfo || '');

        // Update marker slider
        updateMarkerSlider(markerSlider!, false);

        // Replace mode invalidated the previous selection — reselect first/last
        if (mode === 'replace') {
          selectFirstAndLastMarkers();
        }

        // Sync UI
        syncSettingsPanelValues();
        syncCurrentSongControlsValues();

        // Save to Firebase if applicable
        await saveSongData(songKey);
      } catch (error) {
        log.e('Import failed:', error);
        alert('Import failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    };

    // Add one-time event listeners
    importExportDialog.addEventListener('import-requested', handleImportRequested, { once: true });
    importExportDialog.addEventListener(
      'dialog-cancelled',
      () => {
        importExportDialog.removeEventListener('import-requested', handleImportRequested);
      },
      { once: true }
    );
  };

  const openShareSongDialog = () => {
    const songKey = getCurrentSongKey();
    if (!songKey) {
      showToast(
        'You do not have a song to upload yet. Add a song to Troff and then try again!',
        'error'
      );
      return;
    }
    if (!navigator.onLine) {
      showToast(
        'You appear to be offline, please wait until you have an internet connection and try again then.',
        'error'
      );
      return;
    }

    let shareDialog = document.querySelector('t-share-song-dialog') as ShareSongDialog | null;
    if (!shareDialog) {
      shareDialog = document.createElement('t-share-song-dialog');
      document.body.append(shareDialog);
    }
    shareDialog.songName = songKey;

    if (window.location.hash) {
      shareDialog.alreadyUploaded = true;
      shareDialog.shareUrl = window.location.href;
      shareDialog.state = 'done';
      shareDialog.open = true;
      return;
    }

    shareDialog.alreadyUploaded = false;
    shareDialog.state = 'confirm';
    shareDialog.open = true;

    const handleShareConfirmed = async () => {
      shareDialog.removeEventListener('dialog-cancelled', handleShareDialogCancelled);
      shareDialog.state = 'uploading';
      shareDialog.progress = 0;
      const { uploadSongToServer, buildShareUrl } = await import('./utils/upload-song.js');
      const result = await uploadSongToServer(songKey, (percent) => {
        shareDialog.progress = percent;
      });
      if (!result) {
        shareDialog.removeEventListener('share-confirmed', handleShareConfirmed);
        shareDialog.open = false;
        showToast('Upload failed. Please try again.', 'error');
        return;
      }
      setUrlToSong(result.id, result.fileName); // existing local function in v2Script
      shareDialog.shareUrl = buildShareUrl(result.id, result.fileName);
      shareDialog.state = 'done';
    };

    const handleShareDialogCancelled = () => {
      shareDialog.removeEventListener('share-confirmed', handleShareConfirmed);
    };

    shareDialog.addEventListener('share-confirmed', handleShareConfirmed, { once: true });
    shareDialog.addEventListener('dialog-cancelled', handleShareDialogCancelled, { once: true });
  };

  const openMarkerToolsDialog = (action: string) => {
    const songKey = getCurrentSongKey();
    if (!songKey) {
      return;
    }

    const songData = nDB.get(songKey) || {};
    const markers: TroffMarker[] = Array.isArray(songData.markers) ? songData.markers : [];

    // Ensure marker tools dialog exists (create lazily like the group dialog)
    let markerToolsDialog = document.querySelector(
      't-marker-tools-dialog'
    ) as MarkerToolsDialogElement | null;
    if (!markerToolsDialog) {
      markerToolsDialog = document.createElement(
        't-marker-tools-dialog'
      ) as MarkerToolsDialogElement;
      document.body.append(markerToolsDialog);
    }

    const modeByAction: Record<string, 'copy' | 'move' | 'delete' | 'stretch'> = {
      copyMarkers: 'copy',
      moveMarkers: 'move',
      deleteMarkers: 'delete',
      stretchMarkers: 'stretch',
    };

    const [startNr, endNr] = getSelectedMarkerRange(
      markers,
      markerSlider.startMarkerId,
      markerSlider.stopMarkerId
    );

    markerToolsDialog.mode = modeByAction[action] ?? 'copy';
    markerToolsDialog.nrOfSelectedMarkers = endNr - startNr;
    markerToolsDialog.totalMarkers = markers.length;
    markerToolsDialog.initialTime = getActiveMedia().currentTime;
    markerToolsDialog.open = true;

    // Handle dialog events (one-time listeners)
    const handleMarkerToolsAction = (event: CustomEvent) => {
      markerToolsDialog.removeEventListener('dialog-cancelled', handleDialogCancelled);
      const { action: dialogAction, value } = event.detail as {
        action: string;
        value?: number;
      };
      applyMarkerToolsAction(dialogAction, value);
    };

    const handleDialogCancelled = () => {
      markerToolsDialog.removeEventListener('marker-tools-action', handleMarkerToolsAction);
    };

    markerToolsDialog.addEventListener('marker-tools-action', handleMarkerToolsAction, {
      once: true,
    });
    markerToolsDialog.addEventListener('dialog-cancelled', handleDialogCancelled, { once: true });
  };

  const applyMarkerToolsAction = (dialogAction: string, value?: number) => {
    const songKey = getCurrentSongKey();
    if (!songKey) {
      return;
    }

    try {
      const songData = nDB.get(songKey) || {};
      const markers: TroffMarker[] = Array.isArray(songData.markers) ? songData.markers : [];
      const maxTime = markerSlider?.max ?? getActiveMedia().duration ?? 0;
      const [startNr, endNr] = getSelectedMarkerRange(
        markers,
        markerSlider.startMarkerId,
        markerSlider.stopMarkerId
      );

      let result: TroffMarker[];
      switch (dialogAction) {
        case 'copy':
          result = copyMarkers(markers, value ?? 0, startNr, endNr, maxTime);
          break;
        case 'moveUp':
          result = moveMarkers(markers, -(value ?? 0), startNr, endNr, maxTime);
          break;
        case 'moveDown':
          result = moveMarkers(markers, value ?? 0, startNr, endNr, maxTime);
          break;
        case 'moveAllUp':
          result = moveMarkers(markers, -(value ?? 0), 0, markers.length, maxTime);
          break;
        case 'moveAllDown':
          result = moveMarkers(markers, value ?? 0, 0, markers.length, maxTime);
          break;
        case 'deleteSelected':
          result = deleteMarkers(markers, startNr, endNr);
          break;
        case 'deleteAll':
          // v1 behavior: keeps the first and last marker
          result = deleteMarkers(markers, 1, markers.length - 1);
          break;
        case 'stretchSelected':
          result = stretchMarkers(
            markers,
            value ?? 100,
            Number(markers[startNr]?.time ?? 0),
            startNr,
            endNr,
            maxTime
          );
          break;
        case 'stretchAll':
          result = stretchMarkers(markers, value ?? 100, 0, 0, markers.length, maxTime);
          break;
        default:
          return;
      }

      // Save result
      nDB.setOnSong(songKey, 'markers', result);

      // Update marker slider and UI
      updateMarkerSlider(markerSlider, false);
      syncSettingsPanelValues();
      syncCurrentSongControlsValues();

      // Save to Firebase if applicable
      void saveSongData(songKey);
    } catch (error) {
      log.e('Marker tools action failed:', error);
    }
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

  const selectFirstAndLastMarkers = (force: boolean = false) => {
    const songKey = getCurrentSongKey();
    if (!songKey) {
      return;
    }

    const songData = nDB.get(songKey) || {};
    const songDuration = getActiveMedia().duration > 0 ? getActiveMedia().duration : 0;
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

    const knownMarkerIds = new Set(markers.map((m) => String(m.id)));

    // Preserve existing start marker if it still exists (unless forced)
    if (!force && songData.currentStartMarker && knownMarkerIds.has(songData.currentStartMarker)) {
      markerSlider.startMarkerId = songData.currentStartMarker;
    } else {
      const firstMarkerId = String(markers[0].id);
      songData.currentStartMarker = firstMarkerId;
      markerSlider.startMarkerId = firstMarkerId;
    }

    // Preserve existing stop marker if it still exists (unless forced)
    const stopIdWithoutS = songData.currentStopMarker?.replace(/S$/, '');
    if (
      !force &&
      songData.currentStopMarker &&
      stopIdWithoutS &&
      knownMarkerIds.has(stopIdWithoutS)
    ) {
      markerSlider.stopMarkerId = songData.currentStopMarker;
    } else {
      const lastMarkerId = String(markers[markers.length - 1].id);
      songData.currentStopMarker = `${lastMarkerId}S`;
      markerSlider.stopMarkerId = `${lastMarkerId}S`;
    }

    nDB.set(songKey, songData);
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

    if (!getActiveMedia().paused) {
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
    settingsPanel.songStates = songKey && songData && Array.isArray(songData.aStates) ? songData.aStates : [];
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
    settingsPanel.enterGoToMarker = nDB.get(TROFF_SETTING_ENTER_GO_TO_MARKER_BEHAVIOUR) === true;
    settingsPanel.spaceUseTimer = nDB.get(TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR) === true;
    settingsPanel.spaceResetCounter = nDB.get(TROFF_SETTING_SPACE_RESET_COUNTER) === true;
    settingsPanel.spaceGoToMarker = nDB.get(TROFF_SETTING_SPACE_GO_TO_MARKER_BEHAVIOUR) === true;
    settingsPanel.playUseTimer = nDB.get(TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR) === true;
    settingsPanel.playResetCounter = nDB.get(TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER) === true;
    settingsPanel.playGoToMarker =
      nDB.get(TROFF_SETTING_PLAY_UI_BUTTON_GO_TO_MARKER_BEHAVIOUR) === true;
    const extendedColorSetting = nDB.get(TROFF_SETTING_EXTENDED_MARKER_COLOR);
    const extraExtendedColorSetting = nDB.get(TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR);
    settingsPanel.extendedMarkerColor = extendedColorSetting === true;
    settingsPanel.extraExtendedMarkerColor =
      (extendedColorSetting === null && extraExtendedColorSetting === null) ||
      extraExtendedColorSetting === true;

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

  const syncCurrentSongControlsValues = () => {
    if (!currentSongControls) {
      return;
    }

    const songKey = getCurrentSongKey();
    const songData = songKey ? nDB.get(songKey) : null;
    const rawLoopTimes =
      songData?.loopTimes !== undefined ? songData.loopTimes : getDefaultLoopTimesValue();
    const configuredLoops = parseConfiguredLoopTimes(rawLoopTimes);

    currentSongControls.loopTimesValue = Number.isFinite(configuredLoops)
      ? String(configuredLoops)
      : 'Inf';

    // Load song-specific numeric settings and their disabled states.
    // Disabled state must be set BEFORE value so the t-dial knows its disabled
    // state when receiving the new value (for correct display).
    if (songKey && songData) {
      if (songData.TROFF_CLASS_TO_TOGGLE_buttStartBefore === undefined) {
        const globalStartBeforeOn = nDB.get(TROFF_SETTING_SONG_DEFAULT_START_BEFORE_ON) ?? false;
        currentSongControls.startBeforeDisabled = !globalStartBeforeOn;
      } else {
        currentSongControls.startBeforeDisabled =
          songData.TROFF_CLASS_TO_TOGGLE_buttStartBefore === false;
      }
      currentSongControls.startBeforeValue = getStartBefore(songData);
      if (songData.TROFF_CLASS_TO_TOGGLE_buttStopAfter === undefined) {
        const globalStopAfterOn = nDB.get(TROFF_SETTING_SONG_DEFAULT_STOP_AFTER_ON) ?? false;
        currentSongControls.stopAfterDisabled = !globalStopAfterOn;
      } else {
        currentSongControls.stopAfterDisabled =
          songData.TROFF_CLASS_TO_TOGGLE_buttStopAfter === false;
      }
      currentSongControls.stopAfterValue = getStopAfter(songData);
      if (songData.TROFF_CLASS_TO_TOGGLE_buttIncrementUntil === undefined) {
        const globalIncrementUntilOn =
          nDB.get(TROFF_SETTING_SONG_DEFAULT_INCREMENT_UNTIL_ON) ?? false;
        currentSongControls.incrementUntillDisabled = !globalIncrementUntilOn;
      } else {
        currentSongControls.incrementUntillDisabled =
          songData.TROFF_CLASS_TO_TOGGLE_buttIncrementUntil !== true;
      }
      currentSongControls.incrementUntillValue = getIncrementUntil(songData);

      // Sync playback controls (pause before, wait between, volume, speed)
      const parseStoredNumber = (value: unknown, fallback: number) => {
        const parsedValue = Number(value);
        return Number.isFinite(parsedValue) ? parsedValue : fallback;
      };
      currentSongControls.pauseBefore = parseStoredNumber(
        songData.TROFF_VALUE_pauseBeforeStart,
        Number(nDB.get('TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_PAUSE_BEFORE_VALUE')) || 3
      );
      currentSongControls.waitBetween = parseStoredNumber(
        songData.TROFF_VALUE_waitBetweenLoops,
        Number(nDB.get('TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_WAIT_BETWEEN_VALUE')) || 1
      );
      currentSongControls.volume = parseStoredNumber(
        songData.TROFF_VALUE_volumeBar,
        Number(nDB.get('TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_VOLUME_VALUE')) || 75
      );
      currentSongControls.speed = parseStoredNumber(
        songData.TROFF_VALUE_speedBar,
        Number(nDB.get('TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_SPEED_VALUE')) || 100
      );
      currentSongControls.tempo = parseStoredNumber(songData.TROFF_VALUE_tapTempo, 0);
      if (songData.TROFF_CLASS_TO_TOGGLE_buttPauseBefStart === undefined) {
        const globalPauseBeforeOn = nDB.get('TROFF_SETTING_SONG_DEFAULT_PAUSE_BEFORE_ON') ?? true;
        currentSongControls.disablePauseBefore = !globalPauseBeforeOn;
      } else {
        currentSongControls.disablePauseBefore = !songData.TROFF_CLASS_TO_TOGGLE_buttPauseBefStart;
      }
      if (songData.TROFF_CLASS_TO_TOGGLE_buttWaitBetweenLoops === undefined) {
        const globalWaitBetweenOn = nDB.get('TROFF_SETTING_SONG_DEFAULT_WAIT_BETWEEN_ON') ?? true;
        currentSongControls.disableWaitBetween = !globalWaitBetweenOn;
      } else {
        currentSongControls.disableWaitBetween =
          !songData.TROFF_CLASS_TO_TOGGLE_buttWaitBetweenLoops;
      }
    } else {
      currentSongControls.startBeforeValue = 0;
      currentSongControls.startBeforeDisabled = false;
      currentSongControls.stopAfterValue = 0;
      currentSongControls.stopAfterDisabled = false;
      currentSongControls.incrementUntillValue = 0;
      currentSongControls.incrementUntillDisabled = false;
      currentSongControls.pauseBefore = 3;
      currentSongControls.waitBetween = 1;
      currentSongControls.volume = 75;
      currentSongControls.speed = 100;
      currentSongControls.tempo = 0;
      currentSongControls.disablePauseBefore = false;
      currentSongControls.disableWaitBetween = false;
    }

    // Also sync the settings panel's instance (visible on mobile when sidebar is hidden)
    const settingsControls =
      (settingsPanel?.shadowRoot?.querySelector('#settingsCurrentSongControls') as any) ?? null;
    if (settingsControls) {
      settingsControls.loopTimesValue = currentSongControls.loopTimesValue;
      settingsControls.startBeforeDisabled = currentSongControls.startBeforeDisabled;
      settingsControls.startBeforeValue = currentSongControls.startBeforeValue;
      settingsControls.stopAfterDisabled = currentSongControls.stopAfterDisabled;
      settingsControls.stopAfterValue = currentSongControls.stopAfterValue;
      settingsControls.incrementUntillDisabled = currentSongControls.incrementUntillDisabled;
      settingsControls.incrementUntillValue = currentSongControls.incrementUntillValue;
      settingsControls.pauseBefore = currentSongControls.pauseBefore;
      settingsControls.waitBetween = currentSongControls.waitBetween;
      settingsControls.volume = currentSongControls.volume;
      settingsControls.speed = currentSongControls.speed;
      settingsControls.tempo = currentSongControls.tempo;
      settingsControls.disablePauseBefore = currentSongControls.disablePauseBefore;
      settingsControls.disableWaitBetween = currentSongControls.disableWaitBetween;
    }

    // Also push tempo onto the settings panel host so the template binding
    // carries it to the internal instance even when that instance renders later.
    if (settingsPanel) {
      settingsPanel.tempo = currentSongControls.tempo;
    }
  };

  // Apply the stored per-song volume/speed to the actual media elements so a
  // song does not play at 100 % until the user touches a slider (issue #38).
  const applyStoredVolumeAndSpeedToMedia = () => {
    const songKey = getCurrentSongKey();
    const songData = songKey ? nDB.get(songKey) : null;
    if (!songData) {
      return;
    }
    const storedVolume = withSafeNumber(
      songData.TROFF_VALUE_volumeBar,
      Number(nDB.get(TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_VOLUME_VALUE)) || 75
    );
    const storedSpeed = withSafeNumber(
      songData.TROFF_VALUE_speedBar,
      Number(nDB.get(TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_SPEED_VALUE)) || 100
    );
    audio.volume = Math.max(0, Math.min(1, storedVolume / 100));
    if (videoElement) {
      videoElement.volume = audio.volume;
    }
    if (storedSpeed > 0) {
      audio.playbackRate = storedSpeed / 100;
      if (videoElement) {
        videoElement.playbackRate = audio.playbackRate;
      }
      if (videoPlayer) {
        (videoPlayer as { speed?: number }).speed = storedSpeed;
      }
    }
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

      if (
        shadowActiveElement instanceof HTMLElement &&
        isEditableHostElement(shadowActiveElement)
      ) {
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
      getActiveMedia().play().catch(console.error);
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
      getActiveMedia()
        .play()
        .catch((error) => {
          clearPendingPlaybackStart();
          console.error(error);
        });
    }, delay);
  };

  const shouldResetLoopCounter = (settingKey: string) => nDB.get(settingKey) === true;

  const startPlayback = (
    timerSettingKey: string,
    resetCounterSettingKey: string,
    goToMarkerSettingKey?: string
  ) => {
    if (pendingPlaybackStart !== undefined) {
      if (shouldResetLoopCounter(resetCounterSettingKey)) {
        resetLoopTimesCounter();
      }
      clearPendingPlaybackStart();
      updateHeaderCountdownDisplay();
      return;
    }

    if (!getActiveMedia().paused) {
      if (shouldResetLoopCounter(resetCounterSettingKey)) {
        resetLoopTimesCounter();
      }
      getActiveMedia().pause();
      updateHeaderCountdownDisplay();
      return;
    }

    // If "go to marker" is enabled, seek to the start marker time before playing
    if (goToMarkerSettingKey && nDB.get(goToMarkerSettingKey) === true) {
      const startTime = markerSlider.getPlaybackStart();
      if (Number.isFinite(startTime)) {
        getActiveMedia().currentTime = startTime;
      }
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
      startPlayback(
        TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR,
        TROFF_SETTING_ENTER_RESET_COUNTER,
        TROFF_SETTING_ENTER_GO_TO_MARKER_BEHAVIOUR
      );
      return;
    }

    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      event.stopPropagation();
      startPlayback(
        TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR,
        TROFF_SETTING_SPACE_RESET_COUNTER,
        TROFF_SETTING_SPACE_GO_TO_MARKER_BEHAVIOUR
      );
    }
  };

  document.addEventListener('keydown', handlePlaybackKeyDown, true);

  // Set CSS variables for header and footer heights (simple one-time calculation)
  const setComponentHeights = () => {
    if (typeof document === 'undefined') return;
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

  const rememberCurrentState = () => {
    const songKey = getCurrentSongKey();
    if (!songKey) {
      return;
    }
    const songData = nDB.get(songKey) || {};
    const existingStates: string[] = Array.isArray(songData.aStates) ? songData.aStates : [];
    const suggested = 'State ' + (existingStates.length + 1);
    const name = window.prompt('Remember state of settings to be recalled later', suggested);
    if (!name || name.trim() === '') {
      return;
    }
    const parseNum = (v: unknown, fb: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fb;
    };
    const state: State = {
      name: name.trim(),
      currentMarker: markerSlider ? markerSlider.startMarkerId : (songData.currentStartMarker || ''),
      currentStopMarker: markerSlider ? markerSlider.stopMarkerId : (songData.currentStopMarker || ''),
      currentLoop: songData.loopTimes !== undefined ? songData.loopTimes : '1',
      buttPauseBefStart: songData.TROFF_CLASS_TO_TOGGLE_buttPauseBefStart !== false,
      buttStartBefore: songData.TROFF_CLASS_TO_TOGGLE_buttStartBefore !== false,
      buttStopAfter: songData.TROFF_CLASS_TO_TOGGLE_buttStopAfter !== false,
      buttWaitBetweenLoops: songData.TROFF_CLASS_TO_TOGGLE_buttWaitBetweenLoops !== false,
      buttIncrementUntil: songData.TROFF_CLASS_TO_TOGGLE_buttIncrementUntil === true,
      pauseBeforeStart: parseNum(songData.TROFF_VALUE_pauseBeforeStart, parseNum(footer?.pauseBefore, 3)),
      speedBar: parseNum(songData.TROFF_VALUE_speedBar, parseNum(footer?.speed, 100)),
      startBefore: parseNum(songData.TROFF_VALUE_startBefore, 0),
      stopAfter: parseNum(songData.TROFF_VALUE_stopAfter, 0),
      volumeBar: parseNum(songData.TROFF_VALUE_volumeBar, parseNum(footer?.volume, 75)),
      waitBetweenLoops: parseNum(songData.TROFF_VALUE_waitBetweenLoops, parseNum(footer?.waitBetween, 1)),
    };
    const aStates: string[] = existingStates.slice();
    aStates.push(JSON.stringify(state));
    nDB.setOnSong(songKey, 'aStates', aStates);
    void saveSongData(songKey);
    syncSettingsPanelValues();
    syncCurrentSongControlsValues();
    if (markerSlider) {
      updateMarkerSlider(markerSlider);
    }
  };

  const setState = (index: number) => {
    const songKey = getCurrentSongKey();
    if (!songKey) {
      return;
    }
    const songData: Record<string, unknown> = nDB.get(songKey) || {};
    const aStates: string[] = Array.isArray(songData.aStates) ? (songData.aStates as string[]).slice() : [];
    if (index < 0 || index >= aStates.length) {
      return;
    }
    let state: State;
    try {
      state = JSON.parse(aStates[index]) as State;
    } catch {
      return;
    }
    songData.currentStartMarker = state.currentMarker || (songData.currentStartMarker as string) || '';
    songData.currentStopMarker = state.currentStopMarker || (songData.currentStopMarker as string) || '';
    if (state.currentLoop !== undefined) {
      songData.loopTimes = state.currentLoop;
    }
    songData.TROFF_CLASS_TO_TOGGLE_buttPauseBefStart = !!state.buttPauseBefStart;
    songData.TROFF_CLASS_TO_TOGGLE_buttStartBefore = !!state.buttStartBefore;
    songData.TROFF_CLASS_TO_TOGGLE_buttStopAfter = !!state.buttStopAfter;
    songData.TROFF_CLASS_TO_TOGGLE_buttWaitBetweenLoops = !!state.buttWaitBetweenLoops;
    songData.TROFF_CLASS_TO_TOGGLE_buttIncrementUntil = !!state.buttIncrementUntil;
    songData.TROFF_VALUE_pauseBeforeStart = state.pauseBeforeStart;
    songData.TROFF_VALUE_speedBar = state.speedBar;
    songData.TROFF_VALUE_startBefore = state.startBefore;
    songData.TROFF_VALUE_stopAfter = state.stopAfter;
    songData.TROFF_VALUE_volumeBar = state.volumeBar;
    songData.TROFF_VALUE_waitBetweenLoops = state.waitBetweenLoops;
    nDB.set(songKey, songData);
    const vol = Number(state.volumeBar);
    if (Number.isFinite(vol)) {
      audio.volume = Math.max(0, Math.min(1, vol / 100));
      if (videoElement) {
        videoElement.volume = audio.volume;
      }
    }
    const spd = Number(state.speedBar);
    if (Number.isFinite(spd) && spd > 0) {
      audio.playbackRate = spd / 100;
      if (videoElement) {
        videoElement.playbackRate = audio.playbackRate;
      }
      if (videoPlayer) {
        (videoPlayer as { speed?: number }).speed = spd;
      }
    }
    syncLoopTimesFromSong();
    syncSettingsPanelValues();
    syncCurrentSongControlsValues();
    updateFooterWithCurrentSong();
    updateHeaderCountdownDisplay();
    if (markerSlider) {
      updateMarkerSlider(markerSlider, false);
    }
  };

  const removeState = (index: number) => {
    const songKey = getCurrentSongKey();
    if (!songKey) {
      return;
    }
    const songData = nDB.get(songKey) || {};
    const aStates: string[] = Array.isArray(songData.aStates) ? (songData.aStates as string[]).slice() : [];
    if (index < 0 || index >= aStates.length) {
      return;
    }
    aStates.splice(index, 1);
    nDB.setOnSong(songKey, 'aStates', aStates);
    syncSettingsPanelValues();
    syncCurrentSongControlsValues();
    if (markerSlider) {
      updateMarkerSlider(markerSlider);
    }
  };

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
      console.log('Setting changed. setting:', setting, ' value:', value, 'songKey:', songKey);

      if (setting === 'playFullSong') {
        selectFirstAndLastMarkers(true);
        settingsPanel.playFullSong = false;
        if (currentSongControls) {
          currentSongControls.playFullSong = false;
        }
        return;
      }

      if (setting === 'startBefore' || setting === 'stopAfter' || setting === 'incrementUntill') {
        if (!songKey) {
          return;
        }

        const currentSongData = nDB.get(songKey) || {};
        if (setting === 'startBefore') {
          currentSongData.TROFF_VALUE_startBefore = value;
          // If startBefore is disabled, set the slider to 0 so the region doesn't extend
          markerSlider.startBefore = settingsPanel.startBeforeDisabled ? 0 : Number(value) || 0;
        }
        if (setting === 'stopAfter') {
          currentSongData.TROFF_VALUE_stopAfter = value;
          markerSlider.stopAfter = settingsPanel.stopAfterDisabled ? 0 : Number(value) || 0;
        }
        if (setting === 'incrementUntill') {
          currentSongData.TROFF_VALUE_incrementUntilValue = value;
        }

        nDB.set(songKey, currentSongData);
        markerSlider.requestUpdate();
        syncSettingsPanelValues();
        syncCurrentSongControlsValues();
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
          // Update the marker slider immediately: 0 when disabled, restore when enabled
          markerSlider.startBefore = value ? 0 : Number(settingsPanel.startBeforeValue) || 0;
        }
        if (setting === 'stopAfterDisabled') {
          currentSongData.TROFF_CLASS_TO_TOGGLE_buttStopAfter = !value;
          markerSlider.stopAfter = value ? 0 : Number(settingsPanel.stopAfterValue) || 0;
        }
        if (setting === 'incrementUntillDisabled') {
          currentSongData.TROFF_CLASS_TO_TOGGLE_buttIncrementUntil = !value;
        }

        nDB.set(songKey, currentSongData);
        markerSlider.requestUpdate();
        syncSettingsPanelValues();
        syncCurrentSongControlsValues();
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
        syncCurrentSongControlsValues();
        return;
      }

      if (setting === 'tempo') {
        if (!songKey) {
          return;
        }

        const currentSongData = nDB.get(songKey) || {};
        currentSongData.TROFF_VALUE_tapTempo = value;
        nDB.set(songKey, currentSongData);

        const existing = tempoSaveTimers.get(songKey);
        if (existing) {
          clearTimeout(existing);
        }
        const timer = setTimeout(() => {
          void saveSongData(songKey);
          tempoSaveTimers.delete(songKey);
        }, 900);
        tempoSaveTimers.set(songKey, timer);

        syncSettingsPanelValues();
        syncCurrentSongControlsValues();
        return;
      }

      // Handle playback controls (pause before, wait between, volume, speed)
      if (
        setting === 'pauseBefore' ||
        setting === 'waitBetween' ||
        setting === 'volume' ||
        setting === 'speed' ||
        setting === 'pauseBeforeDisabled' ||
        setting === 'waitBetweenDisabled'
      ) {
        if (!songKey) {
          return;
        }

        const currentSongData = nDB.get(songKey) || {};
        if (setting === 'pauseBefore') {
          currentSongData.TROFF_VALUE_pauseBeforeStart = value;
        }
        if (setting === 'waitBetween') {
          currentSongData.TROFF_VALUE_waitBetweenLoops = value;
        }
        if (setting === 'volume') {
          currentSongData.TROFF_VALUE_volumeBar = value;
          audio.volume = Number(value) / 100;
          if (videoElement) {
            videoElement.volume = Number(value) / 100;
          }
        }
        if (setting === 'speed') {
          currentSongData.TROFF_VALUE_speedBar = value;
          audio.playbackRate = Number(value) / 100;
          if (videoElement) {
            videoElement.playbackRate = Number(value) / 100;
          }
          if (videoPlayer) {
            videoPlayer.speed = Number(value);
          }
        }
        if (setting === 'pauseBeforeDisabled') {
          currentSongData.TROFF_CLASS_TO_TOGGLE_buttPauseBefStart = !value;
        }
        if (setting === 'waitBetweenDisabled') {
          currentSongData.TROFF_CLASS_TO_TOGGLE_buttWaitBetweenLoops = !value;
        }

        nDB.set(songKey, currentSongData);
        updateFooterWithCurrentSong();
        updateHeaderCountdownDisplay();
        syncSettingsPanelValues();
        syncCurrentSongControlsValues();
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
        enterGoToMarker: TROFF_SETTING_ENTER_GO_TO_MARKER_BEHAVIOUR,
        spaceUseTimer: TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR,
        spaceResetCounter: TROFF_SETTING_SPACE_RESET_COUNTER,
        spaceGoToMarker: TROFF_SETTING_SPACE_GO_TO_MARKER_BEHAVIOUR,
        playUseTimer: TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR,
        playResetCounter: TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER,
        playGoToMarker: TROFF_SETTING_PLAY_UI_BUTTON_GO_TO_MARKER_BEHAVIOUR,
        extendedMarkerColor: TROFF_SETTING_EXTENDED_MARKER_COLOR,
        extraExtendedMarkerColor: TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR,
      };

      const storageKey = settingsKeyByPanelSetting[setting];
      if (!storageKey) {
        return;
      }

      nDB.set(storageKey, value === true);
      syncSettingsPanelValues();
      syncCurrentSongControlsValues();

      if (setting === 'extendedMarkerColor' || setting === 'extraExtendedMarkerColor') {
        const songKey = getCurrentSongKey();
        const songData = songKey ? nDB.get(songKey) : null;
        configureMarkerSlider(markerSlider, songData);
        markerSlider.requestUpdate();
      }
    });

    settingsPanel.addEventListener('song-action-requested', async (event: Event) => {
      const customEvent = event as CustomEvent<{ action?: string; index?: number }>;
      const action = String(customEvent.detail?.action ?? '');
      const stateIndex = customEvent.detail?.index;

      if (action === 'rememberState') {
        rememberCurrentState();
        return;
      }

      if (action === 'setState' && typeof stateIndex === 'number') {
        setState(stateIndex);
        return;
      }

      if (action === 'removeState' && typeof stateIndex === 'number') {
        removeState(stateIndex);
        const songKey = getCurrentSongKey();
        if (songKey) {
          void saveSongData(songKey);
        }
        return;
      }

      if (action === 'zoom') {
        await zoomToPlayableRegion();
        return;
      }

      if (action === 'zoomOut') {
        await zoomOutTimeline();
      }

      if (action === 'importExport') {
        await handleImportExport();
      }

      if (action === 'shareSong') {
        openShareSongDialog();
        return;
      }

      if (
        action === 'copyMarkers' ||
        action === 'moveMarkers' ||
        action === 'deleteMarkers' ||
        action === 'stretchMarkers'
      ) {
        openMarkerToolsDialog(action);
      }
    });

    // Forward events from the sidebar current-song-controls to the settings panel,
    // so the existing handlers process them (single source of truth).
    if (currentSongControls) {
      currentSongControls.addEventListener('setting-changed', (event: Event) => {
        const detail = (event as CustomEvent).detail;
        settingsPanel.dispatchEvent(
          new CustomEvent('setting-changed', { detail, bubbles: true, composed: true })
        );
      });
      currentSongControls.addEventListener('song-action-requested', (event: Event) => {
        const detail = (event as CustomEvent).detail;
        settingsPanel.dispatchEvent(
          new CustomEvent('song-action-requested', { detail, bubbles: true, composed: true })
        );
      });
    }

    // Handle sign-in / sign-out requests from the settings panel and the song list
    const handleSignInRequest = async (event: Event) => {
      const customEvent = event as CustomEvent<{ action: string }>;
      const action = customEvent.detail?.action;

      try {
        // Ensure notify.js is loaded so cookie_consent doesn't enter an infinite retry loop
        await import('./assets/internal/notify-js/notify.config.js');
        const { auth, GoogleAuthProvider, signInWithPopup, signOut } = await import(
          './services/firebaseClient.js'
        );

        if (action === 'sign-in') {
          const provider = new GoogleAuthProvider();
          await signInWithPopup(auth, provider);
        } else if (action === 'sign-out') {
          await signOut(auth);
        }
      } catch (error) {
        log.e('Auth error:', error);
      }
    };

    settingsPanel.addEventListener('sign-in-requested', handleSignInRequest);
    songList?.addEventListener('sign-in-requested', handleSignInRequest);
  }

  // Keep the settings panel auth state in sync with Firebase on every page load
  (async () => {
    try {
      // Ensure notify.js is loaded so cookie_consent doesn't enter an infinite retry loop
      await import('./assets/internal/notify-js/notify.config.js');
      const { auth, onAuthStateChanged } = await import('./services/firebaseClient.js');
      onAuthStateChanged(auth, async (user) => {
        currentUserSignedIn = user !== null;
        currentUserEmail = user?.email ?? '';
        if (settingsPanel) {
          settingsPanel.signedIn = user !== null;
          settingsPanel.userName = user?.displayName ?? '';
        }
        if (groupDialog) {
          groupDialog.signedIn = user !== null;
          groupDialog.userEmail = user?.email ?? '';
        }

        if (!user) {
          // Tear down any active Firestore listeners when signing out
          teardownListeners();
        }

        if (user) {
          // Fetch groups and songs from Firestore, cache them, and update local DB
          await syncFirebaseGroups(user.email ?? '');

          // Reload song list to reflect newly cached Firebase songs
          if (songList && typeof (songList as any).reloadSongs === 'function') {
            await (songList as any).reloadSongs();
          }

          // Set up real-time listeners for Firebase song changes
          await setupListeners();
          await setupGroupSongListeners();
          setLiveUpdateCallback((songKey: string) => {
            // If the updated song is currently selected, refresh UI without interrupting playback
            refreshCurrentSongUI(songKey);
          });
          setGroupUpdateCallback(() => {
            // Refresh the group song list when a group's songs change remotely
            if (songList && typeof (songList as any).reloadSongs === 'function') {
              (songList as any).reloadSongs();
            }
          });

          // A song that was already open (auto-restored) at boot may have had
          // its markers drawn from stale nDB before this sync completed. Re-render
          // it deterministically so synced markers/settings appear immediately.
          refreshCurrentSongUI();
        }
      });
    } catch (error) {
      // Firebase may not be available (e.g. tests, offline)
      log.i('Firebase auth not available:', error);
    }
  })();

  if (footer) {
    updateFooterWithCurrentSong();
    syncLoopTimesFromSong();
    syncSettingsPanelValues();
    syncCurrentSongControlsValues();
    updateHeaderCountdownDisplay();

    // Listen for nav-click events
    footer.addEventListener('nav-click', (event: any) => {
      if (event.detail.action === 'play') {
        startPlayback(
          TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR,
          TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER,
          TROFF_SETTING_PLAY_UI_BUTTON_GO_TO_MARKER_BEHAVIOUR
        );
      }
    });

    // Listen for speed and volume changes. Speed changes come from both the
    // footer dial and the video player's vertical-scroll gesture, so they share
    // one handler that applies the rate to every media element.
    const applySpeedChange = (event: Event) => {
      const speed = (event as CustomEvent<{ speed: number }>).detail?.speed;
      if (!Number.isFinite(speed)) {
        return;
      }
      audio.playbackRate = speed / 100;
      if (videoElement) {
        videoElement.playbackRate = speed / 100;
      }
      if (videoPlayer) {
        videoPlayer.speed = speed;
      }
      if (footer) {
        footer.speed = speed;
      }
      const songKey = getCurrentSongKey();
      if (songKey) {
        nDB.setOnSong(songKey, 'TROFF_VALUE_speedBar', speed);
      }
      syncCurrentSongControlsValues();
    };
    footer.addEventListener('speed-changed', applySpeedChange);

    footer.addEventListener('volume-changed', (event: any) => {
      audio.volume = event.detail.volume / 100;
      if (videoElement) {
        videoElement.volume = event.detail.volume / 100;
      }
      const songKey = getCurrentSongKey();
      if (songKey) {
        nDB.setOnSong(songKey, 'TROFF_VALUE_volumeBar', event.detail.volume);
      }
      syncCurrentSongControlsValues();
    });

    // Listen for pause before and wait between changes
    footer.addEventListener('pause-before-changed', (event: any) => {
      const songKey = getCurrentSongKey();
      if (songKey) {
        nDB.setOnSong(songKey, 'TROFF_VALUE_pauseBeforeStart', event.detail.pauseBefore);
        nDB.setOnSong(songKey, 'TROFF_CLASS_TO_TOGGLE_buttPauseBefStart', !event.detail.disabled);
      }
      updateHeaderCountdownDisplay();
      syncCurrentSongControlsValues();
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
      syncCurrentSongControlsValues();
    });

    footer.addEventListener('marker-created', (event: any) => {
      // Save the marker to localStorage (following existing pattern)
      const songKey = getCurrentSongKey();
      if (songKey && event.detail.marker) {
        const currentSongData = nDB.get(songKey) || {};
        const existingMarkers = currentSongData.markers || [];
        // Defensive guard: never store a marker outside the song length
        const maxTime = getTimelineDuration() > 0 ? getTimelineDuration() : Infinity;
        event.detail.marker.time = normalizeMarkerTime(event.detail.marker.time, maxTime);
        existingMarkers.push(event.detail.marker);
        // Merge any markers that are now within the time threshold of each other
        const mergedMarkers = mergeNearbyMarkers(existingMarkers);
        nDB.setOnSong(songKey, 'markers', mergedMarkers);
        void saveSongData(songKey);
      }

      // When markers are modified, the URL hash is no longer valid for sharing
      // Also clear the serverId so a future hash link shows the import dialog
      if (songKey) {
        nDB.setOnSong(songKey, 'serverId', undefined);
      }
      setUrlToSong(undefined, null);

      // Update the marker slider UI
      updateMarkerSlider(markerSlider, false);
    });

    footer.addEventListener('marker-dialog-opened', () => {
      const songKey = getCurrentSongKey();
      const currentSongData = songKey ? nDB.get(songKey) : null;
      const existingMarkers = (currentSongData?.markers || []) as TroffMarker[];

      footer.markerDialogInitialTime = getActiveMedia().currentTime || 0;
      footer.markerDialogSuggestedName = `marker nr ${existingMarkers.length + 1}`;
    });

    // The video player's add-marker button opens the footer's marker dialog
    // (create mode) — guarded so a footer without openMarkerDialog is ignored.
    if (videoPlayer) {
      videoPlayer.addEventListener('video-marker-add-requested', () => {
        if (footer?.openMarkerDialog) {
          footer.openMarkerDialog();
        }
      });

      videoPlayer.addEventListener('video-prev-marker-requested', () => {
        if (markerSlider) {
          markerSlider.selectPreviousMarker();
        }
      });

      videoPlayer.addEventListener('video-next-marker-requested', () => {
        if (markerSlider) {
          markerSlider.selectNextMarker();
        }
      });

      videoPlayer.addEventListener('video-replay-requested', () => {
        // Check if we have a playback start time defined in markerSlider
        const media = getActiveMedia();
        if (media) {
          media.currentTime = markerSlider.getPlaybackStart();
        }
      });

      videoPlayer.addEventListener('speed-changed', applySpeedChange);

      videoPlayer.addEventListener('video-scrub-requested', (event: Event) => {
        const detail = (event as CustomEvent<{ time?: number }>).detail;
        const time = Number(detail?.time);
        const media = getActiveMedia();
        if (!media || !Number.isFinite(time)) {
          return;
        }
        media.currentTime = time;
        if (markerSlider) {
          markerSlider.value = time;
        }
        if (header) {
          header.currentTime = formatDuration(time);
        }
      });
    }

    footer.addEventListener('marker-updated', (event: any) => {
      // Update the marker in localStorage
      const songKey = getCurrentSongKey();
      if (songKey && event.detail.marker) {
        const currentSongData = nDB.get(songKey) || {};
        const existingMarkers = currentSongData.markers || [];
        const markerIndex = existingMarkers.findIndex((m: any) => m.id === event.detail.marker.id);
        if (markerIndex !== -1) {
          // Defensive guard: never store a marker outside the song length
          const maxTime = getTimelineDuration() > 0 ? getTimelineDuration() : Infinity;
          event.detail.marker.time = normalizeMarkerTime(event.detail.marker.time, maxTime);
          existingMarkers[markerIndex] = event.detail.marker;
          // Merge any markers that are now within the time threshold of each other
          const mergedMarkers = mergeNearbyMarkers(existingMarkers);
          nDB.setOnSong(songKey, 'markers', mergedMarkers);
        }
        void saveSongData(songKey);
      }

      // When markers are modified, the URL hash is no longer valid for sharing
      // Also clear the serverId so a future hash link shows the import dialog
      if (songKey) {
        nDB.setOnSong(songKey, 'serverId', undefined);
      }
      setUrlToSong(undefined, null);

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
        void saveSongData(songKey);
      }

      // When markers are modified, the URL hash is no longer valid for sharing
      // Also clear the serverId so a future hash link shows the import dialog
      if (songKey) {
        nDB.setOnSong(songKey, 'serverId', undefined);
      }
      setUrlToSong(undefined, null);

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
      // Apply group colour to the header when a group detail is opened/closed
      songList.addEventListener('group-header-color', (event: any) => {
        const color = event.detail?.color || '';
        if (color) {
          header.style.setProperty('--theme-color', color);
        } else {
          header.style.removeProperty('--theme-color');
        }
      });

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
          void loadSongIntoPlayer(songKey);
          recordSongStart(songKey);

          // Set URL hash for shareability if the song has a serverId
          const songData = nDB.get(songKey);
          setUrlToSong(songData?.serverId, songKey);

          // Update badge on the clicked media element immediately
          const mediaItem = event.composedPath?.().find((el: any) => el?.tagName === 'T-MEDIA');
          if (mediaItem) {
            if (songData?.localInformation) {
              mediaItem.playsTotal = songData.localInformation.nrTimesLoaded || 0;
              mediaItem.playsMonth = countLast30Days(songData.localInformation.songStartsLastMonth);
            }
          }

          updateFooterWithCurrentSong();
          syncLoopTimesFromSong();
          syncSettingsPanelValues();
          syncCurrentSongControlsValues();
          applyStoredVolumeAndSpeedToMedia();
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
      void loadSongIntoPlayer(currentSongKey);
      recordSongStart(currentSongKey);

      // Set URL hash for shareability ONLY if there's no navigation hash.
      // If there IS a navigation hash, handleHashDownload will process it
      // (triggered via the hashchange listener below) and will select the
      // correct song — we shouldn't overwrite that hash here.
      if (!window.location.hash) {
        const bootSongData = nDB.get(currentSongKey);
        setUrlToSong(bootSongData?.serverId, currentSongKey);
      }

      syncLoopTimesFromSong();
      syncSettingsPanelValues();
      syncCurrentSongControlsValues();
      applyStoredVolumeAndSpeedToMedia();
      updateHeaderCountdownDisplay();
      void applySavedZoomWindowForCurrentSong();
    }

    // Auto-open song list if no song is selected and there's no
    // navigation hash (which would trigger a download). The empty
    // state / getting-started screen inside t-media-parent greets
    // the user with actionable options when the library is empty.
    //
    // We use requestAnimationFrame + the header-expand event so the
    // CSS transition plays (the component has a chance to render its
    // initial hidden state before visible is set) and goes through
    // the same code path as if the user clicked the header.
    if (!currentSongKey && !window.location.hash && header) {
      requestAnimationFrame(() => {
        header.expanded = true;
        header.dispatchEvent(
          new CustomEvent('header-expand', {
            detail: { expanded: true },
            bubbles: true,
            composed: true,
          })
        );
      });
    }

    // Add audio/video event listeners for timing (attached to both the audio
    // singleton and the video element so they operate on whichever is active)
    const onLoadedMetadata = () => {
      header.totalTime = formatDuration(getActiveMedia().duration);
      updateMarkerSlider(markerSlider);
      selectFirstAndLastMarkers();
      void applySavedZoomWindowForCurrentSong();

      // Save the media duration on the song if it isn't saved yet (issue #31)
      const duration = getActiveMedia().duration;
      const songKey = getCurrentSongKey();
      const savedDuration = songKey ? nDB.get(songKey)?.fileData?.duration : undefined;
      if (
        Number.isFinite(duration) &&
        duration > 0 &&
        songKey &&
        !(Number.isFinite(savedDuration) && savedDuration > 0)
      ) {
        nDB.setOnSong(songKey, ['fileData', 'duration'], duration);
        if (songList && typeof songList.reloadSongs === 'function') {
          void songList.reloadSongs();
        }
      }
    };
    const onTimeUpdate = () => {
      header.currentTime = formatDuration(getActiveMedia().currentTime);
      markerSlider.value = getActiveMedia().currentTime;

      // Check if playback reached the stop point
      if (getActiveMedia().currentTime >= markerSlider.getPlaybackStop()) {
        const playbackStart = markerSlider.getPlaybackStart();
        if (Number.isFinite(loopTimesLeft)) {
          if (loopTimesLeft <= 1) {
            getActiveMedia().pause();
            getActiveMedia().currentTime = playbackStart;
            resetLoopTimesCounter();
            return;
          }

          loopTimesLeft -= 1;
          updateLoopTimesDisplay();
        }

        const waitBetweenDelay = getWaitBetweenDelay();
        isLoopTransitionPause = true;
        getActiveMedia().pause();
        getActiveMedia().currentTime = playbackStart;
        schedulePlaybackAfterDelay(waitBetweenDelay);
      }
    };
    const onPlay = () => {
      clearPlaybackCountdown();
      if (footer) {
        footer.isPlaying = true;
      }
      updateHeaderCountdownDisplay();
    };
    const onPause = () => {
      if (isLoopTransitionPause) {
        isLoopTransitionPause = false;
      } else {
        clearPendingPlaybackStart();
      }
      if (footer) {
        footer.isPlaying = false;
      }
      updateHeaderCountdownDisplay();
    };
    const onEnded = () => {
      clearPendingPlaybackStart();
      if (footer) {
        footer.isPlaying = false;
      }
      updateHeaderCountdownDisplay();
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    if (videoElement) {
      videoElement.addEventListener('loadedmetadata', onLoadedMetadata);
      videoElement.addEventListener('timeupdate', onTimeUpdate);
      videoElement.addEventListener('play', onPlay);
      videoElement.addEventListener('pause', onPause);
      videoElement.addEventListener('ended', onEnded);
    }
  }

  // Set up marker slider with real markers from current song
  if (markerSlider) {
    // Initialize marker slider with current song markers
    updateMarkerSlider(markerSlider);

    // Listen for slider value changes
    markerSlider.addEventListener('value-changed', (event: any) => {
      getActiveMedia().currentTime = event.detail.value;
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

  // -------- Helper: load/select a song (shared by hash download and dialog actions) --------
  const selectSongFromHash = async (fileName: string) => {
    if (songList && typeof songList.reloadSongs === 'function') {
      await songList.reloadSongs();
    }
    clearPendingPlaybackStart();
    setCurrentSong(fileName);
    void loadSongIntoPlayer(fileName);
    recordSongStart(fileName);

    updateFooterWithCurrentSong();
    syncLoopTimesFromSong();
    syncSettingsPanelValues();
    syncCurrentSongControlsValues();
    applyStoredVolumeAndSpeedToMedia();
    updateHeaderCountdownDisplay();

    updateMarkerSlider(markerSlider);
    void applySavedZoomWindowForCurrentSong();

    // Highlight the song in the song list.  This must happen after all other
    // updates so the Lit render cycle from reloadSongs() has settled.
    if (songList) {
      songList.currentSongKey = fileName;
      if (typeof songList.requestUpdate === 'function') {
        songList.requestUpdate();
      }
    }
  };

  // -------- Import dialog for songs that already exist locally --------
  let importDialogOverlay: HTMLDivElement | null = null;

  const destroyImportDialog = () => {
    if (importDialogOverlay) {
      importDialogOverlay.remove();
      importDialogOverlay = null;
    }
  };

  const createImportDialog = (fileName: string, hashServerId: number) => {
    destroyImportDialog();

    const overlay = document.createElement('div');
    overlay.className = 'import-dialog-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.6); z-index: 10000;
      display: flex; align-items: center; justify-content: center;
    `;

    const box = document.createElement('div');
    box.className = 'import-dialog-box';
    box.style.cssText = `
      background: var(--on-theme-color, #fff); color: var(--theme-color, #000);
      padding: 24px; border-radius: 8px; max-width: 400px; width: 90%;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      display: flex; flex-direction: column; gap: 16px;
    `;

    const title = document.createElement('h2');
    title.textContent = 'Update markers?';
    title.style.cssText = 'margin: 0; font-size: 1.2em;';

    const message = document.createElement('p');
    message.style.cssText = 'margin: 0; line-height: 1.5;';
    message.textContent = `You seem to already have the song "${fileName}". Do you want to update that song with the new markers or merge them or abort?`;

    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

    const btnImport = document.createElement('button');
    btnImport.textContent = 'Import new markers';
    btnImport.className = 'regularButton';
    btnImport.onclick = () => {
      destroyImportDialog();
      handleImportNewMarkers(fileName, hashServerId);
    };

    const btnMerge = document.createElement('button');
    btnMerge.textContent = 'Merge with existing markers';
    btnMerge.className = 'regularButton';
    btnMerge.onclick = () => {
      destroyImportDialog();
      handleMergeMarkers(fileName, hashServerId);
    };

    const btnKeep = document.createElement('button');
    btnKeep.textContent = 'Keep existing markers';
    btnKeep.className = 'regularButton';
    btnKeep.onclick = () => {
      destroyImportDialog();
      handleKeepExistingMarkers(fileName);
    };

    // Style buttons
    [btnImport, btnMerge, btnKeep].forEach((btn) => {
      btn.style.cssText = `
        padding: 10px 16px; border: 1px solid var(--theme-color, #000);
        border-radius: 4px; background: var(--secondary-color, #eee);
        color: var(--theme-color, #000); cursor: pointer; font-size: 0.95em;
      `;
    });

    buttonRow.append(btnImport, btnMerge, btnKeep);
    box.append(title, message, buttonRow);
    overlay.append(box);
    document.body.append(overlay);
    importDialogOverlay = overlay;
  };

  // -------- Dialog actions --------
  const handleImportNewMarkers = async (fileName: string, hashServerId: number) => {
    const { fetchServerTroffData } = await import('./utils/hash-download.js');
    const serverData = await fetchServerTroffData(hashServerId, fileName);
    if (!serverData) return;

    const songData = nDB.get(fileName) || {};
    // Clamp imported marker times to the song duration (no duration -> only clamp below 0)
    const maxTime = serverData.duration > 0 ? serverData.duration : Infinity;
    songData.markers = serverData.markers.map((m) => ({
      ...m,
      time: normalizeMarkerTime(m.time, maxTime),
    }));
    songData.aStates = serverData.states;
    songData.info = serverData.info;
    songData.serverId = hashServerId;
    nDB.set(fileName, songData);

    await selectSongFromHash(fileName);
    // Keep the hash — the song now matches the server
  };

  const handleMergeMarkers = async (fileName: string, hashServerId: number) => {
    const { fetchServerTroffData } = await import('./utils/hash-download.js');
    const serverData = await fetchServerTroffData(hashServerId, fileName);
    if (!serverData) return;

    const songData = nDB.get(fileName) || {};
    const existingMarkers: TroffMarker[] = songData.markers || [];
    const existingStates: string[] = songData.aStates || [];

    // Clamp imported marker times to the song duration (no duration -> only clamp below 0)
    const maxTime = serverData.duration > 0 ? serverData.duration : Infinity;

    // ----- Step 1: Build merged marker list (matching v1's addMarkers behavior) -----
    // An imported marker within 0.001s of an existing one is merged into it;
    // the rest get new unique markerNrN ids. mergeImportedMarkers handles
    // name joining, info joining, color rules, and time normalization.
    const mergedMarkers = mergeImportedMarkers(existingMarkers, serverData.markers, maxTime);
    songData.markers = mergedMarkers;

    // ----- Step 2: Merge states (matching v1's importStates behavior) -----
    // v1 flow: convert server state marker IDs → time values (replaceMarkerIdWithMarkerTimeInState),
    // then look up by time in the merged markers (importStates / getMarkerFromTime)
    const mergedStates: string[] = [...existingStates];
    for (const stateJson of serverData.states) {
      const state: State = JSON.parse(stateJson);

      // replaceMarkerIdWithMarkerTimeInState: find time values from server markers
      let markerTime: number | undefined;
      let stopMarkerTime: number | undefined;
      for (const serverMarker of serverData.markers) {
        if (state.currentMarker === serverMarker.id) {
          markerTime = Number(serverMarker.time);
        }
        if (state.currentStopMarker === serverMarker.id + 'S') {
          stopMarkerTime = Number(serverMarker.time);
        }
      }

      // importStates / getMarkerFromTime: look up markers by time in merged array
      const newState: State = { ...state };
      if (markerTime !== undefined) {
        const markerByTime = mergedMarkers.find(
          (m) => Math.abs(Number(m.time) - markerTime) < 0.001
        );
        if (markerByTime) {
          newState.currentMarker = markerByTime.id;
        } else {
          // v1 fallback: log error and use the first marker
          log.e(
            'Could not find a marker at the time ' + markerTime + '; returning the first marker'
          );
          newState.currentMarker = mergedMarkers[0]?.id || '';
        }
      }
      if (stopMarkerTime !== undefined) {
        const markerByTime = mergedMarkers.find(
          (m) => Math.abs(Number(m.time) - stopMarkerTime) < 0.001
        );
        if (markerByTime) {
          newState.currentStopMarker = markerByTime.id + 'S';
        } else {
          log.e(
            'Could not find a marker at the time ' + stopMarkerTime + '; returning the first marker'
          );
          newState.currentStopMarker = (mergedMarkers[0]?.id || '') + 'S';
        }
      }

      mergedStates.push(JSON.stringify(newState));
    }
    songData.aStates = mergedStates;

    // ----- Step 3: Merge song info (v1: append text) -----
    if (serverData.info) {
      songData.info = (songData.info || '') + serverData.info;
    }

    // Clear serverId so the hash won't match next time (markers are modified)
    songData.serverId = undefined;
    nDB.set(fileName, songData);

    await selectSongFromHash(fileName);
    setUrlToSong(undefined, null); // Clear hash — markers are modified
  };

  const handleKeepExistingMarkers = async (fileName: string) => {
    await selectSongFromHash(fileName);
    setUrlToSong(undefined, null); // Clear hash — we chose not to sync with server
  };

  // -------- Main hash download handler --------
  const handleHashDownload = async (hash: string) => {
    const { parseHash, downloadSongFromHash } = await import('./utils/hash-download.js');
    const parsed = parseHash(hash);
    if (!parsed) return;

    const { serverId: hashServerId, fileName } = parsed;

    // Check if the song already exists locally
    const existingSongData = nDB.get(fileName);

    if (!existingSongData) {
      // New song — download it with progress notification
      const { showDownloadProgress, showToast } = await import('./utils/notification.js');
      const progress = showDownloadProgress(fileName);
      const downloadedFileName = await downloadSongFromHash(hash, {
        onProgress: (loaded, total) => progress.update(Math.round((loaded / total) * 100)),
      });
      progress.done();
      if (!downloadedFileName) return;

      showToast(`"${downloadedFileName}" downloaded successfully!`, 'success');
      await selectSongFromHash(downloadedFileName);
      // Hash stays — song is now downloaded with serverId set
      return;
    }

    // Song exists locally — check if it's from the same server
    const localServerId = existingSongData.serverId;
    if (localServerId != null && String(localServerId) === String(hashServerId)) {
      // Same serverId — just select the song (no dialog needed)
      await selectSongFromHash(fileName);
      return;
    }

    // Different or missing serverId — show import dialog
    createImportDialog(fileName, hashServerId);
  };

  // -------- Group edit dialog (V2) --------
  let groupDialog: any = null;

  const ensureGroupDialog = () => {
    if (!groupDialog) {
      groupDialog = document.createElement('t-group-dialog') as any;
      document.body.append(groupDialog);
    }
    groupDialog.signedIn = currentUserSignedIn;
    groupDialog.userEmail = currentUserEmail;
    return groupDialog;
  };

  // Listen for group edit requests from the song list
  if (songList) {
    if (typeof songList.addEventListener === 'function') {
      songList.addEventListener('group-edit-requested', (event: Event) => {
        const customEvent = event as CustomEvent<{ group?: any }>;
        const group = customEvent.detail?.group;
        if (!group) return;

        const dlg = ensureGroupDialog();
        dlg.group = group;
        dlg.open = true;
      });

      // Listen for create-group requests
      songList.addEventListener('group-create-requested', () => {
        const dlg = ensureGroupDialog();
        dlg.group = null; // create mode
        dlg.open = true;
      });
    }
  }

  // Listen for group-saved events from the dialog
  document.addEventListener('group-saved', async (event: Event) => {
    const customEvent = event as CustomEvent<{ group?: any }>;
    const group = customEvent.detail?.group;
    if (!group) return;

    try {
      const songLists: any[] = nDB.get('aoSongLists') || [];
      let found = false;
      let matchIndex = -1;

      for (let i = 0; i < songLists.length; i++) {
        const sl = songLists[i];
        // Match by firebaseGroupDocId first, then by id
        const matchKey = group.firebaseGroupDocId || group.id;
        const slKey = sl.firebaseGroupDocId || sl.id;
        if (matchKey != null && slKey != null && String(matchKey) === String(slKey)) {
          matchIndex = i;
          found = true;
          break;
        }
      }

      // Sync to Firebase first (this may set firebaseGroupDocId on the group for new groups)
      if (group.firebaseGroupDocId || !found) {
        const { saveGroupToFirebase } = await import('./utils/firebase-group-sync.js');
        await saveGroupToFirebase(group);
      }

      // Now save to nDB (with any firebaseGroupDocId set by Firebase sync)
      if (found) {
        songLists[matchIndex] = { ...group };
      } else {
        // New group — ensure it has an identifier
        if (!group.firebaseGroupDocId && !group.id) {
          group.id = Date.now();
        }
        songLists.push({ ...group });
      }
      nDB.set('aoSongLists', songLists);

      // Reload the song list to reflect changes
      if (songList && typeof songList.reloadSongs === 'function') {
        await songList.reloadSongs();
      }

      // Navigate to the new group's detail view after creation
      if (!found) {
        const groupKey = group.firebaseGroupDocId || String(group.id);
        if (songList && typeof songList.openGroupDetail === 'function') {
          songList.openGroupDetail(groupKey);
        }
      }
    } catch (error) {
      log.e('Error saving group:', error);
    }
  });

  // Listen for group-deleted events from the dialog
  document.addEventListener('group-deleted', async (event: Event) => {
    const customEvent = event as CustomEvent<{ groupId?: string; group?: any }>;
    const groupId = customEvent.detail?.groupId;
    const group = customEvent.detail?.group;
    if (!groupId) return;

    try {
      // Remove from local nDB
      const songLists: any[] = nDB.get('aoSongLists') || [];
      const updatedLists = songLists.filter((sl: any) => {
        const slKey = sl.firebaseGroupDocId || sl.id;
        return slKey != null && String(slKey) !== String(groupId);
      });
      nDB.set('aoSongLists', updatedLists);

      // Delete from Firebase if it's a Firebase group
      if (group?.firebaseGroupDocId) {
        const { deleteGroupFromFirebase } = await import('./utils/firebase-group-sync.js');
        await deleteGroupFromFirebase(group.firebaseGroupDocId);
      }

      // Reload the song list
      if (songList && typeof songList.reloadSongs === 'function') {
        await songList.reloadSongs();
      }
    } catch (error) {
      log.e('Error deleting group:', error);
    }
  });

  // -------- Song edit dialog (V2) --------
  let songEditDialog: SongEditDialog | null = null;

  const ensureSongEditDialog = () => {
    if (!songEditDialog) {
      songEditDialog = document.createElement('t-song-edit-dialog');
      document.body.append(songEditDialog);
    }
    return songEditDialog;
  };

  if (songList) {
    if (typeof songList.addEventListener === 'function') {
      songList.addEventListener('song-edit-requested', (event: Event) => {
        const customEvent = event as CustomEvent<{ songKey?: string }>;
        const songKey = customEvent.detail?.songKey;
        if (!songKey) return;
        const dlg = ensureSongEditDialog();
        dlg.songKey = songKey;
        dlg.songData = nDB.get(songKey);
        dlg.open = true;
      });
    }
  }

  // Listen for song-saved events from the dialog
  document.addEventListener('song-saved', async (event: Event) => {
    const customEvent = event as CustomEvent<{ songKey?: string; fileData?: Partial<TroffFileData> }>;
    const { songKey, fileData } = customEvent.detail ?? {};
    if (!songKey || !fileData) return;

    const songObject = nDB.get(songKey);
    if (!songObject) return;

    songObject.fileData = songObject.fileData || {};
    songObject.fileData.customName = fileData.customName ?? '';
    songObject.fileData.choreography = fileData.choreography ?? '';
    songObject.fileData.choreographer = fileData.choreographer ?? '';
    songObject.fileData.title = fileData.title ?? '';
    songObject.fileData.artist = fileData.artist ?? '';
    songObject.fileData.album = fileData.album ?? '';
    songObject.fileData.genre = fileData.genre ?? '';
    songObject.fileData.tags = fileData.tags ?? '';

    nDB.set(songKey, songObject);

    // Reload the song list to reflect the new metadata
    if (songList && typeof songList.reloadSongs === 'function') {
      await songList.reloadSongs();
    }

    // Refresh header/footer if this is the currently playing song
    if (getCurrentSongKey() === songKey) {
      updateHeaderWithCurrentSong();
      updateFooterWithCurrentSong();
    }

    // Sync edited metadata to Firebase groups (v2 equivalent of ifGroupSongUpdateFirestore)
  });

  // Listen for song info saves from the header dropdown
  document.addEventListener('song-info-saved', (event: Event) => {
    const customEvent = event as CustomEvent<{ info?: string }>;
    const { info } = customEvent.detail ?? {};
    if (info === undefined) return;
    const songKey = getCurrentSongKey();
    if (!songKey) return;
    nDB.setOnSong(songKey, 'info', info);
  });

  // -------- Group song management (add/remove from detail view) --------

  // Re-render the currently-loaded song's markers and settings straight from
  // nDB. Used right after a Firebase sync pull (so a song that was already
  // open when v2 booted picks up synced markers immediately) and by the
  // real-time listener callback. Compared by normalized basename so a
  // path-prefixed "current song" still matches the cached/Firestore songKey.
  const refreshCurrentSongUI = (songKey?: string) => {
    const currentKey = getCurrentSongKey();
    if (!currentKey || !markerSlider) return;
    if (songKey && toSongKey(currentKey) !== toSongKey(songKey)) return;
    updateMarkerSlider(markerSlider, false);
    syncSettingsPanelValues();
    syncCurrentSongControlsValues();
    syncLoopTimesFromSong();
  };

  /** Helper: update a group's songs array in nDB and optionally save to Firebase. */
  async function _updateGroupSongs(
    groupKey: string,
    updater: (songs: any[]) => any[]
  ): Promise<void> {
    const songLists: any[] = nDB.get('aoSongLists') || [];
    let found = false;
    for (let i = 0; i < songLists.length; i++) {
      const sl = songLists[i];
      const slKey = sl.firebaseGroupDocId || sl.id;
      if (slKey != null && String(slKey) === String(groupKey)) {
        songLists[i] = {
          ...sl,
          songs: updater(sl.songs || []),
        };
        found = true;
        break;
      }
    }
    if (!found) return;
    nDB.set('aoSongLists', songLists);

    // Save to Firebase if it's a Firebase group
    const updated = songLists.find((sl: any) => {
      const slKey = sl.firebaseGroupDocId || sl.id;
      return slKey != null && String(slKey) === String(groupKey);
    });
    if (updated?.firebaseGroupDocId) {
      try {
        const { saveGroupToFirebase } = await import('./utils/firebase-group-sync.js');
        await saveGroupToFirebase(updated);
      } catch (err) {
        log.e('Error saving group songs to Firebase:', err);
      }
    }

    // Reload the song list
    if (songList && typeof songList.reloadSongs === 'function') {
      await songList.reloadSongs();
    }
  }

  // Listen for song removal from group detail view
  document.addEventListener('group-song-removed', async (event: Event) => {
    const customEvent = event as CustomEvent<{ groupKey: string; songKey: string }>;
    const { groupKey, songKey } = customEvent.detail || {};
    if (!groupKey || !songKey) return;

    try {
      // Capture the removed song entry (with its Firebase identity) BEFORE the local update
      const songListsBefore: any[] = nDB.get('aoSongLists') || [];
      const groupBefore = songListsBefore.find((sl: any) => {
        const slKey = sl.firebaseGroupDocId || sl.id;
        return slKey != null && String(slKey) === String(groupKey);
      });
      const removedEntry = groupBefore?.songs?.find((s: any) => s.fullPath === songKey);

      await _updateGroupSongs(groupKey, (songs) =>
        songs.filter((s: any) => s.fullPath !== songKey)
      );

      // Delete the song doc (and storage file) from Firebase if it was synced
      if (groupBefore?.firebaseGroupDocId && removedEntry?.firebaseSongDocId) {
        try {
          const { removeSongFromFirebaseGroup } = await import('./utils/firebase-group-sync.js');
          await removeSongFromFirebaseGroup(groupBefore.firebaseGroupDocId, removedEntry);
        } catch (err) {
          log.e('Error removing song from Firebase group:', err);
        }
      }
    } catch (error) {
      log.e('Error removing song from group:', error);
    }
  });

  // Listen for song addition to group detail view
  document.addEventListener('group-song-added', async (event: Event) => {
    const customEvent = event as CustomEvent<{ groupKey: string; songKey: string; title: string }>;
    const { groupKey, songKey, title } = customEvent.detail || {};
    if (!groupKey || !songKey) return;

    try {
      await _updateGroupSongs(groupKey, (songs) => {
        // Don't add duplicates
        if (songs.some((s: any) => s.fullPath === songKey)) return songs;
        return [...songs, { fullPath: songKey, galleryId: title || songKey }];
      });

      // Share the song with the Firebase group: upload the file and create the
      // Songs subcollection doc so other devices in the group receive it.
      const songListsAfter: any[] = nDB.get('aoSongLists') || [];
      const updatedGroup = songListsAfter.find((sl: any) => {
        const slKey = sl.firebaseGroupDocId || sl.id;
        return slKey != null && String(slKey) === String(groupKey);
      });
      if (updatedGroup?.firebaseGroupDocId) {
        try {
          const { shareSongToFirebaseGroup } = await import('./utils/firebase-group-sync.js');
          await shareSongToFirebaseGroup(updatedGroup, songKey);
        } catch (err) {
          log.e('Error sharing song to Firebase group:', err);
        }
      }
    } catch (error) {
      log.e('Error adding song to group:', error);
    }
  });

  if (window.location.hash) {
    handleHashDownload(window.location.hash).catch((error) => {
      log.e('Hash download on boot failed:', error);
    });
  }

  window.addEventListener('hashchange', () => {
    if (window.location.hash) {
      handleHashDownload(window.location.hash).catch((error) => {
        log.e('Hash download on hashchange failed:', error);
      });
    }
  });
});

