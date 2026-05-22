import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDuration } from '../utils/formatters.js';
import * as constants from '../constants/constants.js';

describe('v2Script utilities and related functions', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  describe('formatDuration (actual implementation)', () => {
    it('should format zero seconds as 0:00', () => {
      expect(formatDuration(0)).toBe('0:00');
    });

    it('should format negative seconds as 0:00', () => {
      expect(formatDuration(-10)).toBe('0:00');
    });

    it('should format null/undefined as 0:00', () => {
      expect(formatDuration(null as unknown as number)).toBe('0:00');
      expect(formatDuration(undefined as unknown as number)).toBe('0:00');
    });

    it('should format seconds less than a minute', () => {
      expect(formatDuration(30)).toBe('0:30');
      expect(formatDuration(59)).toBe('0:59');
    });

    it('should format exact minutes', () => {
      expect(formatDuration(60)).toBe('1:00');
      expect(formatDuration(120)).toBe('2:00');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(90)).toBe('1:30');
      expect(formatDuration(125)).toBe('2:05');
      expect(formatDuration(3661)).toBe('61:01');
    });

    it('should round down seconds', () => {
      expect(formatDuration(30.9)).toBe('0:30');
      expect(formatDuration(60.7)).toBe('1:00');
    });
  });

  describe('TROFF constants (actual implementation)', () => {
    it('should have required TROFF setting constants defined', () => {
      expect(constants.TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR).toBeDefined();
      expect(constants.TROFF_SETTING_ENTER_RESET_COUNTER).toBeDefined();
      expect(constants.TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR).toBeDefined();
      expect(constants.TROFF_SETTING_SPACE_RESET_COUNTER).toBeDefined();
      expect(constants.TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR).toBeDefined();
      expect(constants.TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER).toBeDefined();
    });

    it('should have correct constant string values', () => {
      expect(constants.TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR).toBe(
        'TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR'
      );
      expect(constants.TROFF_SETTING_SPACE_RESET_COUNTER).toBe('TROFF_SETTING_SPACE_RESET_COUNTER');
    });
  });

  describe('marker dialog defaults integration', () => {
    it('sets marker dialog initial time and suggested name on marker-dialog-opened', async () => {
      const footer = document.createElement('div');
      footer.id = 'footer';
      document.body.appendChild(footer);

      vi.doMock('../utils/current-song.js', () => ({
        updateHeaderWithCurrentSong: vi.fn(),
        setCurrentSong: vi.fn(),
        getCurrentSongMetadata: vi.fn(() => ({ duration: 120 })),
        getCurrentSongKey: vi.fn(() => 'song-1'),
        updateFooterWithCurrentSong: vi.fn(),
      }));

      vi.doMock('../assets/internal/db.js', () => ({
        nDB: {
          get: vi.fn(() => ({ markers: [{ id: 'm1' }, { id: 'm2' }] })),
          set: vi.fn(),
          setOnSong: vi.fn(),
        },
      }));

      vi.doMock('../services/audio.js', () => ({
        audio: {
          currentTime: 37,
          duration: 120,
          playbackRate: 1,
          volume: 1,
          addEventListener: vi.fn(),
        },
        loadSong: vi.fn(),
      }));

      await import('../v2Script.js');

      document.dispatchEvent(new Event('DOMContentLoaded'));
      footer.dispatchEvent(
        new CustomEvent('marker-dialog-opened', {
          bubbles: true,
          composed: true,
        })
      );

      expect(
        (footer as HTMLElement & { markerDialogInitialTime?: number }).markerDialogInitialTime
      ).toBe(37);
      expect(
        (footer as HTMLElement & { markerDialogSuggestedName?: string }).markerDialogSuggestedName
      ).toBe('marker nr 3');
    });
  });
});
