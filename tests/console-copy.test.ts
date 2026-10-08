import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Feature contract under test (NOT yet implemented → these tests are RED):
//
// Copy-console button in Advanced settings ("Copy logs").
//
// Answer to the user's v1 question, encoded as the first test below: YES —
// JavaScript cannot read the native console buffer retroactively, so v2 needs
// an in-memory ring buffer that wraps console.* (debug/log/info/warn/error/
// trace) from app boot, stores timestamped entries (capped to avoid memory
// bloat), and the Copy button serializes it to the clipboard via
// navigator.clipboard.writeText with a textarea-select fallback (button click
// is a user gesture, so async clipboard works on iOS Safari).
//
// Expected v2 API (new file utils/console-buffer.ts):
//   installConsoleBuffer(), uninstallConsoleBuffer(), clearConsoleBuffer(),
//   getConsoleEntries(): ConsoleEntry[] ({ level, time, message }),
//   serializeConsoleBuffer(): string,
//   copyConsoleBuffer(): Promise<boolean> (clipboard + fallback, showToast
//   success/failure via utils/notification.ts, never alert()).
import { showToast } from '../utils/notification.js';
import {
  installConsoleBuffer,
  uninstallConsoleBuffer,
  clearConsoleBuffer,
  getConsoleEntries,
  serializeConsoleBuffer,
  copyConsoleBuffer,
} from '../utils/console-buffer.js';
import type { ConsoleEntry } from '../utils/console-buffer.js';

vi.mock('../utils/notification.js', () => ({
  showToast: vi.fn(),
}));

type ClipboardLike = { writeText: (text: string) => Promise<void> };

function setClipboard(value: unknown): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value,
  });
}

describe('console ring buffer (utils/console-buffer.js)', () => {
  const hadClipboard = 'clipboard' in navigator;
  const originalClipboard = (navigator as unknown as { clipboard?: unknown }).clipboard;
  const originalExecCommand = (document as unknown as { execCommand?: unknown }).execCommand;

  beforeEach(() => {
    vi.clearAllMocks();
    installConsoleBuffer();
    clearConsoleBuffer();
  });

  afterEach(() => {
    uninstallConsoleBuffer();
    if (hadClipboard) {
      setClipboard(originalClipboard);
    } else {
      delete (navigator as unknown as { clipboard?: unknown }).clipboard;
    }
    if (originalExecCommand === undefined) {
      delete (document as unknown as { execCommand?: unknown }).execCommand;
    } else {
      Object.defineProperty(document, 'execCommand', {
        configurable: true,
        writable: true,
        value: originalExecCommand,
      });
    }
    vi.restoreAllMocks();
  });

  it('YES, a wrapper is required: entries logged before install are NOT captured (native buffer is unreadable)', () => {
    uninstallConsoleBuffer();
    clearConsoleBuffer();
    console.log('before-install-log-marker');
    installConsoleBuffer();

    const entries = getConsoleEntries();
    expect(entries.some((e: ConsoleEntry) => e.message.includes('before-install-log-marker'))).toBe(
      false
    );
  });

  it('captures log, warn and error levels after install', () => {
    console.log('ring-log-marker');
    console.warn('ring-warn-marker');
    console.error('ring-error-marker');

    const entries = getConsoleEntries();
    const levels = entries.map((e: ConsoleEntry) => e.level);
    expect(levels).toContain('log');
    expect(levels).toContain('warn');
    expect(levels).toContain('error');

    const text = serializeConsoleBuffer();
    expect(text).toContain('ring-log-marker');
    expect(text).toContain('ring-warn-marker');
    expect(text).toContain('ring-error-marker');
  });

  it('each entry carries level + timestamp', () => {
    console.log('timestamp-marker');
    const entry = getConsoleEntries().find((e: ConsoleEntry) =>
      e.message.includes('timestamp-marker')
    );
    expect(entry).toBeTruthy();
    expect(entry?.level).toBe('log');
    expect(typeof entry?.time).toBe('string');
    expect((entry?.time ?? '').length).toBeGreaterThan(0);
  });

  it('caps the buffer to at most 1000 entries (no memory bloat)', () => {
    for (let i = 0; i < 1200; i++) {
      console.log('fill-marker-' + i);
    }
    const entries = getConsoleEntries();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.length).toBeLessThanOrEqual(1000);
  });

  it('serializes entries to text including level + message', () => {
    console.warn('serialize-marker');
    const text = serializeConsoleBuffer();
    expect(typeof text).toBe('string');
    expect(text).toContain('warn');
    expect(text).toContain('serialize-marker');
  });

  it('stringifies args safely: circular objects do not throw', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => console.log('circular-marker', circular)).not.toThrow();
    expect(serializeConsoleBuffer()).toContain('circular-marker');
  });

  it('truncates very long entries', () => {
    console.log('x'.repeat(20000));
    const text = serializeConsoleBuffer();
    expect(text.length).toBeLessThan(20000);
  });
});

describe('copyConsoleBuffer() (clipboard + fallback + toast)', () => {
  const hadClipboard = 'clipboard' in navigator;
  const originalClipboard = (navigator as unknown as { clipboard?: unknown }).clipboard;
  const originalExecCommand = (document as unknown as { execCommand?: unknown }).execCommand;

  beforeEach(() => {
    vi.clearAllMocks();
    installConsoleBuffer();
    clearConsoleBuffer();
  });

  afterEach(() => {
    uninstallConsoleBuffer();
    if (hadClipboard) {
      setClipboard(originalClipboard);
    } else {
      delete (navigator as unknown as { clipboard?: unknown }).clipboard;
    }
    if (originalExecCommand === undefined) {
      delete (document as unknown as { execCommand?: unknown }).execCommand;
    } else {
      Object.defineProperty(document, 'execCommand', {
        configurable: true,
        writable: true,
        value: originalExecCommand,
      });
    }
    vi.restoreAllMocks();
  });

  it('writes serialized logs via navigator.clipboard.writeText and toasts success', async () => {
    console.error('copy-clipboard-marker');
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText } as ClipboardLike);

    const ok = await copyConsoleBuffer();

    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledTimes(1);
    const payload = String(writeText.mock.calls[0]?.[0] ?? '');
    expect(payload).toContain('copy-clipboard-marker');
    expect(vi.mocked(showToast)).toHaveBeenCalledWith(expect.anything(), 'success');
  });

  it('falls back to textarea-select + execCommand("copy") when clipboard API is unavailable (iOS Safari) and still toasts success', async () => {
    console.log('copy-fallback-marker');
    setClipboard(undefined);
    const execMock = vi.fn((): boolean => true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: execMock,
    });

    const ok = await copyConsoleBuffer();

    expect(execMock).toHaveBeenCalledWith('copy');
    expect(ok).toBe(true);
    expect(vi.mocked(showToast)).toHaveBeenCalledWith(expect.anything(), 'success');
  });

  it('toasts an error (never alert()) when copy fails everywhere', async () => {
    console.log('copy-failure-marker');
    setClipboard({
      writeText: (): Promise<void> => Promise.reject(new Error('denied')),
    } as ClipboardLike);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: vi.fn((): boolean => false),
    });

    const ok = await copyConsoleBuffer();

    expect(ok).toBe(false);
    expect(vi.mocked(showToast)).toHaveBeenCalledWith(expect.anything(), 'error');
  });
});
