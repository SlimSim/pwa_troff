/**
 * Lightweight notification system for Troff PWA.
 * Uses DOM overlays — no jQuery dependency.
 *
 * Provides:
 *  - `showDownloadProgress(fileName)` → controller with `update(percent)` / `done()`
 *  - `showToast(message, type?, duration?)` → auto-dismissing toast
 *  - `hideDownloadProgress()` → hide immediately
 */

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

// Inject keyframe animation once
if (!document.getElementById('troff-notification-style')) {
  const style = document.createElement('style');
  style.id = 'troff-notification-style';
  style.textContent = `
    @keyframes troff-toast-in {
      from { opacity: 0; transform: translateX(100%); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes troff-toast-out {
      from { opacity: 1; transform: translateX(0); }
      to   { opacity: 0; transform: translateX(100%); }
    }
  `;
  document.head.append(style);
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
  const toast = document.createElement('div');
  const bgColor =
    type === 'success' ? '#2e7d32' : type === 'error' ? '#c62828' : '#1565c0';
  toast.style.cssText =
    `padding:12px 18px;border-radius:6px;font-size:0.95em;` +
    `box-shadow:0 2px 12px rgba(0,0,0,0.2);background:${bgColor};` +
    `color:#fff;line-height:1.4;animation:troff-toast-in 0.2s ease-out;` +
    `word-break:break-word;`;
  toast.textContent = message;
  container.append(toast);

  const autoDismissTimer = setTimeout(() => {
    toast.style.animation = 'troff-toast-out 0.3s ease-out forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);

  if (action) {
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '8px';
    toast.style.justifyContent = 'space-between';

    const actionButton = document.createElement('button');
    actionButton.textContent = action.label;
    actionButton.style.cssText =
      'background:rgba(255,255,255,0.25);color:#fff;' +
      'border:1px solid rgba(255,255,255,0.6);border-radius:4px;' +
      'padding:2px 10px;cursor:pointer;font-size:0.9em;flex-shrink:0;';
    actionButton.addEventListener('click', () => {
      clearTimeout(autoDismissTimer);
      toast.remove();
      action.onClick();
    });
    toast.append(actionButton);
  }
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
