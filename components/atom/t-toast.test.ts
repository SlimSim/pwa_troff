import { describe, it, expect, afterEach, vi } from 'vitest';
import { Toast } from './t-toast.js';

/**
 * Tests for the (planned) `loading` property on t-toast.
 *
 * Spec (Option A, Part 1):
 *   - `loading = false` by default → no <t-loading> in the shadow root
 *   - `loading = true` → <t-loading> rendered next to the message, message still shown
 *   - `duration = 0` stays sticky (no auto-dismiss)
 */

/** Local view of the not-yet-implemented `loading` prop (keeps tests typed). */
interface ToastWithLoading {
  loading: boolean;
}

async function createToast(): Promise<Toast> {
  const toast = new Toast();
  document.body.appendChild(toast);
  await toast.updateComplete;
  return toast;
}

describe('t-toast loading state', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('defaults loading to false and does not render t-loading', async () => {
    const toast = await createToast();

    // RED today: the `loading` property does not exist yet (undefined).
    expect((toast as unknown as ToastWithLoading).loading).toBe(false);
    expect(toast.shadowRoot?.querySelector('t-loading')).toBeNull();
  });

  it('renders t-loading in the shadow root when loading=true, and still shows the message', async () => {
    const toast = new Toast();
    toast.message = 'Saving group online…';
    (toast as unknown as ToastWithLoading).loading = true;
    document.body.appendChild(toast);
    await toast.updateComplete;

    // RED today: `loading` is not a reactive property, so nothing renders t-loading.
    const loadingEl = toast.shadowRoot?.querySelector('t-loading');
    expect(
      loadingEl,
      'expected <t-loading> in the t-toast shadow root when loading=true'
    ).toBeTruthy();

    // The message must still be visible while loading.
    expect(toast.shadowRoot?.textContent).toContain('Saving group online…');
  });

  it('does not render a progress/percent bar when loading=true', async () => {
    const toast = new Toast();
    toast.message = 'Saving group online…';
    (toast as unknown as ToastWithLoading).loading = true;
    document.body.appendChild(toast);
    await toast.updateComplete;

    expect(toast.shadowRoot?.querySelector('[class*="progress"]')).toBeNull();
    expect(toast.shadowRoot?.querySelector('[class*="percent"]')).toBeNull();
  });

  it('keeps duration=0 sticky (no auto-dismiss)', async () => {
    vi.useFakeTimers();

    const toast = new Toast();
    toast.duration = 0;
    document.body.appendChild(toast);
    await toast.updateComplete;

    vi.advanceTimersByTime(10000);

    expect(document.body.contains(toast)).toBe(true);
    expect(toast.isConnected).toBe(true);
  });
});
