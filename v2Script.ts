import './components/atom/t-butt.js';
import './components/atom/t-icon.js';
import './components/molecule/t-footer.js';
import './components/molecule/t-settings-panel.js';
import './components/molecule/t-header.js';
import './components/molecule/t-media-parent.js';
import './components/molecule/t-main-layout.js';

// Initialize components and set up event listeners
document.addEventListener('DOMContentLoaded', () => {
  const footer = document.getElementById('footer') as any;
  const settingsPanel = document.getElementById('settingsPanel') as any;
  const header = document.getElementById('header') as any;
  const songList = document.getElementById('songList') as any;

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
      songList.addEventListener('song-selected', (event: any) => {
        console.log('Song selected:', event.detail.song);
        // Here you can add logic to load and play the selected song
        // For example: loadSong(event.detail.song);
      });
    }

    // Set some demo data for header
    header.songTitle = 'Bohemian Rhapsody';
    header.artistName = 'Queen';
    header.currentTime = '1:42';
    header.totalTime = '4:20';
  }
});
