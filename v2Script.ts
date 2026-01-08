import './components/atom/t-butt.js';
import './components/atom/t-icon.js';
import './components/molecule/t-footer.js';
import './components/molecule/t-settings-panel.js';
import './components/molecule/t-header.js';

// Initialize components and set up event listeners
document.addEventListener('DOMContentLoaded', () => {
  const footer = document.getElementById('footer') as any;
  const settingsPanel = document.getElementById('settingsPanel') as any;
  const header = document.getElementById('header') as any;

  // Function to update body margin based on footer height
  const updateBodyMargin = () => {
    if (footer) {
      const footerHeight = footer.getBoundingClientRect().height;
      document.body.style.marginBottom = `${footerHeight}px`;
    }
  };

  // Set up ResizeObserver for footer height changes
  if (footer) {
    const resizeObserver = new ResizeObserver(() => {
      updateBodyMargin();
    });
    resizeObserver.observe(footer);

    // Initial margin calculation
    setTimeout(updateBodyMargin, 100);
  }

  // Function to update content margin based on header height
  const updateContentMargin = () => {
    if (header) {
      const headerHeight = header.getBoundingClientRect().height;
      const mainContent = document.querySelector('h1')?.parentElement;
      if (mainContent) {
        mainContent.style.marginTop = `${headerHeight}px`;
      }
    }
  };

  // Set up ResizeObserver for header height changes
  if (header) {
    const headerResizeObserver = new ResizeObserver(() => {
      updateContentMargin();
    });
    headerResizeObserver.observe(header);

    // Initial margin calculation
    setTimeout(updateContentMargin, 100);
  }

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
      console.log('Header expanded:', event.detail.expanded);
      // Here you can add logic to show/hide song list
      // For example: toggleSongList(event.detail.expanded);
    });

    // Set some demo data for the header
    header.songTitle = 'Bohemian Rhapsody';
    header.artistName = 'Queen';
    header.currentTime = '1:42';
    header.totalTime = '4:20';
  }
});
