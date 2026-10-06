import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Contract tests for wiring the existing `maybeShowMessengerBrowserNotice()`
 * (from `utils/messengerBrowser.js`, copy-only toast, already GREEN) into app boot.
 *
 * Reads the actual `v2Script.ts` source (no re-implementation, no import/execution —
 * v2Script.ts is 3965 lines with Firebase/audio side effects) and pins:
 *  1. v2Script.ts imports `./utils/messengerBrowser.js` (or `../utils/messengerBrowser.js`
 *     — accept either, but code must use `.js` suffix per convention).
 *  2. v2Script.ts calls `maybeShowMessengerBrowserNotice()` at least once
 *     (top-level, after the initPwa block).
 */

function loadV2Script(): string {
  const v2ScriptPath = resolve(process.cwd(), 'v2Script.ts');
  return readFileSync(v2ScriptPath, 'utf-8');
}

describe('messenger browser notice wiring (v2 boot)', () => {
  it('imports maybeShowMessengerBrowserNotice from utils/messengerBrowser.js with .js suffix', () => {
    const src = loadV2Script();
    const hasMessengerImport =
      /from\s+['"]\.\.?\/utils\/messengerBrowser\.js['"]/.test(src) &&
      src.includes('maybeShowMessengerBrowserNotice');
    expect(hasMessengerImport).toBe(true);
  });

  it('calls maybeShowMessengerBrowserNotice() at top level after the initPwa block', () => {
    const src = loadV2Script();
    expect(src.includes('maybeShowMessengerBrowserNotice()')).toBe(true);
    expect(src.indexOf('initPwa(') !== -1).toBe(true);
    expect(src.indexOf('maybeShowMessengerBrowserNotice()') > src.indexOf('initPwa(')).toBe(true);
  });
});
