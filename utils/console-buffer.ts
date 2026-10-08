/**
 * In-memory console ring buffer.
 *
 * The native console buffer is not readable from JavaScript, so this module
 * wraps console.* (debug/log/info/warn/error/trace) from app boot, stores
 * timestamped entries (capped to avoid memory bloat), and lets the
 * Advanced-settings "Copy logs" button serialize them to the clipboard.
 * No PII is added — only what was already logged.
 */

import { showToast } from './notification.js';

export interface ConsoleEntry {
  level: string;
  time: string;
  message: string;
}

type ConsoleLevel = 'debug' | 'log' | 'info' | 'warn' | 'error' | 'trace';
type ConsoleFn = (...args: unknown[]) => void;

const LEVELS: ConsoleLevel[] = ['debug', 'log', 'info', 'warn', 'error', 'trace'];
const MAX_ENTRIES = 1000;
const MAX_ENTRY_CHARS = 2000;
const MAX_SERIALIZED_CHARS = 100000;

let installed = false;
let buffer: ConsoleEntry[] = [];
const originals = new Map<ConsoleLevel, ConsoleFn>();

function tryStringify(value: unknown): string {
  const seen = new Set<unknown>();
  try {
    const result = JSON.stringify(value, (_key, nested: unknown) => {
      if (typeof nested === 'object' && nested !== null) {
        if (seen.has(nested)) {
          return '[Circular]';
        }
        seen.add(nested);
      }
      return nested as unknown;
    });
    return typeof result === 'string' ? result : String(value);
  } catch {
    return String(value);
  }
}

function formatArg(arg: unknown): string {
  if (typeof arg === 'string') {
    return arg;
  }
  if (arg instanceof Error) {
    return arg.stack ?? arg.message;
  }
  return tryStringify(arg);
}

function pushEntry(level: ConsoleLevel, args: unknown[]): void {
  const message = args.map(formatArg).join(' ');
  buffer.push({
    level,
    time: new Date().toISOString(),
    message:
      message.length > MAX_ENTRY_CHARS
        ? message.slice(0, MAX_ENTRY_CHARS) + '…[truncated]'
        : message,
  });
  if (buffer.length > MAX_ENTRIES) {
    buffer.splice(0, buffer.length - MAX_ENTRIES);
  }
}

export function installConsoleBuffer(): void {
  if (installed) {
    return;
  }
  installed = true;
  for (const level of LEVELS) {
    const original = (console[level] as ConsoleFn).bind(console);
    originals.set(level, original);
    (console[level] as ConsoleFn) = (...args: unknown[]): void => {
      pushEntry(level, args);
      original(...args);
    };
  }
}

export function uninstallConsoleBuffer(): void {
  if (!installed) {
    return;
  }
  installed = false;
  for (const level of LEVELS) {
    const original = originals.get(level);
    if (original) {
      (console[level] as ConsoleFn) = original;
    }
  }
  originals.clear();
}

export function clearConsoleBuffer(): void {
  buffer = [];
}

export function getConsoleEntries(): ConsoleEntry[] {
  return [...buffer];
}

export function serializeConsoleBuffer(): string {
  const text = buffer.map((e) => `[${e.time}] [${e.level}] ${e.message}`).join('\n');
  return text.length > MAX_SERIALIZED_CHARS
    ? text.slice(0, MAX_SERIALIZED_CHARS) + '\n…[truncated]'
    : text;
}

function fallbackCopyText(text: string): boolean {
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, area.value.length);
    const doc = document as Document & { execCommand?: (command: string) => boolean };
    const ok = doc.execCommand ? doc.execCommand('copy') : false;
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export async function copyConsoleBuffer(): Promise<boolean> {
  const text = serializeConsoleBuffer();
  try {
    const nav = navigator as Navigator & { clipboard?: { writeText: (t: string) => Promise<void> } };
    if (!nav.clipboard?.writeText) {
      throw new Error('clipboard unavailable');
    }
    await nav.clipboard.writeText(text);
    showToast('Logs copied to clipboard', 'success');
    return true;
  } catch {
    if (fallbackCopyText(text)) {
      showToast('Logs copied to clipboard', 'success');
      return true;
    }
    showToast('Could not copy logs', 'error');
    return false;
  }
}
