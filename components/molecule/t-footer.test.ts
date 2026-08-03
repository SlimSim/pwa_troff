import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BottomNav } from './t-footer.js';
import type { TroffMarker } from '../../types/troff.d.js';

describe('t-footer marker dialog wiring', () => {
  let element: BottomNav;

  beforeEach(() => {
    element = new BottomNav();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  it('passes create defaults to marker dialog', async () => {
    element.showMarkerDropdown = true;
    element.markerDialogMode = 'create';
    element.markerDialogInitialTime = 33;
    element.markerDialogSuggestedName = 'marker nr 7';
    await element.updateComplete;

    const dialog = element.shadowRoot?.querySelector('t-marker-dialog') as HTMLElement & {
      open?: boolean;
      mode?: string;
      initialTime?: number;
      suggestedName?: string;
    };

    expect(dialog).toBeTruthy();
    expect(dialog.open).toBe(true);
    expect(dialog.mode).toBe('create');
    expect(dialog.initialTime).toBe(33);
    expect(dialog.suggestedName).toBe('marker nr 7');
  });

  it('opens edit dialog repeatedly for the same marker', async () => {
    const marker: Partial<TroffMarker> = {
      id: 'marker-1',
      name: 'Marker 1',
      info: 'Info',
      time: 10,
      color: '',
    };

    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback): number => {
        callback(0);
        return 1;
      });

    element.openMarkerDialogForEdit(marker);
    await element.updateComplete;

    expect(element.showMarkerDropdown).toBe(true);
    expect(element.markerDialogMode).toBe('edit');
    expect(element.markerDialogData).toEqual(marker);

    element.openMarkerDialogForEdit(marker);
    await element.updateComplete;

    expect(rafSpy).toHaveBeenCalled();
    expect(element.showMarkerDropdown).toBe(true);
    expect(element.markerDialogMode).toBe('edit');
    expect(element.markerDialogData).toEqual(marker);
  });

  it('ignores nested dropdown toggles while editing', async () => {
    const marker: Partial<TroffMarker> = {
      id: 'marker-2',
      name: 'Marker 2',
      info: 'Info 2',
      time: 12,
      color: '',
    };

    element.openMarkerDialogForEdit(marker);
    await element.updateComplete;

    const markerDialog = element.shadowRoot?.querySelector('t-marker-dialog') as HTMLElement;
    markerDialog.dispatchEvent(
      new CustomEvent('dropdown-toggled', {
        detail: { open: true },
        bubbles: true,
        composed: true,
      })
    );
    await element.updateComplete;

    expect(element.markerDialogMode).toBe('edit');
    expect(element.markerDialogData).toEqual(marker);
    expect(element.showMarkerDropdown).toBe(true);
  });
});

describe('t-footer dropdown mobile positioning', () => {
  let element: BottomNav;

  beforeEach(() => {
    element = new BottomNav();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  it('marker dropdown has mobilePosition="top"', async () => {
    await element.updateComplete;

    // Find the marker dropdown button (the one with t-marker-dialog as dropdown content)
    const dropdownButtons = element.shadowRoot?.querySelectorAll('t-dropdown-button');
    expect(dropdownButtons).toBeTruthy();
    expect(dropdownButtons!.length).toBe(3); // speed, marker, time

    // The marker dropdown is the second one (index 1) - has t-marker-dialog as slot="dropdown"
    const markerDropdown = dropdownButtons![1] as HTMLElement & { mobilePosition?: string };

    expect(markerDropdown).toBeTruthy();
    expect(markerDropdown.mobilePosition).toBe('top');
  });

  it('speed dropdown does NOT have mobilePosition="top" (uses default "auto")', async () => {
    await element.updateComplete;

    const dropdownButtons = element.shadowRoot?.querySelectorAll('t-dropdown-button');
    const speedDropdown = dropdownButtons![0] as HTMLElement & { mobilePosition?: string };

    expect(speedDropdown).toBeTruthy();
    expect(speedDropdown.mobilePosition).toBe('auto');
  });

  it('time dropdown does NOT have mobilePosition="top" (uses default "auto")', async () => {
    await element.updateComplete;

    const dropdownButtons = element.shadowRoot?.querySelectorAll('t-dropdown-button');
    const timeDropdown = dropdownButtons![2] as HTMLElement & { mobilePosition?: string };

    expect(timeDropdown).toBeTruthy();
    expect(timeDropdown.mobilePosition).toBe('auto');
  });

  it('marker dropdown has position="up" and align="right"', async () => {
    await element.updateComplete;

    const dropdownButtons = element.shadowRoot?.querySelectorAll('t-dropdown-button');
    const markerDropdown = dropdownButtons![1] as HTMLElement & {
      position?: string;
      align?: string;
    };

    expect(markerDropdown.position).toBe('up');
    expect(markerDropdown.align).toBe('right');
  });

  it('speed dropdown has position="up" and align="left"', async () => {
    await element.updateComplete;

    const dropdownButtons = element.shadowRoot?.querySelectorAll('t-dropdown-button');
    const speedDropdown = dropdownButtons![0] as HTMLElement & {
      position?: string;
      align?: string;
    };

    expect(speedDropdown.position).toBe('up');
    expect(speedDropdown.align).toBe('left');
  });

  it('time dropdown has position="up" and align="right"', async () => {
    await element.updateComplete;

    const dropdownButtons = element.shadowRoot?.querySelectorAll('t-dropdown-button');
    const timeDropdown = dropdownButtons![2] as HTMLElement & {
      position?: string;
      align?: string;
    };

    expect(timeDropdown.position).toBe('up');
    expect(timeDropdown.align).toBe('right');
  });
});