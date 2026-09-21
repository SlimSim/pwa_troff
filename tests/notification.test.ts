import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Tests for the `action` support in showToast().
 *
 * showToast(message, type?, duration?, action?) renders an optional action
 * button next to the message; clicking it calls `action.onClick` and removes
 * the toast immediately.
 */

import { showToast } from '../utils/notification.js';

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
