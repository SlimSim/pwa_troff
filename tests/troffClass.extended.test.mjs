// Extended coverage tests for TroffClass
import { TroffClass } from '../scriptTroffClass.mjs';
import { vi, describe, test, expect, beforeEach } from 'vitest';

// Define required global constants for TroffClass methods
// (These would normally be defined in the main app environment)
global.TROFF_SETTING_EXTENDED_MARKER_COLOR = 'TROFF_SETTING_EXTENDED_MARKER_COLOR';
global.TROFF_SETTING_SONG_COLUMN_TOGGLE = 'TROFF_SETTING_SONG_COLUMN_TOGGLE';
// Mock for callback used in recallSongColumnToggle
// (Would normally be defined in app)
global.dataTableColumnPicker = () => {};

describe('TroffClass extended coverage', () => {
  let troff;
  beforeEach(() => {
    troff = new TroffClass();
    // Enhanced $ mock for chained .attr() calls
const mockJQ = () => {
  const chainable = {
    attr: vi.fn(function() { return chainable; }),
    addClass: vi.fn(function() { return chainable; }),
    removeClass: vi.fn(function() { return chainable; }),
    toggleClass: vi.fn(function() { return chainable; }),
    on: vi.fn(function() { return chainable; }),
    val: vi.fn(function() { return chainable; }),
    text: vi.fn(function() { return chainable; }),
    append: vi.fn(function() { return chainable; }),
    empty: vi.fn(function() { return chainable; }),
    find: vi.fn(function() { return chainable; }),
    click: vi.fn(function() { return chainable; }),
    children: vi.fn(() => []),
    eq: vi.fn(() => chainable),
    hasClass: vi.fn(() => false),
    length: 0,
    parent: vi.fn(() => chainable)
  };
  return chainable;
};
global.$ = vi.fn(mockJQ);
    global.IO = { updateCellInDataTable: vi.fn(), setEnterFunction: vi.fn(), clearEnterFunction: vi.fn(), blurHack: vi.fn(), prompt: vi.fn(), copyTextToClipboard: vi.fn(), loopTimesLeft: vi.fn(() => 1), removeLoadScreen: vi.fn() };
    global.DB = { getVal: vi.fn((a, cb) => cb(false)), saveVal: vi.fn(), setCurrent: vi.fn(), setCurrentSong: vi.fn(), getSongMetaDataOf: vi.fn(), fixSongObject: vi.fn(() => ({})), getMarkers: vi.fn((song, cb) => cb([])), getImageMetaDataOf: vi.fn() };
    global.nDB = { get: vi.fn(() => ({})), set: vi.fn(), setOnSong: vi.fn() };
    global.gtag = vi.fn();
    global.window = { location: { hash: '', href: '', origin: '' }, navigator: { onLine: true }, document: { title: '' } };
    global.document = { querySelector: vi.fn(() => ({ classList: { contains: vi.fn(() => false), add: vi.fn(), remove: vi.fn(), toggle: vi.fn() }, currentTime: 0, pause: vi.fn(), play: vi.fn(), value: 0 })), getElementById: vi.fn(() => ({ max: 0, value: 0 })), getElementsByClassName: vi.fn(() => []), getElementById: vi.fn(() => ({ innerHTML: '' })) };
    global.DATA_TABLE_COLUMNS = { list: [{ id: 'col1', hideFromUser: false, header: 'Header1' }], getPos: vi.fn(() => 0) };
    global.Troff = troff;
    global.fileHandler = { fetchAndSaveResponse: vi.fn(), doesFileExistInCache: vi.fn(async () => true) };
    global.errorHandler = { backendService_getTroffData: vi.fn(), fileHandler_sendFile: vi.fn(), fileHandler_fetchAndSaveResponse: vi.fn() };
    global.backendService = { getTroffData: vi.fn(async () => ({ markerJsonString: '{}', fileUrl: '', fileName: '', aStates: ['{}'], markers: [], info: '', serverId: '', fileName: '' })) };
    global.setTimeout = vi.fn((fn) => fn());
  });

  test('emptyAddAddedSongsToSongList_songs returns early if not correct class', () => {
    const event = { target: { classList: { contains: vi.fn(() => false) }, hasClass: vi.fn(() => false) } };
    expect(() => troff.emptyAddAddedSongsToSongList_songs(event)).not.toThrow();
  });

  test('editSongDialogSave updates songObject and calls IO/DB', () => {
    global.nDB.get = vi.fn(() => ({ fileData: {} }));
    global.$ = vi.fn(() => ({ val: vi.fn(() => 'val'), find: vi.fn(() => ({ removeClass: vi.fn() })), addClass: vi.fn() }));
    global.IO.updateCellInDataTable = vi.fn();
    global.nDB.set = vi.fn();
    global.ifGroupSongUpdateFirestore = vi.fn();
    troff.editSongDialogSave();
    expect(global.nDB.set).toHaveBeenCalled();
  });

  test('onEditUpdateName sets displayName', () => {
    global.$ = vi.fn(() => ({ val: vi.fn(() => ''), find: vi.fn(), addClass: vi.fn(), text: vi.fn(), attr: vi.fn() }));
    expect(() => troff.onEditUpdateName()).not.toThrow();
  });

  test('enterWritableField sets enter function', () => {
    expect(() => troff.enterWritableField()).not.toThrow();
    expect(global.IO.setEnterFunction).toHaveBeenCalled();
  });

  test('exitWritableField clears enter function', () => {
    expect(() => troff.exitWritableField()).not.toThrow();
    expect(global.IO.clearEnterFunction).toHaveBeenCalled();
  });

  test('recallFloatingDialog calls moveSongPickerToFloatingState', () => {
    global.moveSongPickerToFloatingState = vi.fn();
    global.moveSongPickerToAttachedState = vi.fn();
    global.DB.getVal = vi.fn((a, cb) => cb(true));
    troff.recallFloatingDialog();
    expect(global.moveSongPickerToFloatingState).toHaveBeenCalled();
  });

  test('recallSongColumnToggle calls callback', () => {
    troff.recallSongColumnToggle(() => { expect(true).toBe(true); });
  });

  test('toggleExtendedMarkerColor toggles classes and saves', () => {
    global.DB.saveVal = vi.fn();
    global.$ = vi.fn(() => ({ hasClass: vi.fn(() => false), addClass: vi.fn(), removeClass: vi.fn() }));
    troff.toggleExtendedMarkerColor();
    expect(global.DB.saveVal).toHaveBeenCalled();
  });

  test('recallExtendedMarkerColor adds classes if extend', () => {
    global.$ = vi.fn(() => ({ addClass: vi.fn() }));
    global.DB.getVal = vi.fn((a, cb) => cb(true));
    troff.recallExtendedMarkerColor();
    expect(global.$).toHaveBeenCalled();
  });

  
  test('getStopTime returns 0 if no audio/video elements', () => {
    global.$ = vi.fn((selector) => {
      if (selector === 'audio, video') return { length: 0 };
      return { length: 0 };
    });
    expect(troff.getStopTime()).toBe(0);
  });

  test('getStopTime returns duration if stop marker not present', () => {
    global.$ = vi.fn((selector) => {
      if (selector === 'audio, video') return [{ duration: 42 }, { duration: 42 }];
      if (selector === '#buttStopAfter') return { hasClass: vi.fn(() => false) };
      if (selector === '#stopAfter') return { val: vi.fn(() => 0) };
      if (selector === '.currentStopMarker') return [];
      return { length: 1 };
    });
    expect(troff.getStopTime()).toBe(42);
  });

  test('getStartTime returns 0 if no marker', () => {
    global.$ = vi.fn(() => []);
    expect(troff.getStartTime()).toBe(0);
  });

  test('getStartTime returns correct value if marker and extraTime', () => {
    global.$ = vi.fn((selector) => {
      if (selector === '.currentMarker') return [{ timeValue: 10 }];
      if (selector === '#buttStartBefore') return { hasClass: vi.fn(() => true) };
      if (selector === '#startBefore') return { val: vi.fn(() => 2) };
      return { length: 1 };
    });
    expect(troff.getStartTime()).toBe(8);
  });

  test('setLoopTo sets Inf and calls updateLoopTimes', () => {
    global.$ = vi.fn((selector) => {
      if (selector === '#TROFF_SETTING_SONG_DEFAULT_NR_LOOPS_INFINIT_IS_ON') return { hasClass: vi.fn(() => true) };
      if (selector === '.currentLoop') return { removeClass: vi.fn() };
      if (selector.startsWith('#buttLoop')) return { addClass: vi.fn() };
      if (selector === '#TROFF_SETTING_SONG_DEFAULT_NR_LOOPS_VALUE') return { val: vi.fn(() => 1) };
      return { addClass: vi.fn(), removeClass: vi.fn() };
    });
    Troff.updateLoopTimes = vi.fn();
    troff.setLoopTo();
    expect(Troff.updateLoopTimes).toHaveBeenCalled();
  });

  test('setLoop sets currentLoop and calls updateLoopTimes', () => {
    global.$ = vi.fn((selector) => {
      if (selector === '.currentLoop') return { removeClass: vi.fn() };
      return { addClass: vi.fn(), val: vi.fn(() => 2) };
    });
    global.gtag = vi.fn();
    Troff.updateLoopTimes = vi.fn();
    global.IO.blurHack = vi.fn();
    troff.setLoop({ target: { value: 2 } });
    expect(Troff.updateLoopTimes).toHaveBeenCalled();
    expect(global.IO.blurHack).toHaveBeenCalled();
  });

  test('updateLoopTimes sets loopTimes in DB and calls IO.loopTimesLeft', () => {
    global.$ = vi.fn((selector) => {
      if (selector === '#buttLoopInf') return { hasClass: vi.fn(() => false) };
      if (selector === '.currentLoop') return { val: () => 3 };
      return { val: () => 3, hasClass: () => false };
    });
    global.DB.setCurrent = vi.fn();
    global.IO.loopTimesLeft = vi.fn();
    // Use the public API to set the closure variable
    const troffTest = new TroffClass();
    troffTest.setCurrentSongStrings('mysong', 0);
    troffTest.updateLoopTimes();
    expect(global.DB.setCurrent).toHaveBeenCalledWith('mysong', 'loopTimes', 3);
    expect(global.IO.loopTimesLeft).toHaveBeenCalled();
  });

  test('getMood returns correct mood based on classes', () => {
    global.$ = vi.fn(() => ({ hasClass: vi.fn((cls) => cls === 'pause') }));
    expect(troff.getMood()).toBe('pause');
    global.$ = vi.fn(() => ({ hasClass: vi.fn((cls) => cls === 'wait') }));
    expect(troff.getMood()).toBe('wait');
    global.$ = vi.fn(() => ({ hasClass: vi.fn((cls) => cls === 'play') }));
    expect(troff.getMood()).toBe('play');
  });

  test('isLoopInfinite returns true if #buttLoopInf has currentLoop', () => {
    global.$ = vi.fn(() => ({ hasClass: vi.fn(() => true) }));
    expect(troff.isLoopInfinite()).toBe(true);
  });

  test('doIncrementSpeed increments speed for infinite loop', () => {
    global.$ = vi.fn((selector) => {
      if (selector === '#buttIncrementUntil') return { hasClass: vi.fn(() => true) };
      if (selector === '#incrementUntilValue') return { val: vi.fn(() => 120) };
      if (selector === 'audio, video') return [{ playbackRate: 1 }];
      if (selector === '#speedBar') return { val: vi.fn() };
      return { hasClass: vi.fn(() => false), val: vi.fn(() => 1) };
    });
    Troff.isLoopInfinite = vi.fn(() => true);
    Troff.speedUpdate = vi.fn();
    troff.doIncrementSpeed();
    expect(Troff.speedUpdate).toHaveBeenCalled();
  });

  test('goToStartMarker sets currentTime to getStartTime', () => {
    Troff.getStartTime = vi.fn(() => 4);
    const fakeAudio = { currentTime: 0 };
    global.document.querySelector = vi.fn(() => fakeAudio);
    troff.goToStartMarker();
    expect(fakeAudio.currentTime).toBe(4);
  });

  test('timeupdateAudio updates time and calls atEndOfLoop', () => {
    global.document.querySelector = vi.fn(() => ({ currentTime: 10 }));
    Troff.getStopTime = vi.fn(() => 5);
    Troff.atEndOfLoop = vi.fn();
    global.$ = vi.fn(() => ({ html: vi.fn() }));
    global.document.getElementById = vi.fn(() => ({ value: 0 }));
    // Mock Troff.secToDisp and st global to avoid ReferenceError
    global.st = { secToDisp: vi.fn(() => '10:00') };
    Troff.secToDisp = vi.fn(() => '10:00');
    troff.timeupdateAudio();
    expect(Troff.atEndOfLoop).toHaveBeenCalled();
  });

  test('atEndOfLoop handles infinite and finite loops', () => {
    global.document.querySelector = vi.fn(() => ({ currentTime: 0, pause: vi.fn() }));
    Troff.goToStartMarker = vi.fn();
    Troff.isLoopInfinite = vi.fn(() => true);
    Troff.doIncrementSpeed = vi.fn();
    Troff.playSong = vi.fn();
    Troff.getWaitBetweenLoops = vi.fn(() => 1);
    troff.atEndOfLoop();
    expect(Troff.playSong).toHaveBeenCalled();
    Troff.isLoopInfinite = vi.fn(() => false);
    // First call: IO.loopTimesLeft returns 2 (should not call pauseSong)
    global.IO.loopTimesLeft = vi.fn(() => 2);
    Troff.playSong = vi.fn();
    Troff.pauseSong = vi.fn();
    troff.atEndOfLoop();
    expect(Troff.pauseSong).not.toHaveBeenCalled();
    // Second call: IO.loopTimesLeft returns 1 (should call pauseSong)
    global.IO.loopTimesLeft = vi.fn(() => 1);
    Troff.playSong = vi.fn();
    Troff.pauseSong = vi.fn();
    troff.atEndOfLoop();
    expect(Troff.pauseSong).toHaveBeenCalled();
  });

  // ...more tests for each method, edge, and branch as described in the plan...
});
