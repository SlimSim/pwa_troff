import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Contract tests for PWA link-handling declarations in manifest.json.
 *
 * Reads the actual repo manifest.json (no re-implementation) and pins:
 *  1. handle_links === "preferred"
 *  2. launch_handler.client_mode === "navigate-existing"
 *  3. All pre-existing fields preserved + valid JSON.
 */

function loadManifestRaw(): string {
  const manifestPath = resolve(process.cwd(), 'manifest.json');
  return readFileSync(manifestPath, 'utf-8');
}

function loadManifest(): Record<string, unknown> {
  return JSON.parse(loadManifestRaw()) as Record<string, unknown>;
}

describe('manifest.json link handling', () => {
  it('remains valid JSON', () => {
    expect(() => loadManifest()).not.toThrow();
  });

  it('declares top-level handle_links "preferred"', () => {
    const manifest = loadManifest();
    expect(manifest['handle_links']).toBe('preferred');
  });

  it('declares launch_handler with client_mode "navigate-existing"', () => {
    const manifest = loadManifest();
    const launchHandler = manifest['launch_handler'] as Record<string, unknown> | undefined;
    expect(launchHandler).toBeDefined();
    expect(launchHandler?.['client_mode']).toBe('navigate-existing');
  });

  it('preserves all existing manifest fields', () => {
    const manifest = loadManifest();
    expect(manifest['name']).toBe('Troff - Training with music');
    expect(manifest['short_name']).toBe('Troff');
    expect(manifest['start_url']).toBe('/');
    expect(manifest['display']).toBe('standalone');
    expect(Array.isArray(manifest['icons'])).toBe(true);
    expect((manifest['icons'] as unknown[]).length).toBeGreaterThan(0);
  });
});
