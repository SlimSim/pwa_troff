import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { CurrentSongControls } from '../components/molecule/t-current-song-controls.js';
import type { DetailsElement } from '../components/atom/t-details.js';

/**
 * Feature: song "States" UI moves OUT of t-settings-panel and INTO the existing
 * <t-details title="Advanced"> inside t-current-song-controls.
 *
 * These tests encode the NEW desired behavior. They are expected to be RED until
 * the feature is implemented in components/molecule/t-current-song-controls.ts.
 */

describe('CurrentSongControls — song States live inside the Advanced panel', () => {
  let element: CurrentSongControls;

  beforeEach(async () => {
    // Silence network fetches for icons in happy-dom (no dev server)
    const fetchMock = vi.fn(
      async () =>
        new Response(
          `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor"><path d="M0 0h24v24H0z" fill="none"/></svg>`,
          { status: 200 }
        )
    );
    vi.stubGlobal('fetch', fetchMock);

    // Dynamic import — child element registrations happen once due to ESM caching
    const { CurrentSongControls } = await import(
      '../components/molecule/t-current-song-controls.js'
    );

    element = new CurrentSongControls();
    document.body.appendChild(element);
    await element.updateComplete;
  });

  afterEach(() => {
    if (element && document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function getAdvancedDetails(): DetailsElement | undefined {
    return Array.from(
      element.shadowRoot?.querySelectorAll('t-details') ?? []
    ).find((d) => d.title === 'Advanced') as DetailsElement | undefined;
  }

  it('contains a "Remember state" t-butt inside the Advanced panel', () => {
    const advanced = getAdvancedDetails();
    expect(advanced).toBeTruthy();
    const butts = Array.from(advanced!.querySelectorAll('t-butt'));
    const remember = butts.find((b) =>
      (b.textContent || '').toLowerCase().includes('remember state')
    );
    expect(remember, 'Expected a t-butt labelled "Remember state" in the Advanced panel').toBeTruthy();
  });

  it('contains a t-help-tip with h3="State" whose content explains states', () => {
    const advanced = getAdvancedDetails();
    expect(advanced).toBeTruthy();
    const tip = advanced!.querySelector('t-help-tip') as HTMLElement | null;
    expect(tip, 'Expected a t-help-tip inside the Advanced panel').toBeTruthy();
    // The h3 attribute/property must be exactly "State"
    expect((tip as unknown as { h3: string }).h3).toBe('State');
    // Its (slotted / pop-up) content must explain the feature.
    // Normalize whitespace because the slotted <p> may wrap across source lines.
    const tipText = (tip!.textContent || '').replace(/\s+/g, ' ').trim();
    expect(tipText).toContain(
      'Remember selected markers, tempo, loops and more to quickly restore your song settings.'
    );
  });

  it('renders a .state-item row per songStates entry with set/remove controls', async () => {
    (element as unknown as { songStates: string[] }).songStates = [
      JSON.stringify({ name: 'State A' }),
      JSON.stringify({ name: 'State B' }),
    ];
    await element.updateComplete;

    const advanced = getAdvancedDetails();
    const items = advanced!.querySelectorAll('.state-item');
    expect(items.length, 'Expected one .state-item per songState entry').toBe(2);

    // first row: set button shows the stored name, remove button contains a delete icon
    const firstRow = items[0];
    const setButt = firstRow.querySelectorAll('t-butt')[0];
    const removeButt = firstRow.querySelectorAll('t-butt')[1];
    expect((setButt.textContent || '')).toContain('State A');
    expect(removeButt.querySelector('t-icon')?.getAttribute('name')).toBe('delete');
  });

  it('dispatches song-action-requested { action: "rememberState" } when Remember state is clicked', async () => {
    const advanced = getAdvancedDetails();
    const butts = Array.from(advanced!.querySelectorAll('t-butt'));
    const remember = butts.find((b) =>
      (b.textContent || '').toLowerCase().includes('remember state')
    );
    expect(remember, 'Expected a t-butt labelled "Remember state"').toBeTruthy();

    const handler = vi.fn();
    element.addEventListener('song-action-requested', handler);

    remember!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { action: 'rememberState' } })
    );
  });

  it('dispatches song-action-requested { action: "setState", index } when a state row set button is clicked', async () => {
    (element as unknown as { songStates: string[] }).songStates = [
      JSON.stringify({ name: 'State A' }),
      JSON.stringify({ name: 'State B' }),
    ];
    await element.updateComplete;

    const advanced = getAdvancedDetails();
    const firstRow = advanced!.querySelectorAll('.state-item')[0];
    expect(firstRow, 'Expected a .state-item row to exist for setState').toBeTruthy();
    const setButt = firstRow.querySelectorAll('t-butt')[0];

    const handler = vi.fn();
    element.addEventListener('song-action-requested', handler);

    setButt.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { action: 'setState', index: 0 } })
    );
  });

  it('dispatches song-action-requested { action: "removeState", index } when a state row remove button is clicked', async () => {
    (element as unknown as { songStates: string[] }).songStates = [
      JSON.stringify({ name: 'State A' }),
      JSON.stringify({ name: 'State B' }),
    ];
    await element.updateComplete;

    const advanced = getAdvancedDetails();
    const firstRow = advanced!.querySelectorAll('.state-item')[0];
    expect(firstRow, 'Expected a .state-item row to exist for removeState').toBeTruthy();
    const removeButt = firstRow.querySelectorAll('t-butt')[1];

    const handler = vi.fn();
    element.addEventListener('song-action-requested', handler);

    removeButt.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { action: 'removeState', index: 0 } })
    );
  });
});
