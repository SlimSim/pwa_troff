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
