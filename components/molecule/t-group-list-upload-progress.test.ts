import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GroupList } from './t-group-list.js';

/** The (not yet added) upload progress map property on the list components. */
type GroupListWithUpload = { uploadProgressMap: Record<string, number> };
/** The (not yet added) upload progress property on t-media rows. */
type MediaItemWithUpload = { uploadProgress: number };

describe('t-group-list uploadProgressMap forwarding', () => {
  let element: GroupList;

  beforeEach(() => {
    element = new GroupList();
    document.body.appendChild(element);

    // Minimal state so the group detail view renders its t-media rows
    // (same setup as t-group-list.test.ts).
    (element as unknown as { groups: unknown[] }).groups = [
      {
        id: 1,
        name: 'Test Group',
        songs: [],
        tracks: [{ title: 'Tango', songKey: 'a', downloaded: true }],
      },
    ];
    (element as unknown as { tracks: unknown[] }).tracks = [];
    (element as unknown as { _selectedGroupKey: string })._selectedGroupKey = '1';
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  it('forwards the uploadProgressMap entry to the group detail t-media row', async () => {
    await element.updateComplete;

    const mediaBefore = element.shadowRoot?.querySelector('t-media');
    expect(mediaBefore).toBeTruthy();

    // Set AFTER the initial render so the test also requires the map to be a
    // reactive @property (a plain field would never re-run the bindings).
    (element as unknown as GroupListWithUpload).uploadProgressMap = { a: 42 };
    await element.updateComplete;

    const media = element.shadowRoot?.querySelector('t-media');
    expect(media).toBeTruthy();
    expect((media as unknown as MediaItemWithUpload).uploadProgress).toBe(42);
  });
});
