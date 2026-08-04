import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GenreList } from './t-genre-list.js';

describe('t-genre-list detail search input', () => {
  let element: GenreList;

  beforeEach(() => {
    element = new GenreList();
    document.body.appendChild(element);

    // Minimal state so the genre detail view renders with its search input:
    // _getGenreGroups() maps the `genres` prop, and selectedGenre must
    // match one of the group names.
    (element as any).genres = [
      { name: 'Jazz', tracks: [{ title: 'Tango', songKey: 'a' }] },
    ];
    (element as any).tracks = [];
    (element as any).selectedGenre = 'Jazz';
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

  it('blur keeps the genre track search (query is no longer cleared)', async () => {
    await element.updateComplete;

    (element as any)._genreTrackSearch = 'foo';
    await element.updateComplete;

    const tInput = getDetailSearchInput();
    tInput.focus();
    tInput.blur();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    // New behavior: blurring must NOT clear the query inside the genre
    // detail view — it stays exactly as it was on every screen size.
    expect((element as any)._genreTrackSearch).toBe('foo');
  });

  it('entering a genre via openGenre clears the genre track search', async () => {
    await element.updateComplete;

    (element as any)._genreTrackSearch = 'foo';
    await element.updateComplete;

    // openGenre has an early-return guard when the genre is already
    // selected, so use a DIFFERENT genre than the beforeEach 'Jazz'.
    element.openGenre('Blues');
    await element.updateComplete;

    // Entering a genre detail clears the detail track search so it
    // doesn't leak between genre entries.
    expect((element as any)._genreTrackSearch).toBe('');
  });

  it('entering a genre via click clears the genre track search', async () => {
    await element.updateComplete;

    (element as any)._genreTrackSearch = 'foo';
    await element.updateComplete;

    (element as any)._handleGenreClick('Jazz');
    await element.updateComplete;

    // Clicking a genre clears the detail track search so it doesn't leak
    // between genre entries.
    expect((element as any)._genreTrackSearch).toBe('');
  });

  it('an empty filtered genres list renders no genre items', async () => {
    await element.updateComplete;

    // The parent (t-media-parent) always passes its ALREADY-FILTERED list,
    // which is empty when the search matches nothing. The list view must
    // render nothing instead of rebuilding groups from all `tracks` — that
    // fallback is the bug this test pins down (the fallback renders 2 items).
    (element as any).genres = [];
    (element as any).tracks = [
      { title: 'Tango', genre: 'Tango' },
      { title: 'Waltz', genre: 'Waltz' },
    ];
    (element as any).selectedGenre = '';
    await element.updateComplete;

    const genreItems = element.shadowRoot?.querySelectorAll('.genre-item');
    expect(genreItems?.length).toBe(0);
  });

  it('detail view shows no-results block with clear button when the track search matches nothing', async () => {
    await element.updateComplete;

    (element as any)._genreTrackSearch = 'zzz';
    await element.updateComplete;

    const noResults = element.shadowRoot?.querySelector('.no-results') as HTMLElement | null;
    expect(noResults).toBeTruthy();
    expect(noResults?.querySelector('.no-results-text')?.textContent).toContain(
      'No tracks match "zzz"'
    );
    expect(noResults?.querySelector('.no-results-clear')).toBeTruthy();
  });

  it('clicking the clear button in the detail view clears the genre track search', async () => {
    await element.updateComplete;

    (element as any)._genreTrackSearch = 'zzz';
    await element.updateComplete;

    (element.shadowRoot?.querySelector('.no-results-clear') as HTMLElement | null)?.click();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect((element as any)._genreTrackSearch).toBe('');
    expect(element.shadowRoot?.querySelector('.no-results')).toBeNull();
  });

  it('closeDetail closes an open genre detail', async () => {
    await element.updateComplete;

    // The beforeEach left the component inside the detail view
    // (selectedGenre = 'Jazz'); closeDetail() must reset it. The method
    // doesn't exist today, so this throws a TypeError (intended RED). Cast
    // via `any` so the test still typechecks against the current class.
    (element as any).closeDetail();
    await element.updateComplete;

    expect((element as any).selectedGenre).toBe('');
  });
});