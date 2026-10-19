import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Feature spec — v2.html becomes a minimal redirect shim.
 *
 * index.html IS the v2 app now, so v2.html (currently still a full copy of
 * index.html) must be replaced with a tiny page that:
 *   1. Sets preferred version to v2: localStorage key
 *      'TROFF_SETTING_PREFER_VERSION' with value 2 in a format compatible
 *      with existing readers (index.html does JSON.parse(raw), nDB.get does
 *      JSON.parse — so JSON.stringify(2), i.e. the string "2"), wrapped in
 *      try/catch so the redirect still happens if storage fails.
 *   2. Redirects to "/" preserving the hash fragment via
 *      window.location.replace('/' + window.location.hash) — replace (not
 *      href assignment) to avoid a history entry, running immediately in
 *      <head> with no app bootstrapping and no imports.
 *   3. Contains NO full app shell: no <t-main-layout>, no v2Script.js, no
 *      t-v2-welcome-dialog, no pref==1 -> /v1.html logic (that belongs only
 *      in index.html now).
 *   4. Is minimal valid HTML: doctype, html lang, head with charset + title,
 *      redirect script, body with a no-JS/manual fallback link to "/".
 *   5. index.html stays the full v2 app (asserted here only as a guard: it
 *      keeps the pref==1 -> /v1.html redirect).
 *
 * Tests written RED-first per guidelines:
 * - static HTML assertions by reading raw files with readFileSync, exactly
 *   like tests/v2-rollout.test.ts / tests/v2-load-screen.test.ts
 * - no function re-implementation (the shim is inline HTML, nothing to import)
 * - always .js extensions in project imports (no project imports needed here)
 * - never touch legacy files; only this new test file is created
 *
 * Every v2.html assertion below FAILS against the current v2.html (full app
 * copy) — i.e. RED. The index.html guard is expected to stay GREEN.
 */

const ROOT = join(__dirname, '..');

/** Raw contents of v2.html (redirect shim under test). */
function readV2HtmlRaw(): string {
  return readFileSync(join(ROOT, 'v2.html'), 'utf-8');
}

/** Raw contents of index.html (must remain the full v2 app). */
function readIndexHtmlRaw(): string {
  return readFileSync(join(ROOT, 'index.html'), 'utf-8');
}

