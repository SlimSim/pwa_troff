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

  // buttCopyUrlToClipboard and other DOM/jQuery heavy methods would require more setup/mocks, so we skip them here.

  // Test suite for the createHash function
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
  });
});
