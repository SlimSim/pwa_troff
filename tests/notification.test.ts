import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Tests for the `action` support in showToast().
 *
 * showToast(message, type?, duration?, action?) renders an optional action
 * button next to the message; clicking it calls `action.onClick` and removes
 * the toast immediately.
 */

type ShowToast = (
  message: string,
  type?: 'success' | 'error' | 'info',
  duration?: number,
  action?: { label: string; onClick: () => void }
) => void;

describe('showToast action support', () => {
  let showToast: ShowToast;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const mod = await import('../utils/notification.js');
    showToast = mod.showToast as ShowToast;
  });

  afterEach(() => {
    document.getElementById('troff-toast-container')?.remove();
    document.getElementById('troff-notification-style')?.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function findActionButton(label: string): HTMLButtonElement | null {
    const container = document.getElementById('troff-toast-container');
    if (!container) return null;
    const buttons = Array.from(container.querySelectorAll('button'));
    return buttons.find((b) => (b.textContent || '').trim() === label) || null;
  }

  it('renders the toast message and an action button with the given label', () => {
    showToast('msg', 'info', 1000, { label: 'Reload', onClick: vi.fn() });

    const container = document.getElementById('troff-toast-container');
    expect(container).toBeTruthy();
    expect(container?.textContent).toContain('msg');
    expect(findActionButton('Reload')).toBeTruthy();
  });

  it('calls onClick when the action button is clicked', () => {
    const onClick = vi.fn();
    showToast('msg', 'info', 1000, { label: 'Reload', onClick });

    const actionButton = findActionButton('Reload');
    expect(actionButton).toBeTruthy();

    actionButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('removes the toast when the action button is clicked', () => {
    showToast('msg', 'info', 1000, { label: 'Reload', onClick: vi.fn() });

    const container = document.getElementById('troff-toast-container');
    expect(container?.children.length).toBe(1);

    const actionButton = findActionButton('Reload');
    actionButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(container?.children.length).toBe(0);
  });
});
