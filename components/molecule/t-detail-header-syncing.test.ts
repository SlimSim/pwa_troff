import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DetailHeader } from './t-detail-header.js';

/**
 * Type-safe view of the (not yet added) `syncing` property on t-detail-header:
 * `@property({ type: Boolean }) syncing = false`. The intersection cast keeps
 * this test file valid both before (RED) and after the feature lands — no `any`,
 * same pattern as t-settings-panel-auth-busy.test.ts.
 */
type DetailHeaderSyncing = DetailHeader & { syncing: boolean };

/**
 * Syncing badge contract for t-detail-header:
 *  - syncing === true  → <t-loading> + the literal text "syncing" render next
 *    to the title (inside a row wrapper, so they sit side by side),
 *  - syncing === false (default) → neither the spinner nor the text is present,
 *  - the title (entityName) renders in both states.
 */
describe('t-detail-header syncing badge', () => {
  let header: DetailHeader;

  beforeEach(async () => {
    header = new DetailHeader();
    header.entityName = 'My Band';
    document.body.appendChild(header);
    await header.updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(header)) {
      document.body.removeChild(header);
    }
  });

  /** Badge state as observed in the header's shadow root. */
  function getBadgeState() {
    const shadow = header.shadowRoot;
    return {
      loading: shadow?.querySelector('t-loading') ?? null,
      hasSyncingText: /\bsyncing\b/i.test(shadow?.textContent ?? ''),
      title: shadow?.querySelector('.detail-title')?.textContent ?? '',
    };
  }

  it('defaults syncing to false and renders neither t-loading nor the "syncing" text', async () => {
    expect((header as DetailHeaderSyncing).syncing).toBe(false);

    const { loading, hasSyncingText, title } = getBadgeState();
    expect(loading).toBeNull();
    expect(hasSyncingText).toBe(false);
    expect(title).toBe('My Band');
  });

  it('syncing=true renders t-loading plus the literal "syncing" text next to the intact title', async () => {
    (header as DetailHeaderSyncing).syncing = true;
    await header.updateComplete;

    const { loading, hasSyncingText, title } = getBadgeState();
    expect(loading).toBeTruthy();
    expect(hasSyncingText).toBe(true);
    expect(title).toBe('My Band');

    // Spinner and text live together inside a row wrapper (side by side).
    const wrapper = loading?.parentElement ?? null;
    expect(wrapper, 'expected the badge inside a row wrapper').toBeTruthy();
    expect(wrapper?.textContent ?? '').toMatch(/\bsyncing\b/i);
  });

  it('syncing=false again removes the badge but keeps the title', async () => {
    (header as DetailHeaderSyncing).syncing = true;
    await header.updateComplete;
    // RED guard: the badge must actually appear before we take it away.
    expect(getBadgeState().loading).toBeTruthy();

    (header as DetailHeaderSyncing).syncing = false;
    await header.updateComplete;

    const { loading, hasSyncingText, title } = getBadgeState();
    expect(loading).toBeNull();
    expect(hasSyncingText).toBe(false);
    expect(title).toBe('My Band');
  });
});
