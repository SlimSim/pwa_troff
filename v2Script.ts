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
import type { BottomNav } from './components/molecule/t-footer.js';
import { nDB } from './assets/internal/db.js';
import { audio, loadSong } from './services/audio.js';
import { formatDuration } from './utils/formatters.js';
import { MarkerSlider } from './components/organisms/t-marker-slider.js';
import { configureMarkerSlider } from './utils/troff-settings.js';
import {
  TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR,
  TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR,
  TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR,
} from './constants/constants.js';

// Function to update marker slider with current song markers
const updateMarkerSlider = (markerSlider: MarkerSlider, setAudioTime: boolean = true) => {
  const currentSongMetadata = getCurrentSongMetadata();
  const songDuration = audio.duration > 0 ? audio.duration : currentSongMetadata?.duration || 0;
  if (currentSongMetadata && markerSlider) {
    // Load real markers from current song
    const songKey = getCurrentSongKey();
    const currentSongData = songKey ? nDB.get(songKey) : null;
    const markers = currentSongData?.markers || [];

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
  const footer = document.getElementById('footer') as BottomNav | null;
  const settingsPanel = document.getElementById('settingsPanel') as any;
  const header = document.getElementById('header') as any;
  const songList = document.getElementById('songList') as any;
  const markerSlider = document.getElementById('markerSlider') as MarkerSlider;
  let pendingPlaybackStart: number | undefined;
  let playbackCountdownInterval: number | undefined;

  const updatePlaybackCountdown = (millisecondsLeft: number) => {
    if (!footer) {
      return;
    }

    footer.isStartingPlayback = true;
    footer.playbackCountdown = Math.max(1, Math.ceil(millisecondsLeft / 1000));
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
    }

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
      return true;
    }

    if (activeElement instanceof HTMLElement && activeElement.isContentEditable) {
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
    }

    return false;
  };

  const getPauseBeforeDelay = (settingKey: string) => {
    if (!footer || !nDB.get(settingKey) || footer.disablePauseBefore) {
      return 0;
    }

    return Math.max(0, footer.pauseBefore) * 1000;
  };

  const startPlayback = (settingKey: string) => {
    if (pendingPlaybackStart !== undefined) {
      clearPendingPlaybackStart();
      return;
    }

    if (!audio.paused) {
      audio.pause();
      return;
    }

    const delay = getPauseBeforeDelay(settingKey);
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
      startPlayback(TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR);
      return;
    }

    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      event.stopPropagation();
      startPlayback(TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR);
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
      console.log('Setting changed:', event.detail.setting, event.detail.value);
      // Here you can add logic to handle setting changes
      // For example, save to localStorage, update app state, etc.
    });
  }

  if (footer) {
    updateFooterWithCurrentSong();

    // Listen for nav-click events
    footer.addEventListener('nav-click', (event: any) => {
      if (event.detail.action === 'play') {
        startPlayback(TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR);
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
      if (!songKey) {
        return;
      }

      const currentSongData = nDB.get(songKey) || {};
      const markers = currentSongData.markers || [];
      footer.markerName = `Marker nr ${markers.length + 1}`;
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

          // Update marker slider with new song markers
          updateMarkerSlider(markerSlider);
        }
      });
    }

    // Initialize header with current song data
    updateHeaderWithCurrentSong();

    const currentSongKey = getCurrentSongKey();
    if (currentSongKey) {
      clearPendingPlaybackStart();
      loadSong(currentSongKey);
    }

    // Add audio event listeners for timing
    audio.addEventListener('loadedmetadata', () => {
      header.totalTime = formatDuration(audio.duration);
      updateMarkerSlider(markerSlider);
    });
    audio.addEventListener('timeupdate', () => {
      header.currentTime = formatDuration(audio.currentTime);
      markerSlider.value = audio.currentTime;

      // Check if playback reached the stop point
      if (audio.currentTime >= markerSlider.getPlaybackStop()) {
        audio.pause();
        audio.currentTime = markerSlider.getPlaybackStart();
      }
    });
    audio.addEventListener('play', () => {
      clearPlaybackCountdown();
      if (footer) {
        footer.isPlaying = true;
      }
    });
    audio.addEventListener('pause', () => {
      clearPendingPlaybackStart();
      if (footer) {
        footer.isPlaying = false;
      }
    });
    audio.addEventListener('ended', () => {
      clearPendingPlaybackStart();
      if (footer) {
        footer.isPlaying = false;
      }
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
