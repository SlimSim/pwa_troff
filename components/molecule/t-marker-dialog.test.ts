import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MarkerDialog } from './t-marker-dialog.js';
import type { TInput } from '../atom/t-input.js';
import type { TTextarea } from '../atom/t-textarea.js';
import type { TroffMarker } from '../../types/troff.d.js';

describe('t-marker-dialog', () => {
  let element: MarkerDialog;

  beforeEach(() => {
    element = new MarkerDialog();
    element.mode = 'create';
    element.open = true;
    element.maxTime = 100;
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  it('renders in create mode', async () => {
    await element.updateComplete;
    const dialogTitle = element.shadowRoot?.querySelector('.marker-text') as HTMLElement;
    expect(dialogTitle?.textContent).toBe('Add a marker');
  });

  it('renders a single color picker', async () => {
    await element.updateComplete;

    const colorPickers = element.shadowRoot?.querySelectorAll('t-color-picker');
    expect(colorPickers?.length).toBe(1);
  });

  it('renders in edit mode', async () => {
    element.mode = 'edit';
    await element.updateComplete;

    const dialogTitle = element.shadowRoot?.querySelector('.marker-text') as HTMLElement;
    expect(dialogTitle?.textContent).toBe('Edit marker');
  });

  it('pre-fills data in edit mode', async () => {
    const markerData: Partial<TroffMarker> = {
      id: 'test-id',
      name: 'Test Marker',
      info: 'Test Info',
      time: 50,
      color: '#ff0000',
    };

    element.mode = 'edit';
    element.markerData = markerData;
    await element.updateComplete;

    expect(element.markerName).toBe('Test Marker');
    expect(element.markerInfo).toBe('Test Info');
    expect(element.markerTime).toBe(50);
    expect(element.markerColor).toBe('#ff0000');
  });

  it('resets create defaults from suggestedName and initialTime while open', async () => {
    element.mode = 'create';
    element.suggestedName = 'marker nr 4';
    element.initialTime = 42;
    await element.updateComplete;

    expect(element.markerName).toBe('marker nr 4');
    expect(element.markerInfo).toBe('');
    expect(element.markerColor).toBe('');
    expect(element.markerTime).toBe(42);
  });

  it('re-populates edit fields when reopening with same marker data', async () => {
    const markerData: Partial<TroffMarker> = {
      id: 'same-id',
      name: 'Marker Name',
      info: 'Marker Info',
      time: 12,
      color: '#123456',
    };

    element.mode = 'edit';
    element.markerData = markerData;
    element.open = true;
    await element.updateComplete;

    element.markerName = 'Changed Name';
    element.markerInfo = 'Changed Info';
    element.markerTime = 55;
    await element.updateComplete;

    element.open = false;
    await element.updateComplete;
    element.open = true;
    await element.updateComplete;

    expect(element.markerName).toBe('Marker Name');
    expect(element.markerInfo).toBe('Marker Info');
    expect(element.markerTime).toBe(12);
    expect(element.markerColor).toBe('#123456');
  });

  it('updates visible info field when switching edited markers', async () => {
    const markerOne: Partial<TroffMarker> = {
      id: 'marker-1',
      name: 'Marker One',
      info: 'Info One',
      time: 10,
      color: '',
    };

    const markerTwo: Partial<TroffMarker> = {
      id: 'marker-2',
      name: 'Marker Two',
      info: 'Info Two',
      time: 20,
      color: '',
    };

    element.mode = 'edit';
    element.markerData = markerOne;
    element.open = true;
    await element.updateComplete;

    const infoComponent = element.shadowRoot?.querySelector('t-textarea') as
      | (HTMLElement & { updateComplete: Promise<void> })
      | null;
    expect(infoComponent).toBeTruthy();
    if (!infoComponent) {
      throw new Error('Expected t-textarea to exist');
    }

    await infoComponent.updateComplete;
    const infoTextareaBefore = infoComponent.shadowRoot?.querySelector(
      'textarea'
    ) as HTMLTextAreaElement;
    expect(infoTextareaBefore.value).toBe('Info One');

    element.markerData = markerTwo;
    await element.updateComplete;
    await infoComponent.updateComplete;

    const infoTextareaAfter = infoComponent.shadowRoot?.querySelector(
      'textarea'
    ) as HTMLTextAreaElement;
    expect(infoTextareaAfter.value).toBe('Info Two');
  });

  it('emits marker-created event in create mode', async () => {
    const markerCreatedSpy = vi.fn();
    element.addEventListener('marker-created', markerCreatedSpy);

    element.markerName = 'New Marker';
    element.markerInfo = 'New Info';
    element.markerTime = 30;
    element.markerColor = '#00ff00';
    await element.updateComplete;

    element.handleOkClick();
    await element.updateComplete;

    expect(markerCreatedSpy).toHaveBeenCalled();
    const event = markerCreatedSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.marker.name).toBe('New Marker');
    expect(event.detail.marker.info).toBe('New Info');
    expect(event.detail.marker.time).toBe(30);
    expect(event.detail.marker.color).toBe('#00ff00');
    expect(event.detail.marker.id).toBeDefined();
  });

  it('emits marker-updated event in edit mode', async () => {
    const markerUpdatedSpy = vi.fn();
    element.addEventListener('marker-updated', markerUpdatedSpy);

    const markerData: Partial<TroffMarker> = {
      id: 'existing-id',
      name: 'Existing Marker',
      info: 'Existing Info',
      time: 50,
      color: '#ff0000',
    };

    element.mode = 'edit';
    element.markerData = markerData;
    await element.updateComplete;

    element.markerName = 'Updated Marker';
    element.markerInfo = 'Updated Info';
    element.markerTime = 60;
    element.markerColor = '#0000ff';
    await element.updateComplete;

    element.handleOkClick();
    await element.updateComplete;

    expect(markerUpdatedSpy).toHaveBeenCalled();
    const event = markerUpdatedSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.marker.name).toBe('Updated Marker');
    expect(event.detail.marker.info).toBe('Updated Info');
    expect(event.detail.marker.time).toBe(60);
    expect(event.detail.marker.color).toBe('#0000ff');
    expect(event.detail.marker.id).toBe('existing-id');
  });

  it('does not submit when name is empty', async () => {
    const markerCreatedSpy = vi.fn();
    element.addEventListener('marker-created', markerCreatedSpy);

    element.markerName = '';
    await element.updateComplete;

    element.handleOkClick();
    await element.updateComplete;

    expect(markerCreatedSpy).not.toHaveBeenCalled();
  });

  it('emits dialog-cancelled on Escape key', async () => {
    const dialogCancelledSpy = vi.fn();
    element.addEventListener('dialog-cancelled', dialogCancelledSpy);

    element.open = true;
    await element.updateComplete;

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(escapeEvent);
    await element.updateComplete;

    expect(dialogCancelledSpy).toHaveBeenCalled();
  });

  it('submits on Enter key', async () => {
    const markerCreatedSpy = vi.fn();
    element.addEventListener('marker-created', markerCreatedSpy);

    element.open = true;
    element.markerName = 'Test Marker';
    await element.updateComplete;

    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
    document.dispatchEvent(enterEvent);
    await element.updateComplete;

    expect(markerCreatedSpy).toHaveBeenCalled();
  });

  it('emits dialog-completed after successful submission', async () => {
    const dialogCompletedSpy = vi.fn();
    element.addEventListener('dialog-completed', dialogCompletedSpy);

    element.markerName = 'Test Marker';
    await element.updateComplete;

    element.handleOkClick();
    await element.updateComplete;

    expect(dialogCompletedSpy).toHaveBeenCalled();
  });

  it('time dial has step="0.1" for sub-second precision', async () => {
    await element.updateComplete;

    const timeDial = element.shadowRoot?.querySelector('t-dial[label="Time"]') as
      | (HTMLElement & { step: number })
      | null;
    expect(timeDial).toBeTruthy();
    expect(timeDial!.step).toBe(0.1);
  });

  it('time dial step is a number, not the string "0.1"', async () => {
    await element.updateComplete;

    const timeDial = element.shadowRoot?.querySelector('t-dial[label="Time"]') as
      | (HTMLElement & { step: number })
      | null;
    expect(timeDial).toBeTruthy();
    expect(typeof timeDial!.step).toBe('number');
  });

  it('time dial does NOT have the old default step of 1', async () => {
    await element.updateComplete;

    const timeDial = element.shadowRoot?.querySelector('t-dial[label="Time"]') as
      | (HTMLElement & { step: number })
      | null;
    expect(timeDial).toBeTruthy();
    expect(timeDial!.step).not.toBe(1);
  });

  it('time dial is present with correct attributes', async () => {
    element.mode = 'edit';
    element.markerData = {
      id: 'test-id',
      name: 'Test Marker',
      info: 'Test Info',
      time: 15.3,
      color: '#ff0000',
    };
    await element.updateComplete;

    const timeDial = element.shadowRoot?.querySelector('t-dial[label="Time"]') as
      | (HTMLElement & { step: number; min: number; unit: string })
      | null;
    expect(timeDial).toBeTruthy();
    expect(timeDial!.step).toBe(0.1);
    expect(timeDial!.min).toBe(0);
    expect(timeDial!.unit).toBe('s');
  });

  it('does not clamp markerTime to 0 when maxTime is 0 (unknown duration)', async () => {
    element.maxTime = 0; // unknown duration
    element.initialTime = 6;
    await element.updateComplete;

    expect(element.markerTime).toBe(6);
  });

  it('does not clamp markerTime to 0 in edit mode when maxTime is 0', async () => {
    const markerData: Partial<TroffMarker> = {
      id: 'test-id',
      name: 'Test Marker',
      info: '',
      time: 42,
      color: '',
    };

    element.maxTime = 0; // unknown duration
    element.mode = 'edit';
    element.markerData = markerData;
    await element.updateComplete;

    expect(element.markerTime).toBe(42);
  });

  // === Compact marker dialog tests ===

  describe('compact marker dialog layout', () => {
    it('renders all 4 fields: name input, info textarea, time dial, color picker', async () => {
      await element.updateComplete;

      const nameInput = element.shadowRoot?.querySelector('t-input');
      const infoTextarea = element.shadowRoot?.querySelector('t-textarea');
      const timeDial = element.shadowRoot?.querySelector('t-dial');
      const colorPicker = element.shadowRoot?.querySelector('t-color-picker');

      expect(nameInput).toBeTruthy();
      expect(infoTextarea).toBeTruthy();
      expect(timeDial).toBeTruthy();
      expect(colorPicker).toBeTruthy();
    });

    it('textarea has rows="2" (not the old rows="4")', async () => {
      await element.updateComplete;

      const textarea = element.shadowRoot?.querySelector('t-textarea') as TTextarea | null;
      expect(textarea).toBeTruthy();

      const rows = textarea!.getAttribute('rows');
      expect(rows).toBe('2');
    });

    it('textarea does NOT have rows="4"', async () => {
      await element.updateComplete;

      const textarea = element.shadowRoot?.querySelector('t-textarea') as TTextarea | null;
      expect(textarea).toBeTruthy();

      const rows = textarea!.getAttribute('rows');
      expect(rows).not.toBe('4');
    });

    it('textarea has the compact attribute set', async () => {
      await element.updateComplete;

      const textarea = element.shadowRoot?.querySelector('t-textarea') as TTextarea | null;
      expect(textarea).toBeTruthy();
      expect(textarea!.hasAttribute('compact')).toBe(true);
    });

    it('name input does NOT have a helper-text attribute', async () => {
      await element.updateComplete;

      const nameInput = element.shadowRoot?.querySelector('t-input') as TInput | null;
      expect(nameInput).toBeTruthy();
      expect(nameInput!.hasAttribute('helper-text')).toBe(false);
    });

    it('info textarea does NOT have a helper-text attribute', async () => {
      await element.updateComplete;

      const textarea = element.shadowRoot?.querySelector('t-textarea') as TTextarea | null;
      expect(textarea).toBeTruthy();
      expect(textarea!.hasAttribute('helper-text')).toBe(false);
    });

    it('title renders "Add a marker" in create mode', async () => {
      element.mode = 'create';
      await element.updateComplete;

      const dialogTitle = element.shadowRoot?.querySelector('.marker-text') as HTMLElement;
      expect(dialogTitle?.textContent).toBe('Add a marker');
    });

    it('title renders "Edit marker" in edit mode', async () => {
      element.mode = 'edit';
      element.markerData = { id: 'x', name: 'X', info: '', time: 0, color: '' };
      await element.updateComplete;

      const dialogTitle = element.shadowRoot?.querySelector('.marker-text') as HTMLElement;
      expect(dialogTitle?.textContent).toBe('Edit marker');
    });

    it('container has tighter gap (8px) instead of old 16px', async () => {
      await element.updateComplete;

      const container = element.shadowRoot?.querySelector('.marker-dropdown-content') as HTMLElement;
      expect(container).toBeTruthy();

      const computed = getComputedStyle(container!);
      expect(computed.gap).toBe('8px');
    });

    it('container has tighter padding (10px 8px) instead of old 16px 8px', async () => {
      await element.updateComplete;

      const container = element.shadowRoot?.querySelector('.marker-dropdown-content') as HTMLElement;
      expect(container).toBeTruthy();

      const computed = getComputedStyle(container!);
      expect(computed.paddingTop).toBe('10px');
      expect(computed.paddingBottom).toBe('10px');
      expect(computed.paddingLeft).toBe('8px');
      expect(computed.paddingRight).toBe('8px');
    });

    it('title has no bottom margin (margin-bottom: 0)', async () => {
      await element.updateComplete;

      const title = element.shadowRoot?.querySelector('.marker-text') as HTMLElement;
      expect(title).toBeTruthy();

      const computed = getComputedStyle(title!);
      // getComputedStyle returns '' when margin-bottom isn't set, or '0px' if explicitly set to 0
      expect(['', '0px']).toContain(computed.marginBottom);
    });
  });
});
