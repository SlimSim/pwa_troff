import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GroupList } from './t-group-list.js';

describe('t-group-list detail search input', () => {
  let element: GroupList;

  beforeEach(() => {
    element = new GroupList();
    document.body.appendChild(element);

    // Minimal state so the group detail view renders with its search input:
    // a single group whose key (String(id) = '1') matches _selectedGroupKey.
    (element as any).groups = [
      {
        id: 1,
        name: 'Test Group',
        songs: [],
        tracks: [{ title: 'Tango', songKey: 'a' }],
      },
    ];
    (element as any).tracks = [];
    (element as any)._selectedGroupKey = '1';
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  // ---- helpers ----

  function getDetailSearchInput(): HTMLElement & { focus: () => void; blur: () => void } {
    const tInputEl = element.shadowRoot?.querySelector('t-input.search-input-compact') as
      | (HTMLElement & { focus: () => void; blur: () => void })
      | null;
    if (!tInputEl) {
      throw new Error('Expected t-input.search-input-compact to be in the shadow root');
    }
    return tInputEl;
  }

  // ---- tests ----

  it('blur keeps the group track search (query is no longer cleared)', async () => {
    await element.updateComplete;

    (element as any)._groupTrackSearch = 'foo';
    await element.updateComplete;

    const tInput = getDetailSearchInput();
    tInput.focus();
    tInput.blur();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    // New behavior: blurring must NOT clear the query inside the group
    // detail view — it stays exactly as it was on every screen size.
    expect((element as any)._groupTrackSearch).toBe('foo');
  });

  it('entering a group detail clears the group track search', async () => {
    await element.updateComplete;

    (element as any)._groupTrackSearch = 'foo';
    await element.updateComplete;

    // openGroup is the single chokepoint used by both the item click
    // handler and the parent (t-media-parent). Asserting on the public
    // method covers both entry paths.
    element.openGroup('1');
    await element.updateComplete;

    // Entering a group detail clears the detail track search so it
    // doesn't leak between group entries.
    expect((element as any)._groupTrackSearch).toBe('');
  });

  it('detail view shows no-results block with clear button when the track search matches nothing', async () => {
    await element.updateComplete;

    (element as any)._groupTrackSearch = 'zzz';
    await element.updateComplete;

    const noResults = element.shadowRoot?.querySelector('.no-results') as HTMLElement | null;
    expect(noResults).toBeTruthy();
    expect(noResults?.querySelector('.no-results-text')?.textContent).toContain(
      'No songs match "zzz"'
    );
    expect(noResults?.querySelector('.no-results-clear')).toBeTruthy();
  });

  it('clicking the clear button clears the group track search', async () => {
    await element.updateComplete;

    (element as any)._groupTrackSearch = 'zzz';
    await element.updateComplete;

    (element.shadowRoot?.querySelector('.no-results-clear') as HTMLElement | null)?.click();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect((element as any)._groupTrackSearch).toBe('');
    expect(element.shadowRoot?.querySelector('.no-results')).toBeNull();
  });

  it('t-media elements receive hideEditButton=true when song management mode is open', async () => {
    await element.updateComplete;

    // Open song management mode
    (element as any)._songManagementOpen = true;
    await element.updateComplete;

    const mediaEls = element.shadowRoot?.querySelectorAll('t-media') as NodeListOf<HTMLElement> | undefined;
    expect(mediaEls).toBeTruthy();
    expect(mediaEls!.length).toBeGreaterThan(0);

    mediaEls!.forEach((media) => {
      expect((media as any).hideEditButton).toBe(true);
    });
  });

  it('t-media elements receive hideEditButton=false when song management mode is closed', async () => {
    await element.updateComplete;

    // Ensure song management mode is closed (default)
    (element as any)._songManagementOpen = false;
    await element.updateComplete;

    const mediaEls = element.shadowRoot?.querySelectorAll('t-media') as NodeListOf<HTMLElement> | undefined;
    expect(mediaEls).toBeTruthy();
    expect(mediaEls!.length).toBeGreaterThan(0);

    mediaEls!.forEach((media) => {
      expect((media as any).hideEditButton).toBe(false);
    });
  });

  it('closeDetail closes an open group detail', async () => {
    await element.updateComplete;

    // The beforeEach left the component inside the detail view
    // (_selectedGroupKey = '1'); closeDetail() must reset it. The method
    // doesn't exist today, so this throws a TypeError (intended RED). Cast
    // via `any` so the test still typechecks against the current class.
    (element as any).closeDetail();
    await element.updateComplete;

    expect((element as any)._selectedGroupKey).toBe('');
  });
});