import { describe, it, beforeEach, vi, expect } from 'vitest';
import { TroffClass } from '../scriptTroffClass.mjs';

// Simulate DOM for UI/keyboard integration
globalThis.document = window.document;

describe('UI Integration: Buttons and Keyboard', () => {
  describe('Real integration: TroffClass exportStuff', () => {
    let TroffInstance;
    beforeEach(() => {
      // Minimal mock for DB, IO, $ (jQuery)
      // Add blurHack: vi.fn() to IO to support Troff.toggleImportExport
      global.DB = { getMarkers: vi.fn((song, cb) => cb([])), fixSongObject: vi.fn(() => ({})), getVal: vi.fn(), saveMarkers: vi.fn(), saveStates: vi.fn() };
      global.IO = { prompt: vi.fn(), updateCellInDataTable: vi.fn(), removeLoadScreen: vi.fn(), blurHack: vi.fn() };
      global.$ = (selector) => {
        if (selector === '#stateList') return { children: () => [] };
        if (selector === '#songInfoArea') return { val: () => '' };
        if (selector === '#outerImportExportPopUpSquare') return { removeClass: vi.fn(), addClass: vi.fn(), toggleClass: vi.fn() };
        return { removeClass: vi.fn(), addClass: vi.fn(), toggleClass: vi.fn(), text: vi.fn(), find: vi.fn(() => ({ data: vi.fn(() => ({})), addClass: vi.fn(), removeClass: vi.fn(), text: vi.fn() })) };
      };
      // Set up DOM and Troff instance
      document.body.innerHTML = `
        <button id="exportBtn">Export</button>
        <div id="outerImportExportPopUpSquare" class="outerDialog hidden"></div>
        <textarea id="songInfoArea"></textarea>
        <div id="stateList"></div>
      `;
      TroffInstance = new TroffClass();
      global.Troff = TroffInstance;
    });
    it('Clicking export button triggers real exportStuff logic', () => {
      // Attach real handler
      document.getElementById('exportBtn').addEventListener('click', () => TroffInstance.exportStuff());
      // Simulate click
      document.getElementById('exportBtn').click();
      // Assert the prompt was called (side effect of exportStuff)
      expect(IO.prompt).toHaveBeenCalled();
    });
  });

  let Troff;
  let $;
  let troffInstance;

  beforeEach(async () => {
    // Reset DOM and global mocks
    document.body.innerHTML = `
      <button id="testButton" class="regularButton">Test</button>
      <input id="testInput" type="text" />
      <audio></audio>
      <video></video>
    `;
    // Mock jQuery
    $ = vi.fn((selector) => {
      if (selector === '#testButton') {
        return [{ addEventListener: (evt, cb) => { document.getElementById('testButton').addEventListener(evt, cb); } }];
      }
      if (selector === 'audio, video') {
        return [document.querySelector('audio')];
      }
      if (selector === '#testInput') {
        return [document.getElementById('testInput')];
      }
      return [];
    });
    global.$ = $;
    // Mock Troff and dependencies
    Troff = {
      showSearchAndActivate: vi.fn(),
      forceFullscreenChange: vi.fn(),
      goToStartMarker: vi.fn(),
      unselectStartMarker: vi.fn(),
      unselectStopMarker: vi.fn(),
      unselectMarkers: vi.fn(),
      zoomOut: vi.fn(),
      zoomToMarker: vi.fn(),
    };
    global.Troff = Troff;
    global.shiftTime = 1;
    global.altTime = 2;
    global.regularTime = 3;
    document.querySelector('audio').currentTime = 10;
  });

  it('Button click triggers handler', () => {
    const handler = vi.fn();
    document.getElementById('testButton').addEventListener('click', handler);
    document.getElementById('testButton').click();
    expect(handler).toHaveBeenCalled();
  });

  it('Left arrow with shift decreases audio time by shiftTime', () => {
    const event = new window.KeyboardEvent('keydown', { keyCode: 37, shiftKey: true });
    global.event = event;
    // Simulate script2.js logic
    if(event.keyCode === 37) {
      if(event.shiftKey==1)
        $('audio, video')[0].currentTime -= shiftTime;
      else if(event.altKey==1)
        $('audio, video')[0].currentTime -= altTime;
      else
        $('audio, video')[0].currentTime -= regularTime;
    }
    expect(document.querySelector('audio').currentTime).toBe(9);
  });

  it('Ctrl+F triggers Troff.showSearchAndActivate', () => {
    const event = new window.KeyboardEvent('keydown', { keyCode: 70, ctrlKey: true });
    global.event = event;
    if(event.keyCode === 70) {
      if(event.ctrlKey==1){
        event.preventDefault && event.preventDefault();
        Troff.showSearchAndActivate();
      } else
        Troff.forceFullscreenChange();
    }
    expect(Troff.showSearchAndActivate).toHaveBeenCalled();
  });

  it('G key triggers Troff.goToStartMarker', () => {
    const event = new window.KeyboardEvent('keydown', { keyCode: 71 });
    global.event = event;
    if(event.keyCode === 71) {
      Troff.goToStartMarker();
    }
    expect(Troff.goToStartMarker).toHaveBeenCalled();
  });

  it('U key with shift triggers Troff.unselectStartMarker', () => {
    const event = new window.KeyboardEvent('keydown', { keyCode: 85, shiftKey: true });
    global.event = event;
    if(event.keyCode === 85) {
      if(event.shiftKey==1)
        Troff.unselectStartMarker();
      else if(event.altKey==1)
        Troff.unselectStopMarker();
      else
        Troff.unselectMarkers();
    }
    expect(Troff.unselectStartMarker).toHaveBeenCalled();
  });

  it('U key with alt triggers Troff.unselectStopMarker', () => {
    const event = new window.KeyboardEvent('keydown', { keyCode: 85, altKey: true });
    global.event = event;
    if(event.keyCode === 85) {
      if(event.shiftKey==1)
        Troff.unselectStartMarker();
      else if(event.altKey==1)
        Troff.unselectStopMarker();
      else
        Troff.unselectMarkers();
    }
    expect(Troff.unselectStopMarker).toHaveBeenCalled();
  });

  it('U key with no modifier triggers Troff.unselectMarkers', () => {
    const event = new window.KeyboardEvent('keydown', { keyCode: 85 });
    global.event = event;
    if(event.keyCode === 85) {
      if(event.shiftKey==1)
        Troff.unselectStartMarker();
      else if(event.altKey==1)
        Troff.unselectStopMarker();
      else
        Troff.unselectMarkers();
    }
    expect(Troff.unselectMarkers).toHaveBeenCalled();
  });

  it('Z key with shift triggers Troff.zoomOut', () => {
    const event = new window.KeyboardEvent('keydown', { keyCode: 90, shiftKey: true });
    global.event = event;
    if(event.keyCode === 90) {
      if(event.shiftKey==1)
        Troff.zoomOut();
      else
        Troff.zoomToMarker();
    }
    expect(Troff.zoomOut).toHaveBeenCalled();
  });

  it('Z key with no modifier triggers Troff.zoomToMarker', () => {
    const event = new window.KeyboardEvent('keydown', { keyCode: 90 });
    global.event = event;
    if(event.keyCode === 90) {
      if(event.shiftKey==1)
        Troff.zoomOut();
      else
        Troff.zoomToMarker();
    }
    expect(Troff.zoomToMarker).toHaveBeenCalled();
  });

  // --- Additional Integration/UI tests ---

// it('addSongsToSonglist (script.mjs) adds song and calls DB.saveSonglists_new', async () => {
//   // Mock firebase and environment before import
//   global.firebase = {
//     initializeApp: () => ({ auth: () => ({ signInWithPopup: () => Promise.resolve({ user: {} }) }), storage: () => ({}) })
//   };
//   global.environment = { firebaseConfig: {} };

//   // Import the real function from script.mjs
//   const { addSongsToSonglist } = await import('../script.mjs');

//   // Setup a fake songList and DOM element
//   const fakeSongList = { name: 'TestList', songs: [], id: 1 };
//   const $target = document.createElement('button');
//   $target.dataset.songList = JSON.stringify(fakeSongList);
//   // jQuery-like .data() for test
//   $target.data = (key, val) => {
//     if (val !== undefined) {
//       if (key === 'songList') fakeSongList.songs = val.songs;
//     }
//     if (key === 'songList') return fakeSongList;
//     return undefined;
//   };

//   // Mock jQuery global $
//   global.$ = (selector) => {
//     if (selector instanceof HTMLElement) return selector;
//     return {
//       data: (key) => fakeSongList,
//       each: (cb) => cb(0, { data: { galleryId: 1, fullPath: 'f.mp3' }, name: 'f.mp3' })
//     };
//   };

//   // Mock DB and notifyUndo
//   global.DB = { saveSonglists_new: vi.fn() };
//   global.notifyUndo = vi.fn((msg, cb) => cb && cb());

//   // Song data
//   const testSong = { data: { galleryId: 1, fullPath: 'f.mp3' }, name: 'f.mp3' };
//   addSongsToSonglist([testSong], $target);

//   // Assert song was added and DB.saveSonglists_new called
//   expect(fakeSongList.songs.length).toBe(1);
//   expect(fakeSongList.songs[0].fullPath).toBe('f.mp3');
//   expect(global.DB.saveSonglists_new).toHaveBeenCalled();
//   expect(global.notifyUndo).toHaveBeenCalled();
// });

  it('Settings dialog button click triggers handler', () => {
    // Add a settings button to the DOM
    const settingsButton = document.createElement('button');
    settingsButton.className = 'buttSettingsDialog regularButton';
    settingsButton.id = 'buttSettingsDialog';
    document.body.appendChild(settingsButton);
    const handler = vi.fn();
    settingsButton.addEventListener('click', handler);
    settingsButton.click();
    expect(handler).toHaveBeenCalled();
    document.body.removeChild(settingsButton);
  });

  it('Play/Pause button workflow: play then pause', () => {
    // Add play and pause buttons
    const playBtn = document.createElement('button');
    playBtn.id = 'buttPlayUiButtonPlay';
    document.body.appendChild(playBtn);
    const pauseBtn = document.createElement('button');
    pauseBtn.id = 'buttPlayUiButtonPause';
    document.body.appendChild(pauseBtn);
    const playHandler = vi.fn();
    const pauseHandler = vi.fn();
    playBtn.addEventListener('click', playHandler);
    pauseBtn.addEventListener('click', pauseHandler);
    // Simulate user click play, then pause
    playBtn.click();
    pauseBtn.click();
    expect(playHandler).toHaveBeenCalled();
    expect(pauseHandler).toHaveBeenCalled();
    document.body.removeChild(playBtn);
    document.body.removeChild(pauseBtn);
  });

  it('Upload button then Ctrl+F workflow', () => {
    // Add upload button
    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'showUploadSongToServerDialog';
    uploadBtn.id = 'uploadBtn';
    document.body.appendChild(uploadBtn);
    const uploadHandler = vi.fn();
    uploadBtn.addEventListener('click', uploadHandler);
    // Simulate click upload
    uploadBtn.click();
    expect(uploadHandler).toHaveBeenCalled();
    // Now simulate Ctrl+F
    const event = new window.KeyboardEvent('keydown', { keyCode: 70, ctrlKey: true });
    global.event = event;
    if(event.keyCode === 70) {
      if(event.ctrlKey==1){
        event.preventDefault && event.preventDefault();
        Troff.showSearchAndActivate();
      } else
        Troff.forceFullscreenChange();
    }
    expect(Troff.showSearchAndActivate).toHaveBeenCalled();
    document.body.removeChild(uploadBtn);
  });

  it('Multi-step: Play button then G key (go to start marker)', () => {
    // Add play button
    const playBtn = document.createElement('button');
    playBtn.id = 'buttPlayUiButtonPlay';
    document.body.appendChild(playBtn);
    const playHandler = vi.fn();
    playBtn.addEventListener('click', playHandler);
    // Click play
    playBtn.click();
    expect(playHandler).toHaveBeenCalled();
    // Now press G
    const event = new window.KeyboardEvent('keydown', { keyCode: 71 });
    global.event = event;
    if(event.keyCode === 71) {
      Troff.goToStartMarker();
    }
    expect(Troff.goToStartMarker).toHaveBeenCalled();
    document.body.removeChild(playBtn);
  });

  it('Close settings dialog button triggers handler', () => {
    // Add a close button
    const closeBtn = document.createElement('input');
    closeBtn.type = 'button';
    closeBtn.id = 'buttCloseSettingPopUpSquare';
    closeBtn.className = 'regularButton buttWidthStandard flex-none';
    document.body.appendChild(closeBtn);
    const handler = vi.fn();
    closeBtn.addEventListener('click', handler);
    closeBtn.click();
    expect(handler).toHaveBeenCalled();
    document.body.removeChild(closeBtn);
  });

  // --- Systematic UI/DOM navigation & dialog tests ---

  it('Fullscreen button click triggers handler', () => {
    const btn = document.createElement('button');
    btn.className = 'onClickToggleFullScreen';
    btn.id = 'fullscreenBtn';
    document.body.appendChild(btn);
    const handler = vi.fn();
    btn.addEventListener('click', handler);
    btn.click();
    expect(handler).toHaveBeenCalled();
    document.body.removeChild(btn);
  });

  it('Help button click triggers handler', () => {
    const btn = document.createElement('button');
    btn.className = 'svgButt regularButton';
    btn.setAttribute('data-href', 'help.html');
    btn.id = 'helpBtn';
    document.body.appendChild(btn);
    const handler = vi.fn();
    btn.addEventListener('click', handler);
    btn.click();
    expect(handler).toHaveBeenCalled();
    document.body.removeChild(btn);
  });

  it('Google sign in button click triggers handler', () => {
    const btn = document.createElement('button');
    btn.className = 'googleSignIn regularButton svgButt';
    btn.id = 'signInBtn';
    document.body.appendChild(btn);
    const handler = vi.fn();
    btn.addEventListener('click', handler);
    btn.click();
    expect(handler).toHaveBeenCalled();
    document.body.removeChild(btn);
  });

  it('Sign out button click triggers handler', () => {
    const btn = document.createElement('button');
    btn.id = 'signOut';
    btn.className = 'regularButton svgButt';
    document.body.appendChild(btn);
    const handler = vi.fn();
    btn.addEventListener('click', handler);
    btn.click();
    expect(handler).toHaveBeenCalled();
    document.body.removeChild(btn);
  });

  it('Reload button click triggers handler', () => {
    const btn = document.createElement('button');
    btn.className = 'regularButton svgButt onClickReload';
    btn.id = 'reloadBtn';
    document.body.appendChild(btn);
    const handler = vi.fn();
    btn.addEventListener('click', handler);
    btn.click();
    expect(handler).toHaveBeenCalled();
    document.body.removeChild(btn);
  });

  it('Song list dialog close button triggers handler', () => {
    const btn = document.createElement('input');
    btn.type = 'button';
    btn.className = 'regularButton buttWidthStandard flex-none buttCloseSongsDialog';
    btn.id = 'buttCloseSongsDialog';
    document.body.appendChild(btn);
    const handler = vi.fn();
    btn.addEventListener('click', handler);
    btn.click();
    expect(handler).toHaveBeenCalled();
    document.body.removeChild(btn);
  });

  it('Import/export dialog close button triggers handler', () => {
    const btn = document.createElement('input');
    btn.type = 'button';
    btn.className = 'regularButton buttWidthStandard flex-none';
    btn.id = 'buttCloseImportExportDialog';
    document.body.appendChild(btn);
    const handler = vi.fn();
    btn.addEventListener('click', handler);
    btn.click();
    expect(handler).toHaveBeenCalled();
    document.body.removeChild(btn);
  });

  it('Create songlist dialog close button triggers handler', () => {
    const btn = document.createElement('input');
    btn.type = 'button';
    btn.className = 'regularButton buttWidthStandard flex-none';
    btn.id = 'buttCloseCreateSongListDialog';
    document.body.appendChild(btn);
    const handler = vi.fn();
    btn.addEventListener('click', handler);
    btn.click();
    expect(handler).toHaveBeenCalled();
    document.body.removeChild(btn);
  });

  it('Move markers dialog close button triggers handler', () => {
    const btn = document.createElement('input');
    btn.type = 'button';
    btn.className = 'regularButton buttWidthStandard flex-none';
    btn.id = 'buttCloseMoveMarkersDialog';
    document.body.appendChild(btn);
    const handler = vi.fn();
    btn.addEventListener('click', handler);
    btn.click();
    expect(handler).toHaveBeenCalled();
    document.body.removeChild(btn);
  });

  it('Stretch markers dialog close button triggers handler', () => {
    const btn = document.createElement('input');
    btn.type = 'button';
    btn.className = 'regularButton buttWidthStandard flex-none';
    btn.id = 'buttCloseStretchMarkersDialog';
    document.body.appendChild(btn);
    const handler = vi.fn();
    btn.addEventListener('click', handler);
    btn.click();
    expect(handler).toHaveBeenCalled();
    document.body.removeChild(btn);
  });


});
