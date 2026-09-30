import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GroupList } from './t-group-list.js';
import type { DetailHeader } from './t-detail-header.js';

/** Minimal group fixture so the group detail view (and its t-detail-header) renders. */
const detailViewGroups = [
  {
    id: 1,
    name: 'Test Group',
    songs: [],
    tracks: [{ title: 'Tango', songKey: 'a' }],
  },
];

/**
 * Wiring contract: t-group-list listens on `document` for the custom event
 * `group-sync-status` (detail: { syncing: boolean }) and forwards the flag to
 * the t-detail-header rendered in the group detail view, so the header's
 * syncing badge (t-loading + "syncing" text) toggles with the event.
 */
describe('t-group-list group-sync-status → detail header badge', () => {
  let element: GroupList;

  beforeEach(async () => {
    element = new GroupList();
    document.body.appendChild(element);

    // Same detail-view setup as t-group-list.test.ts: one group whose key
    // (String(id) = '1') matches _selectedGroupKey, so the detail view with
    // its t-detail-header renders.
    (element as unknown as { groups: typeof detailViewGroups }).groups = detailViewGroups;
    (element as unknown as { tracks: unknown[] }).tracks = [];
    (element as unknown as { _selectedGroupKey: string })._selectedGroupKey = '1';

    await element.updateComplete;
    await getHeader().updateComplete;
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  function getHeader(): DetailHeader {
    const header = element.shadowRoot?.querySelector('t-detail-header') as DetailHeader | null;
    if (!header) {
      throw new Error('Expected t-detail-header in the group detail view');
    }
    return header;
  }

  /** Badge state as observed in the header's shadow root. */
  function getBadgeState() {
    const shadow = getHeader().shadowRoot;
    return {
      loading: shadow?.querySelector('t-loading') ?? null,
      hasSyncingText: /\bsyncing\b/i.test(shadow?.textContent ?? ''),
      title: shadow?.querySelector('.detail-title')?.textContent ?? '',
    };
  }

  function dispatchSyncStatus(syncing: boolean) {
    document.dispatchEvent(
      new CustomEvent('group-sync-status', {
        detail: { syncing },
        bubbles: true,
        composed: true,
      })
    );
  }

  /** Flush group-list update → header property binding → header re-render. */
  async function flushBadge() {
    await element.updateComplete;
    await getHeader().updateComplete;
  }

  it('detail header shows no syncing badge by default (before any event)', async () => {
    const { loading, hasSyncingText, title } = getBadgeState();
    expect(loading).toBeNull();
    expect(hasSyncingText).toBe(false);
    expect(title).toBe('Test Group');
  });

  it('group-sync-status {syncing:true} on document shows t-loading + "syncing" in the header', async () => {
    dispatchSyncStatus(true);
    await flushBadge();

    const { loading, hasSyncingText, title } = getBadgeState();
    expect(loading).toBeTruthy();
    expect(hasSyncingText).toBe(true);
    expect(title).toBe('Test Group');
  });

  it('group-sync-status {syncing:false} on document hides the badge again', async () => {
    dispatchSyncStatus(true);
    await flushBadge();
    // RED guard: the badge must actually appear before we take it away.
    expect(getBadgeState().loading).toBeTruthy();

    dispatchSyncStatus(false);
    await flushBadge();

    const { loading, hasSyncingText, title } = getBadgeState();
    expect(loading).toBeNull();
    expect(hasSyncingText).toBe(false);
    expect(title).toBe('Test Group');
  });
});
