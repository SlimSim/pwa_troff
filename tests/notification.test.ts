import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Tests for the `action` support in showToast() and for showLoading().
 *
 * showToast(message, type?, duration?, action?) renders an optional action
 * button next to the message; clicking it calls `action.onClick` and removes
 * the toast immediately.
 *
 * showLoading(message) creates a sticky loading toast and returns a
 * controller with update()/done()/fail() (Option A, Part 2).
 */

import { showToast, showLoading } from '../utils/notification.js';

describe('showToast action support', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Ensure the container exists (reuse the module-level singleton)
    const container = document.getElementById('troff-toast-container');
    if (container) container.innerHTML = '';
  });

  afterEach(() => {
    // Clear toasts but keep the container so the module-level reference stays valid
    const container = document.getElementById('troff-toast-container');
    if (container) container.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function findActionButton(label: string): Promise<HTMLElement | null> {
    const container = document.getElementById('troff-toast-container');
    if (!container) return null;
    const toastEl = container.querySelector('t-toast') as HTMLElement | null;
    if (!toastEl?.shadowRoot) return null;
    await (toastEl as any).updateComplete;
    const buttons = Array.from(toastEl.shadowRoot.querySelectorAll('t-butt')) as HTMLElement[];
    return buttons.find((b) => (b.textContent || '').trim() === label) || null;
  }

  it('renders the toast message and an action button with the given label', async () => {
    showToast('msg', 'info', 5000, { label: 'Reload', onClick: vi.fn() });

    const container = document.getElementById('troff-toast-container');
    expect(container).toBeTruthy();
    const toastEl = container?.querySelector('t-toast') as any;
    expect(toastEl).toBeTruthy();
    expect(toastEl?.message).toBe('msg');
    const btn = await findActionButton('Reload');
    expect(btn).toBeTruthy();
  });

  it('calls onClick when the action button is clicked', async () => {
    const onClick = vi.fn();
    showToast('msg', 'info', 5000, { label: 'Reload', onClick });

    const actionButton = await findActionButton('Reload');
    expect(actionButton).toBeTruthy();

    actionButton?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('removes the toast when the action button is clicked', async () => {
    showToast('msg', 'info', 5000, { label: 'Reload', onClick: vi.fn() });

    const container = document.getElementById('troff-toast-container');
    expect(container?.children.length).toBe(1);

    const actionButton = await findActionButton('Reload');
    actionButton?.click();

    // t-toast dispatches toast-dismissed, then removes after 300ms animation
    vi.advanceTimersByTime(400);
    expect(container?.children.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// showLoading() (Option A, Part 2)
// ---------------------------------------------------------------------------

/** Typed view of the toast element created by showLoading(). */
interface LoadingToastElement extends HTMLElement {
  message: string;
  type: 'success' | 'error' | 'info';
  duration: number;
  loading: boolean;
  updateComplete: Promise<unknown>;
}

describe('showLoading()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Ensure the container exists (reuse the module-level singleton)
    const container = document.getElementById('troff-toast-container');
    if (container) container.innerHTML = '';
  });

  afterEach(() => {
    // Clear toasts but keep the container so the module-level reference stays valid
    const container = document.getElementById('troff-toast-container');
    if (container) container.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function getToast(): LoadingToastElement | null {
    const container = document.getElementById('troff-toast-container');
    return container?.querySelector('t-toast') as LoadingToastElement | null;
  }

  it('creates a sticky info toast with loading=true and no percent property', async () => {
    // RED today: showLoading is not exported from utils/notification.ts yet.
    showLoading('Saving group online…');

    const toast = getToast();
    expect(toast).toBeTruthy();
    expect(toast!.message).toBe('Saving group online…');
    expect(toast!.type).toBe('info');
    expect(toast!.duration).toBe(0);
    expect(toast!.loading).toBe(true);

    // No progress/percent bar — explicitly out of scope.
    expect('percent' in toast!).toBe(false);

    // t-loading must be registered/visible inside the toast shadow when loading.
    await toast!.updateComplete;
    expect(toast!.shadowRoot?.querySelector('t-loading')).toBeTruthy();
  });

  it('update() replaces the message while the toast stays loading and sticky', () => {
    const ctl = showLoading('Step 1');
    ctl.update('Step 2');

    const toast = getToast();
    expect(toast).toBeTruthy();
    expect(toast!.message).toBe('Step 2');
    expect(toast!.loading).toBe(true);
    expect(toast!.duration).toBe(0);
  });

  it("done('Saved') switches to a success toast and auto-dismisses after ~4s", async () => {
    const ctl = showLoading('Working…');
    ctl.done('Saved');

    const toast = getToast();
    expect(toast).toBeTruthy();
    expect(toast!.type).toBe('success');
    expect(toast!.loading).toBe(false);
    expect(toast!.message).toBe('Saved');
    expect(toast!.duration).toBe(4000);

    // duration change must (re)start the dismiss timer: 4000ms + 300ms
    // exit animation → the toast is removed from the container.
    await toast!.updateComplete;
    vi.advanceTimersByTime(4000 + 300 + 100);

    const container = document.getElementById('troff-toast-container');
    expect(container?.children.length).toBe(0);
  });

  it("done() without a message defaults to 'Done'", () => {
    const ctl = showLoading('Working…');
    ctl.done();

    const toast = getToast();
    expect(toast).toBeTruthy();
    expect(toast!.message).toBe('Done');
    expect(toast!.type).toBe('success');
    expect(toast!.loading).toBe(false);
  });

  it("fail('Nope') switches to an error toast", () => {
    const ctl = showLoading('Working…');
    ctl.fail('Nope');

    const toast = getToast();
    expect(toast).toBeTruthy();
    expect(toast!.type).toBe('error');
    expect(toast!.loading).toBe(false);
    expect(toast!.message).toBe('Nope');
    expect(toast!.duration).toBe(5000);
  });

  it("fail() without a message defaults to 'Something went wrong'", () => {
    const ctl = showLoading('Working…');
    ctl.fail();

    const toast = getToast();
    expect(toast).toBeTruthy();
    expect(toast!.message).toBe('Something went wrong');
    expect(toast!.type).toBe('error');
    expect(toast!.loading).toBe(false);
  });

  it('calling done()/fail() twice is safe (no throw)', () => {
    const ctl = showLoading('Working…');
    expect(() => {
      ctl.done('Saved');
      ctl.done('Saved again');
      ctl.fail('Nope');
      ctl.fail('Nope again');
    }).not.toThrow();

    const toast = getToast();
    expect(toast).toBeTruthy();
    expect(toast!.message).toBe('Nope again');
  });
});
