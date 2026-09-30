/**
 * Lightweight notification system for Troff PWA.
 * Uses the <t-toast> web component for toast notifications.
 *
 * Provides:
 *  - `showDownloadProgress(fileName)` → controller with `update(percent)` / `done()`
 *  - `showToast(message, type?, duration?)` → auto-dismissing toast
 *  - `showLoading(message)` → sticky loading toast with `update()` / `done()` / `fail()`
 *  - `hideDownloadProgress()` → hide immediately
 */

import '../components/atom/t-toast.js';

// ---------------------------------------------------------------------------
// Toast notifications (top-right, auto-dismiss)
// ---------------------------------------------------------------------------

let toastContainer: HTMLDivElement | null = null;

function getToastContainer(): HTMLDivElement {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'troff-toast-container';
    toastContainer.style.cssText =
      'position:fixed;top:16px;right:16px;z-index:20000;' +
      'display:flex;flex-direction:column;gap:8px;max-width:360px;';
    document.body.append(toastContainer);
  }
  return toastContainer;
}

/**
 * Show a brief toast notification that auto-dismisses.
 *
 * @param message  Text to display.
 * @param type     'success' (green), 'error' (red), or 'info' (blue). Default 'info'.
 * @param duration Time in ms before auto-dismiss. Default 3000.
 * @param action   Optional action button rendered next to the message. Clicking
 *                 it calls `onClick` and removes the toast immediately.
 */
export function showToast(
  message: string,
  type: 'success' | 'error' | 'info' = 'info',
  duration = 3000,
  action?: { label: string; onClick: () => void }
): void {
  const container = getToastContainer();

  const toast = document.createElement('t-toast');
  toast.message = message;
  toast.type = type;
  toast.duration = duration;
  if (action) {
    toast.actionLabel = action.label;
  }

  container.append(toast);

  const handleDismiss = () => {
    toast.removeEventListener('toast-dismissed', handleDismiss);
    toast.removeEventListener('toast-action-clicked', handleActionClick);
    toast.remove();
  };

  const handleActionClick = () => {
    action?.onClick();
  };

  toast.addEventListener('toast-dismissed', handleDismiss);
  if (action) {
    toast.addEventListener('toast-action-clicked', handleActionClick);
  }
}

/**
 * Show a sticky loading toast (info, no auto-dismiss) and return a
 * controller to finish it later.
 *
 * Returns a controller object:
 *  - `update(message)`      — replace the message (still loading/sticky)
 *  - `done(successMessage?)`— success toast, auto-dismiss after 4 s
 *  - `fail(errorMessage?)`  — error toast, auto-dismiss after 5 s
 *
 * Calling `done()`/`fail()` multiple times is safe.
 */
export function showLoading(message: string): {
  update(message: string): void;
  done(successMessage?: string): void;
  fail(errorMessage?: string): void;
} {
  const container = getToastContainer();

  const toast = document.createElement('t-toast');
  toast.message = message;
  toast.type = 'info';
  toast.duration = 0;
  toast.loading = true;

  container.append(toast);

  const handleDismiss = () => {
    toast.removeEventListener('toast-dismissed', handleDismiss);
    toast.remove();
  };
  toast.addEventListener('toast-dismissed', handleDismiss);

  const finish = (
    type: 'success' | 'error',
    finishedMessage: string,
    duration: number
  ) => {
    toast.loading = false;
    toast.type = type;
    toast.message = finishedMessage;
    toast.duration = duration;
  };

  return {
    update(newMessage: string) {
      toast.message = newMessage;
    },
    done(successMessage?: string) {
      finish('success', successMessage ?? 'Done', 4000);
    },
    fail(errorMessage?: string) {
      finish('error', errorMessage ?? 'Something went wrong', 5000);
    },
  };
}

// ---------------------------------------------------------------------------
// Download progress notification (centered overlay with bar)
// ---------------------------------------------------------------------------

let progressBox: HTMLDivElement | null = null;

/**
 * Show a persistent download-progress overlay.
 *
 * Returns a controller object:
 *  - `update(percent)` — update the bar (0‑100)
 *  - `done()`           — fill to 100 %, then fade out after 400 ms
 */
export function showDownloadProgress(
  fileName: string
): { update: (percent: number) => void; done: () => void } {
  // Remove any existing progress notification
  if (progressBox) {
    progressBox.remove();
    progressBox = null;
  }

  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;top:16px;left:50%;transform:translateX(-50%);' +
    'z-index:20000;background:var(--on-theme-color,#fff);' +
    'color:var(--theme-color,#000);padding:20px 24px;' +
    'border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);' +
    'max-width:420px;width:90%;display:flex;flex-direction:column;gap:12px;' +
    'font-size:0.95em;';
  progressBox = box;

  const label = document.createElement('div');
  label.textContent = `Downloading "${fileName}"...`;

  const barOuter = document.createElement('div');
  barOuter.style.cssText =
    'width:100%;height:8px;background:#e0e0e0;' +
    'border-radius:4px;overflow:hidden;';

  const barInner = document.createElement('div');
  barInner.style.cssText =
    'width:0%;height:100%;background:var(--accent-color,#1976d2);' +
    'border-radius:4px;transition:width 0.3s ease;';

  const pct = document.createElement('div');
  pct.style.cssText = 'text-align:right;font-size:0.85em;color:#666;';
  pct.textContent = '0%';

  barOuter.append(barInner);
  box.append(label, barOuter, pct);
  document.body.append(box);

  return {
    update(percent: number) {
      const p = Math.min(100, Math.max(0, Math.round(percent)));
      if (barInner) barInner.style.width = p + '%';
      if (pct) pct.textContent = p + '%';
    },
    done() {
      if (barInner) barInner.style.width = '100%';
      if (pct) pct.textContent = '100%';
      setTimeout(() => {
        if (box) {
          box.style.transition = 'opacity 0.3s';
          box.style.opacity = '0';
          setTimeout(() => {
            box.remove();
            if (progressBox === box) {
              progressBox = null;
            }
          }, 300);
        }
      }, 400);
    },
  };
}

/**
 * Immediately hide the download progress notification (if visible).
 */
export function hideDownloadProgress(): void {
  if (progressBox) {
    progressBox.remove();
    progressBox = null;
  }
}
