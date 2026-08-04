import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArtistList } from './t-artist-list.js';

describe('t-artist-list detail search input', () => {
  let element: ArtistList;

  beforeEach(() => {
    element = new ArtistList();
    document.body.appendChild(element);

    // Minimal state so the artist detail view renders with its search input:
    // _getArtistGroups() maps the `artists` prop, and selectedArtist must
    // match one of the group names.
    (element as any).artists = [
      { name: 'Alpha', tracks: [{ title: 'Tango', songKey: 'a' }] },
    ];
    (element as any).tracks = [];
    (element as any).selectedArtist = 'Alpha';
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  // ---- helpers ----

  function getDetailSearchInput(): HTMLElement & { focus: () => void; blur: () => void } {
    const tInputEl = element.shadowRoot?.querySelector(
      '.search-compact-wrap t-input'
    ) as (HTMLElement & { focus: () => void; blur: () => void }) | null;
    if (!tInputEl) {
      throw new Error('Expected detail search t-input to be in the shadow root');
    }
    return tInputEl;
  }

  // ---- tests ----

  it('blur keeps the artist track search (query is no longer cleared)', async () => {
    await element.updateComplete;

    (element as any)._artistTrackSearch = 'foo';
    await element.updateComplete;

    const tInput = getDetailSearchInput();
    tInput.focus();
    tInput.blur();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    // New behavior: blurring must NOT clear the query inside the artist
    // detail view — it stays exactly as it was on every screen size.
    expect((element as any)._artistTrackSearch).toBe('foo');
  });

  it('entering an artist via openArtist clears the artist track search', async () => {
    await element.updateComplete;

    (element as any)._artistTrackSearch = 'foo';
    await element.updateComplete;

    // openArtist has an early-return guard when the artist is already
    // selected, so use a DIFFERENT artist than the beforeEach 'Alpha'.
    element.openArtist('Beta');
    await element.updateComplete;

    // Entering an artist detail clears the detail track search so it
    // doesn't leak between artist entries.
    expect((element as any)._artistTrackSearch).toBe('');
  });

  it('entering an artist via click clears the artist track search', async () => {
    await element.updateComplete;

    (element as any)._artistTrackSearch = 'foo';
    await element.updateComplete;

    (element as any)._handleArtistClick('Alpha');
    await element.updateComplete;

    // Clicking an artist clears the detail track search so it doesn't
    // leak between artist entries.
    expect((element as any)._artistTrackSearch).toBe('');
  });

  it('an empty filtered artists list renders no artist items (no fallback to all tracks)', async () => {
    await element.updateComplete;

    // The parent (t-media-parent) always passes its ALREADY-FILTERED list,
    // which is empty when the search matches nothing. The list view must
    // render nothing instead of rebuilding groups from all `tracks` — that
    // fallback is the bug this test pins down (the fallback renders 2 items).
    (element as any).artists = [];
    (element as any).tracks = [
      { title: 'Tango', artist: 'Alpha' },
      { title: 'Waltz', artist: 'Beta' },
    ];
    (element as any).selectedArtist = '';
    await element.updateComplete;

    const artistItems = element.shadowRoot?.querySelectorAll('.artist-item');
    expect(artistItems?.length).toBe(0);
  });

  it('detail view shows no-results block with clear button when the track search matches nothing', async () => {
    await element.updateComplete;

    (element as any)._artistTrackSearch = 'zzz';
    await element.updateComplete;

    const noResults = element.shadowRoot?.querySelector('.no-results') as HTMLElement | null;
    expect(noResults).toBeTruthy();
    expect(noResults?.querySelector('.no-results-text')?.textContent).toContain(
      'No tracks match "zzz"'
    );
    expect(noResults?.querySelector('.no-results-clear')).toBeTruthy();
  });

  it('clicking the clear button in the detail view clears the artist track search', async () => {
    await element.updateComplete;

    (element as any)._artistTrackSearch = 'zzz';
    await element.updateComplete;

    (element.shadowRoot?.querySelector('.no-results-clear') as HTMLElement | null)?.click();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect((element as any)._artistTrackSearch).toBe('');
    expect(element.shadowRoot?.querySelector('.no-results')).toBeNull();
  });

  it('closeDetail closes an open artist detail', async () => {
    await element.updateComplete;

    // The beforeEach left the component inside the detail view
    // (selectedArtist = 'Alpha'); closeDetail() must reset it. The method
    // doesn't exist today, so this throws a TypeError (intended RED). Cast
    // via `any` so the test still typechecks against the current class.
    (element as any).closeDetail();
    await element.updateComplete;

    expect((element as any).selectedArtist).toBe('');
  });
});