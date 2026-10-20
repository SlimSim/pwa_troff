import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { updateFooterWithCurrentSong } from '../utils/current-song.js';
import { nDB } from '../assets/internal/db.js';
import { BottomNav } from '../components/molecule/t-footer.js';
import {
  TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_VOLUME_VALUE,
  TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_PAUSE_BEFORE_VALUE,
  TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_SPEED_VALUE,
} from '../constants/constants.js';

/**
 * FEATURE SPEC: updateFooterWithCurrentSong() (utils/current-song.ts) already
 * reads the "Default Song Values" nDB keys as fallbacks for the CURRENT
 * volume/speed/pauseBefore/waitBetween/incrementUntil values. It must
 * ADDITIONALLY push those nDB-configured defaults onto the footer's new
 * `default*Value` properties, because those properties are the reset targets
 * rendered by the t-dial reset buttons (`.defaultValue=${this.default...}`).
 *
 * Fallbacks: volume 75, speed 100, pauseBefore 3.
 *
 * These tests import the REAL updateFooterWithCurrentSong() and the REAL
 * <t-footer> (no re-implementation) with a mocked nDB (in-memory store, same
 * pattern as the other tests/ suites) — no real services are called.
 * They are RED while the footer lacks the default*Value properties:
 * updateFooterWithCurrentSong() never sets them, so they read `undefined`.
 */

type FooterWithDefaultValues = BottomNav & {
  defaultVolumeValue: number;
  defaultPauseBeforeValue: number;
  defaultSpeedValue: number;
};

function withDefaults(footer: BottomNav): FooterWithDefaultValues {
  return footer as FooterWithDefaultValues;
}

const nDBStore: Record<string, unknown> = {};

vi.mock('../assets/internal/db.js', () => ({
  nDB: {
    get: vi.fn((key: string) => nDBStore[key] ?? null),
    set: vi.fn((key: string, value: unknown) => {
      nDBStore[key] = value;
    }),
  },
}));

const SONG_PATH = 'test-song.mp3';

describe('updateFooterWithCurrentSong pushes Default Song Values onto footer.default*Value', () => {
  let footer: BottomNav;

  beforeEach(async () => {
    Object.keys(nDBStore).forEach((key) => delete nDBStore[key]);

    footer = new BottomNav();
    footer.id = 'footer';
    document.body.appendChild(footer);
    await footer.updateComplete;

    // updateFooterWithCurrentSong() only syncs while a current song exists.
    nDB.set('stroCurrentSongPathAndGalleryId', { strPath: SONG_PATH, iGalleryId: 'gallery-1' });
    nDB.set(SONG_PATH, {});
  });

  afterEach(() => {
    if (document.body.contains(footer)) {
      document.body.removeChild(footer);
    }
  });

  it('sanity: the configured nDB volume default is used as the CURRENT volume fallback', () => {
    nDB.set(TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_VOLUME_VALUE, 50);

    updateFooterWithCurrentSong();

    // Baseline behaviour that already exists today — proves the setup is wired.
    expect(footer.volume).toBe(50);
  });

  it('sets footer.defaultVolumeValue from nDB (50)', () => {
    nDB.set(TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_VOLUME_VALUE, 50);

    updateFooterWithCurrentSong();

    expect(withDefaults(footer).defaultVolumeValue).toBe(50);
  });

  it('falls back to 75 when no volume default is configured', () => {
    delete nDBStore[TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_VOLUME_VALUE];

    updateFooterWithCurrentSong();

    expect(withDefaults(footer).defaultVolumeValue).toBe(75);
  });

  it('sets footer.defaultPauseBeforeValue from nDB (8)', () => {
    nDB.set(TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_PAUSE_BEFORE_VALUE, 8);

    updateFooterWithCurrentSong();

    expect(withDefaults(footer).defaultPauseBeforeValue).toBe(8);
  });

  it('sets footer.defaultSpeedValue from nDB (90)', () => {
    nDB.set(TROFF_SAVE_VALUE_TROFF_SETTING_SONG_DEFAULT_SPEED_VALUE, 90);

    updateFooterWithCurrentSong();

    expect(withDefaults(footer).defaultSpeedValue).toBe(90);
  });
});
