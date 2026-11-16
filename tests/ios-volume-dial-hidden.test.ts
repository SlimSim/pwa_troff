import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LitElement } from 'lit';

/**
 * FEATURE SPEC: on iOS the in-app Volume dials must not be rendered at all.
 *
 * iOS never uses the Web Audio volume graph (building it causes audible
 * playback skipping) and element volume is a no-op there, so loudness is
 * hardware-buttons-only — the in-app Volume dial would be a dead control.
 *
 * Covered components (each must omit the `t-dial` with label="Volume" when
 * utils/browserEnv.ts isIOSFamily() is true, and keep rendering it otherwise):
 *  - components/molecule/t-footer.ts
 *  - components/molecule/t-current-song-controls.ts
 *  - components/molecule/t-settings-panel.ts
 *
 * utils/browserEnv.js is file-level mocked with a hoisted mutable flag; the
 * component classes under test are the REAL ones imported from source, and the
 * assertions inspect their real shadow DOM.
 */

const mockBrowserEnv = vi.hoisted(() => ({ isIOSFamily: false }));

vi.mock('../utils/browserEnv.js', () => ({
  isIOSFamily: () => mockBrowserEnv.isIOSFamily,
  isTablet: () => false,
  isSafari: false,
  isIphone: false,
  isIpad: false,
  isAndroid: false,
  isPhone: false,
  usePhoneLog: false,
  isMessengerInAppBrowser: () => false,
}));

import { BottomNav } from '../components/molecule/t-footer.js';
import { CurrentSongControls } from '../components/molecule/t-current-song-controls.js';
import { SettingsPanel } from '../components/molecule/t-settings-panel.js';

/** A rendered <t-dial> exposes `label` as a property and as an attribute. */
interface DialLike extends Element {
  label?: string;
}

/** The <t-dial label="Volume"> living directly in this component's shadow tree. */
function findVolumeDial(el: LitElement): DialLike | null {
  const root = el.shadowRoot;
  if (!root) {
    return null;
  }
  const dials = Array.from(root.querySelectorAll('t-dial')) as DialLike[];
  for (const dial of dials) {
    const label = typeof dial.label === 'string' ? dial.label : dial.getAttribute('label');
    if (label === 'Volume') {
      return dial;
    }
  }
  return null;
}

interface ComponentCase {
  name: string;
  create: () => LitElement;
}

const COMPONENTS: ComponentCase[] = [
  { name: 't-footer', create: () => new BottomNav() },
  { name: 't-current-song-controls', create: () => new CurrentSongControls() },
  { name: 't-settings-panel', create: () => new SettingsPanel() },
];

const mounted: LitElement[] = [];

async function mount(create: () => LitElement): Promise<LitElement> {
  const el = create();
  document.body.appendChild(el);
  await el.updateComplete;
  mounted.push(el);
  return el;
}

beforeEach(() => {
  mockBrowserEnv.isIOSFamily = false;
});

afterEach(() => {
  for (const el of mounted.splice(0)) {
    if (document.body.contains(el)) {
      document.body.removeChild(el);
    }
  }
});

describe.each(COMPONENTS)('$name Volume dial visibility', ({ create }) => {
  it('does NOT render a t-dial with label "Volume" when isIOSFamily() is true', async () => {
    mockBrowserEnv.isIOSFamily = true;
    const el = await mount(create);
    expect(findVolumeDial(el), 'iOS must not render the in-app Volume dial').toBeNull();
  });

  it('still renders a t-dial with label "Volume" when isIOSFamily() is false', async () => {
    mockBrowserEnv.isIOSFamily = false;
    const el = await mount(create);
    expect(findVolumeDial(el), 'non-iOS must keep the in-app Volume dial').not.toBeNull();
  });
});