describe('v2.html redirect shim (pref=2 + replace to /)', () => {
  // -------------------------------------------------------------------------
  // 1. Sets preferred version to v2 (JSON-compatible, inside try/catch)
  // -------------------------------------------------------------------------
  describe('sets preferred version to v2', () => {
    it('writes TROFF_SETTING_PREFER_VERSION as JSON.stringify(2) inside try/catch', () => {
      const html = readV2HtmlRaw();
      // Must write value 2 in a JSON.parse-compatible format: JSON.stringify(2)
      // (i.e. the string "2"), exactly like nDB.set would persist it.
      expect(
        html,
        'v2.html must call localStorage.setItem(\'TROFF_SETTING_PREFER_VERSION\', JSON.stringify(2)) (or the equivalent literal "2")'
      ).toMatch(
        /localStorage\.setItem\(\s*['"]TROFF_SETTING_PREFER_VERSION['"]\s*,\s*(JSON\.stringify\(2\)|['"]2['"])\s*\)/
      );
      // Storage write must be guarded so the redirect still happens on failure.
      expect(
        html,
        'v2.html storage write must be wrapped in try/catch so redirect still happens if storage fails'
      ).toMatch(/try\s*\{[\s\S]*?setItem[\s\S]*?\}\s*catch/);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Redirects to "/" preserving hash via replace in <head>, no bootstrap
  // -------------------------------------------------------------------------
  describe('redirects to / preserving the hash', () => {
    it("calls window.location.replace('/' + window.location.hash) in <head> via replace (not href)", () => {
      const html = readV2HtmlRaw();
      const headCloseIdx = html.indexOf('</head>');
      expect(headCloseIdx, 'v2.html must have </head>').toBeGreaterThan(-1);

      // Exact root redirect preserving the hash fragment.
      // (The old '/v1.html' + hash variant must NOT satisfy this.)
      const redirectMatch = html.match(
        /window\.location\.replace\(\s*['"]\/['"]\s*\+\s*window\.location\.hash\s*\)/
      );
      expect(
        redirectMatch,
        "v2.html must redirect with window.location.replace('/' + window.location.hash) to preserve the hash without a history entry"
      ).not.toBeNull();
      expect(
        redirectMatch!.index!,
        'redirect script must run immediately in <head> (before </head>)'
      ).toBeLessThan(headCloseIdx);

      // Must use replace, not an href assignment (which would add history).
      expect(
        html,
        'v2.html shim must use location.replace, not a location.href assignment for the redirect'
      ).not.toMatch(/location\.href\s*=\s*['"]\//);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Must NOT contain the full app shell
  // -------------------------------------------------------------------------
  describe('contains no full app shell', () => {
    it('has no <t-main-layout> app shell', () => {
      const html = readV2HtmlRaw();
      expect(
        html,
        'v2.html shim must NOT contain the full app shell (<t-main-layout>)'
      ).not.toContain('<t-main-layout');
    });

    it('loads no v2Script.js, no module bootstrapping, no welcome dialog', () => {
      const html = readV2HtmlRaw();
      expect(
        html,
        'v2.html shim must NOT load v2Script.js'
      ).not.toContain('v2Script.js');
      expect(
        html,
        'v2.html shim must NOT contain the welcome dialog tag'
      ).not.toContain('t-v2-welcome-dialog');
      expect(
        html,
        'v2.html shim must have no app bootstrapping (no importmap / module scripts)'
      ).not.toMatch(/importmap|type="module"/);
    });

    it('has no pref==1 -> /v1.html redirect logic (belongs only in index.html now)', () => {
      const html = readV2HtmlRaw();
      expect(
        html,
        'v2.html shim must NOT contain the pref==1 early-redirect logic'
      ).not.toMatch(/pref == 1/);
      expect(
        html,
        'v2.html shim must NOT reference /v1.html at all'
      ).not.toMatch(/\/v1\.html/);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Minimal valid HTML with manual fallback link
  // -------------------------------------------------------------------------
  describe('is minimal valid HTML', () => {
    it('has doctype/lang/charset/title, head redirect script, body fallback link to /, and stays tiny', () => {
      const html = readV2HtmlRaw();
      // Valid skeleton (these already hold for the full copy — the RED part
      // of this test is the fallback link + tiny size below).
      expect(html, 'v2.html must start with a doctype').toMatch(/<!doctype html>/i);
      expect(html, 'v2.html must declare <html lang>').toMatch(/<html[^>]*lang=/i);
      expect(html, 'v2.html head must have a charset meta').toMatch(/<meta[^>]*charset/i);
      expect(html, 'v2.html head must have a <title>').toMatch(/<title>[\s\S]*?<\/title>/i);

      // No-JS / manual fallback link to root.
      expect(
        html,
        'v2.html body must contain a manual fallback link to / (e.g. <a href="/">)'
      ).toMatch(/<a[^>]*href="\/"[^>]*>/);

      // A shim is a few lines, not a full app copy (~10KB+ with inline CSS).
      expect(
        html.length,
        `v2.html shim must be minimal (a few hundred bytes, not a full app copy of ${html.length} chars)`
      ).toBeLessThan(3000);
    });
  });

  // -------------------------------------------------------------------------
  // 5. index.html guard — remains the full v2 app (expected GREEN)
  // -------------------------------------------------------------------------
  describe('index.html remains the full v2 app', () => {
    it('still has the pref==1 -> /v1.html redirect and the full app shell', () => {
      const html = readIndexHtmlRaw();
      expect(html).toMatch(/localStorage\.getItem\('TROFF_SETTING_PREFER_VERSION'\)/);
      expect(html).toMatch(/if \(pref == 1\) \{/);
      expect(html).toMatch(/window\.location\.replace\('\/v1\.html' \+ window\.location\.hash\);/);
      expect(html).toContain('<t-main-layout');
      expect(html).toContain('v2Script.js');
    });
  });
});
