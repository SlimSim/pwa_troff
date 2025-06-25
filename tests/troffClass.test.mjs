// Import the actual TroffClass from the module
import { TroffClass } from '../scriptTroffClass.mjs';
import { vi, describe, test, expect, beforeEach } from 'vitest';

// Mock any browser-specific globals that might be used
global.$ = vi.fn();
global.window = {
  location: {
    hash: '',
    origin: 'http://localhost',
    pathname: '/',
    search: ''
  }
};

describe('TroffClass', () => {
  let troff;
  beforeEach(() => {
    troff = new TroffClass();
  });

  describe('removeLocalInfo', () => {
    test('removes localInformation property from markerObject', () => {
      const marker = { foo: 1, localInformation: { bar: 2 } };
      const result = troff.removeLocalInfo({ ...marker });
      expect(result.localInformation).toBeUndefined();
      expect(result.foo).toBe(1);
    });
  });

  describe('setUrlToSong', () => {
    beforeEach(() => {
      // Patch global Troff to point to the instance for method reference
      global.Troff = troff;
    });

    test('sets window.location.hash when serverId and fileName are provided', () => {
      global.window.location.hash = '';
      troff.setUrlToSong('myServer', 'myFile.mp3');
      expect(global.window.location.hash).toBe('#myServer&myFile.mp3');
    });
    
  });

  describe('askIfAddSongsToCurrentSongList', () => {
    beforeEach(() => {
      // Set up DOM mocks
      global.$ = vi.fn(() => ({
        hasClass: vi.fn(() => false),
        removeClass: vi.fn(),
        addClass: vi.fn(),
        append: vi.fn(() => ({ empty: vi.fn() })),
        children: vi.fn(() => ({ length: 0 })),
        text: vi.fn(() => ''),
        empty: vi.fn(),
      }));
      global.document = { title: '' };
    });

    test('returns early if #songListAll has class selected', () => {
      const troff = new TroffClass();
      // Mock $("#songListAll").hasClass to return true
      global.$ = vi.fn((selector) => ({
        hasClass: vi.fn(() => selector === "#songListAll" ? true : false),
        removeClass: vi.fn(),
        addClass: vi.fn(),
        append: vi.fn(() => ({ empty: vi.fn() })),
        children: vi.fn(() => ({ length: 0 })),
        text: vi.fn(() => ''),
        empty: vi.fn(),
      }));
      expect(troff.askIfAddSongsToCurrentSongList('someKey')).toBeUndefined();
    });
  });

  describe('createHash', () => {
    let troff;
    
    // Set up a new TroffClass instance before each test
    beforeEach(() => {
      troff = new TroffClass();
    });
    
    test('creates a hash with serverId and fileName', () => {
      // Arrange
      const serverId = '12345';
      const fileName = 'test-song.mp3';
      
      // Act
      const result = troff.createHash(serverId, fileName);
      
      // Assert
      expect(result).toBe('#12345&test-song.mp3');
    });
    
    test('encodes URI components in the fileName', () => {
      // Arrange
      const serverId = '67890';
      const fileName = 'test song with spaces.mp3';
      
      // Act
      const result = troff.createHash(serverId, fileName);
      
      // Assert
      expect(result).toBe('#67890&test%20song%20with%20spaces.mp3');
    });
    
    test('handles special characters in fileName', () => {
      // Arrange
      const serverId = 'abc123';
      const fileName = 'test_file-with+special&chars.mp3';
      
      // Act
      const result = troff.createHash(serverId, fileName);
      
      // Assert
      expect(result).toBe('#abc123&test_file-with+special&chars.mp3');
    });

    test('handles undefined fileName', () => {
      const serverId = 'id';
      expect(troff.createHash(serverId, undefined)).toBe('#id&undefined');
    });
    test('handles empty serverId', () => {
      expect(troff.createHash('', 'file.mp3')).toBe('#&file.mp3');
    });
    test('handles empty fileName', () => {
      expect(troff.createHash('id', '')).toBe('#id&');
    });
  });
});

describe('uploadSongToServer', () => {
  let troff;
  beforeEach(() => {
    troff = new TroffClass();
    global.Troff = troff;
    // Mock dependencies
    global.nDB = {
      get: vi.fn(() => ({ some: 'marker' })),
      setOnSong: vi.fn(),
    };
    global.fileHandler = {
      sendFile: vi.fn(async () => ({ id: 'id', fileUrl: 'url', fileName: 'file.mp3' })),
    };
    global.$ = vi.fn(() => ({ removeClass: vi.fn(), addClass: vi.fn(), val: vi.fn(), text: vi.fn(), attr: vi.fn() }));
    troff.saveDownloadLinkHistory = vi.fn();
    troff.setUrlToSong = vi.fn();
  });
  test('calls sendFile and updates nDB/setUrlToSong', async () => {
    await troff.uploadSongToServer();
    expect(fileHandler.sendFile).toHaveBeenCalled();
    expect(troff.saveDownloadLinkHistory).toHaveBeenCalled();
    expect(troff.setUrlToSong).toHaveBeenCalled();
  });
});

describe('removeLocalInfo', () => {
  test('returns object even if localInformation is missing', () => {
    const troff = new TroffClass();
    const marker = { foo: 1 };
    const result = troff.removeLocalInfo({ ...marker });
    expect(result.localInformation).toBeUndefined();
    expect(result.foo).toBe(1);
  });
});

describe('selectSongInSongList', () => {
  test('adds selected class to correct element', () => {
    const troff = new TroffClass();
    // Mock $ to track calls
    const addClass = vi.fn();
    global.$ = vi.fn((selector) => {
      if (selector === '#dataSongTable') {
        return { find: vi.fn(() => ({ removeClass: vi.fn() })) };
      }
      return { addClass };
    });
    troff.selectSongInSongList('song.mp3');
    expect(addClass).toHaveBeenCalledWith('selected');
  });
});

describe('showUploadSongToServerDialog', () => {
  let troff;
  beforeEach(() => {
    troff = new TroffClass();
    global.$ = vi.fn(() => ({
      val: vi.fn(),
      addClass: vi.fn(),
      removeClass: vi.fn(),
      text: vi.fn(),
      attr: vi.fn(),
    }));
    global.IO = { alert: vi.fn() };
    global.window = {
      location: { hash: '', href: 'http://localhost', origin: 'http://localhost' },
      navigator: { onLine: true },
    };
    troff.getCurrentSong = vi.fn(() => 'mysong');
  });
  beforeEach(() => {
    // Reset alert mock before each test to avoid call leakage
    IO.alert.mockClear();
  });
  test('shows dialog if no hash and online and song exists', () => {
    window.location.hash = '';
    window.navigator.onLine = true;
    troff.getCurrentSong = vi.fn(() => 'mysong');
    expect(() => troff.showUploadSongToServerDialog()).not.toThrow();
  });
  test('alerts if no song', () => {
    troff.getCurrentSong = vi.fn(() => '');
    troff.showUploadSongToServerDialog();
    expect(IO.alert).toHaveBeenCalledWith(
      'No Song',
      expect.stringContaining('Add a song')
    );
  });
});

describe('buttCopyUrlToClipboard', () => {
  test('calls IO.copyTextToClipboard with url', () => {
    const troff = new TroffClass();
    const url = 'http://localhost/#id&file.mp3';
    global.$ = vi.fn(() => ({ find: vi.fn(() => ({ val: vi.fn(() => url) })) }));
    global.IO = { copyTextToClipboard: vi.fn() };
    troff.buttCopyUrlToClipboard();
    expect(IO.copyTextToClipboard).toHaveBeenCalledWith(url);
  });
});
