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
} from './utils/current-song.js';
import { nDB } from './assets/internal/db.js';
import { audio, loadSong } from './services/audio.js';
import { formatDuration } from './utils/formatters.js';

// Function to update marker slider with current song markers
const updateMarkerSlider = (markerSlider: any, duration?: number) => {
  const currentSongMetadata = getCurrentSongMetadata();
  const songDuration = duration !== undefined ? duration : currentSongMetadata?.duration || 0;
  if (currentSongMetadata && markerSlider) {
    // Load real markers from current song
    const songKey = getCurrentSongKey();
    const currentSongData = songKey ? nDB.get(songKey) : null;
    const markers = currentSongData?.markers || [];

    markerSlider.markers = markers;
    markerSlider.min = 0;
    markerSlider.max = songDuration;
    markerSlider.unit = 's';

    // Set initial value to 0 only if duration is provided (on load)
    if (duration !== undefined) {
      markerSlider.value = 0;
    }

    console.log('currentSongData', currentSongData);

    markerSlider.startMarkerId = currentSongData?.currentStartMarker || '';
    markerSlider.stopMarkerId = currentSongData?.currentStopMarker || '';
  } else if (markerSlider) {
    // No song selected, use default state
    markerSlider.markers = [];
    markerSlider.min = 0;
    markerSlider.max = 0;
    markerSlider.unit = '';
    markerSlider.value = 0;
  }
};

// Initialize components and set up event listeners

document.addEventListener('DOMContentLoaded', () => {
  const footer = document.getElementById('footer') as any;
  const settingsPanel = document.getElementById('settingsPanel') as any;
  const header = document.getElementById('header') as any;
  const songList = document.getElementById('songList') as any;
  const markerSlider = document.getElementById('markerSlider') as any;

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
    // Listen for nav-click events
    footer.addEventListener('nav-click', (event: any) => {
      if (event.detail.action === 'play') {
        if (audio.paused) {
          audio.play().catch(console.error);
        } else {
          audio.pause();
        }
      }
    });

    // Listen for speed and volume changes
    footer.addEventListener('speed-changed', (event: any) => {
      audio.playbackRate = event.detail.speed / 100;
    });
    footer.addEventListener('volume-changed', (event: any) => {
      audio.volume = event.detail.volume / 100;
    });
  }

  if (header) {
    // Listen for header expand events
    header.addEventListener('header-expand', (event: any) => {
      const expanded = event.detail.expanded;
      console.log('Header expanded:', expanded);

      // Toggle song list visibility
      if (songList) {
        songList.visible = expanded;
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
          setCurrentSong(songKey);
          loadSong(songKey);

          // Update marker slider with new song markers
          updateMarkerSlider(markerSlider);
        }
      });
    }

    // Initialize header with current song data
    updateHeaderWithCurrentSong();

    const currentSongKey = getCurrentSongKey();
    if (currentSongKey) {
      loadSong(currentSongKey);
    }

    // Add audio event listeners for timing
    audio.addEventListener('loadedmetadata', () => {
      header.totalTime = formatDuration(audio.duration);
      updateMarkerSlider(markerSlider, audio.duration);
    });
    audio.addEventListener('timeupdate', () => {
      header.currentTime = formatDuration(audio.currentTime);
      markerSlider.value = audio.currentTime;
    });
    audio.addEventListener('play', () => {
      footer.isPlaying = true;
    });
    audio.addEventListener('pause', () => {
      footer.isPlaying = false;
    });
    audio.addEventListener('ended', () => {
      footer.isPlaying = false;
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
          updateMarkerSlider(markerSlider);
        }
      }
    });
  }
});
