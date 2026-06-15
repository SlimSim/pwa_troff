import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MediaParent } from './t-media-parent.js';

describe('t-media-parent search input', () => {
  let element: MediaParent;

  beforeEach(() => {
    // Skip the async _loadSongs() that runs from connectedCallback; we
    // populate state directly so the component renders without touching
    // localStorage or the Cache API.
    vi.spyOn(MediaParent.prototype as any, '_loadSongs').mockResolvedValue(undefined);

    element = new MediaParent();
    document.body.appendChild(element);

    (element as any).songs = [
      { songKey: 'a', title: 'Tango' },
      { songKey: 'b', title: 'Waltz' },
    ];
    (element as any).groups = [];
    (element as any).currentFilter = 'tracks';
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  // ---- helpers ----

  async function getSearchInput(): Promise<HTMLElement & { updateComplete: Promise<void> }> {
    const tInputEl = element.shadowRoot?.querySelector(
      't-input.search-input'
    ) as (HTMLElement & { updateComplete: Promise<void> }) | null;
    if (!tInputEl) {
      throw new Error('Expected t-input.search-input to be in the shadow root');
    }
    await tInputEl.updateComplete;
    return tInputEl;
  }

  function getNativeInput(tInputEl: HTMLElement): HTMLInputElement {
    const nativeInput = tInputEl.shadowRoot?.querySelector('input') as HTMLInputElement | null;
    if (!nativeInput) {
      throw new Error('Expected inner native input element to be in t-input shadow root');
    }
    return nativeInput;
  }

  // ---- tests ----

  it('searchQuery reflects the latest typed value after the user types in the native input', async () => {
    await element.updateComplete;

    const tInputEl = await getSearchInput();
    const nativeInput = getNativeInput(tInputEl);

    // Simulate the user typing 'tan' into the native input.
    // `composed: true` matches real-browser behavior for native InputEvent
    // (all native events are composed). happy-dom defaults `composed` to
    // false on the Event constructor, which would prevent the event from
    // crossing t-input's shadow boundary and reaching the parent listener.
    nativeInput.value = 'tan';
    nativeInput.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));

    await element.updateComplete;
    await element.updateComplete;

    // The bug: t-input dispatches a custom 'input' event (which sets
    // searchQuery to 'tan'), but the original native 'input' event also
    // bubbles out of t-input's shadow DOM. The parent's handler treats
    // both events the same, so the native event (with `detail` = 0)
    // resets searchQuery to '' immediately after the custom event sets
    // it. End result: the model is empty even though the user typed.
    expect(element.searchQuery).toBe('tan');
  });

  it('clears searchQuery to empty string when the clear button is clicked', async () => {
    // Pre-populate the search query so the clear button is rendered.
    (element as any).searchQuery = 'hello';
    await element.updateComplete;

    const tInputEl = await getSearchInput();
    const clearBtn = tInputEl.shadowRoot?.querySelector('.clear-btn') as HTMLElement | null;
    if (!clearBtn) {
      throw new Error('Expected clear button to be present when value is non-empty');
    }
    clearBtn.click();
    await element.updateComplete;
    await element.updateComplete;

    expect(element.searchQuery).toBe('');
  });

  it('preserves raw user input (whitespace and case) in searchQuery — no trimming in the handler', async () => {
    await element.updateComplete;

    const tInputEl = await getSearchInput();
    const nativeInput = getNativeInput(tInputEl);

    nativeInput.value = '  TaNGo  ';
    nativeInput.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    await element.updateComplete;
    await element.updateComplete;

    // The handler must not trim/normalize the query — that's the filter
    // utility's job (see filterTracks / filterArtists / etc.).
    expect(element.searchQuery).toBe('  TaNGo  ');
  });
});

describe('Ctrl+F global keyboard shortcut', () => {
  let element: MediaParent;

  beforeEach(() => {
    // Mirror the sibling describe block's setup: stub _loadSongs so the
    // component's connectedCallback doesn't touch localStorage / the Cache
    // API. The new feature (a window keydown listener registered in
    // connectedCallback) also depends on this stub not throwing.
    vi.spyOn(MediaParent.prototype as any, '_loadSongs').mockResolvedValue(undefined);
    element = new MediaParent();
    document.body.appendChild(element);
    (element as any).songs = [{ songKey: 'a', title: 'Tango' }];
    (element as any).groups = [];
    (element as any).currentFilter = 'tracks';
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  it('opens the song view (sets visible = true) when Ctrl+F is pressed and the view is hidden', async () => {
    (element as any).visible = false;

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    await element.updateComplete;

    expect(element.visible).toBe(true);
  });

  it('does not change visible when the view is already visible', async () => {
    element.visible = true;
    await element.updateComplete;

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    await element.updateComplete;

    // Guard against the implementation toggling visible (instead of just
    // setting it to true): visible should still be true, not flipped to false.
    expect(element.visible).toBe(true);
  });

  it('focuses the search input on Ctrl+F', async () => {
    element.visible = true;
    (element as any).searchQuery = '';
    await element.updateComplete;

    const tInput = element.shadowRoot?.querySelector('t-input.search-input') as any;
    if (!tInput) {
      throw new Error('Expected t-input.search-input in shadow root');
    }
    const focusSpy = vi.spyOn(tInput, 'focus');
    const selectSpy = vi.spyOn(tInput, 'select');

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    await element.updateComplete;
    // The implementation will schedule focus/select in a microtask that runs
    // after updateComplete resolves; flush with a macrotask.
    await new Promise((r) => setTimeout(r, 0));

    expect(focusSpy).toHaveBeenCalled();
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it('selects all text when Ctrl+F is pressed and searchQuery is non-empty', async () => {
    element.visible = true;
    (element as any).searchQuery = 'existing';
    await element.updateComplete;

    const tInput = element.shadowRoot?.querySelector('t-input.search-input') as any;
    if (!tInput) {
      throw new Error('Expected t-input.search-input in shadow root');
    }
    const focusSpy = vi.spyOn(tInput, 'focus');
    const selectSpy = vi.spyOn(tInput, 'select');

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect(focusSpy).toHaveBeenCalled();
    expect(selectSpy).toHaveBeenCalled();
  });

  it('calls preventDefault on Ctrl+F to suppress browser Find', async () => {
    const event = new KeyboardEvent('keydown', {
      key: 'f',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('works with Cmd+F (Meta key) for Mac', async () => {
    (element as any).visible = false;

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'f',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    await element.updateComplete;

    expect(element.visible).toBe(true);
  });

  it('ignores key combinations that are not Ctrl/Cmd + F', async () => {
    (element as any).visible = false;

    // Ctrl+A — wrong key, must be ignored
    const ctrlA = new KeyboardEvent('keydown', {
      key: 'a',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(ctrlA);
    await element.updateComplete;
    expect(element.visible).toBe(false);
    expect(ctrlA.defaultPrevented).toBe(false);

    // plain 'f' without modifier — must be ignored
    const plainF = new KeyboardEvent('keydown', {
      key: 'f',
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(plainF);
    await element.updateComplete;
    expect(element.visible).toBe(false);
    expect(plainF.defaultPrevented).toBe(false);
  });

  it('removes the global keydown listener on disconnect (no leak)', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const newElement = new MediaParent();
    (newElement as any).songs = [{ songKey: 'a', title: 'Tango' }];
    (newElement as any).groups = [];
    (newElement as any).currentFilter = 'tracks';
    document.body.appendChild(newElement);
    await newElement.updateComplete;

    // connectedCallback should have registered a 'keydown' listener on window
    expect(addSpy).toHaveBeenCalledWith('keydown', expect.anything());

    newElement.remove();

    // disconnectedCallback should have removed that 'keydown' listener
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.anything());
  });
});

describe('Search-mode keyboard navigation', () => {
  let element: MediaParent;

  beforeEach(() => {
    // Same baseline as the other describe blocks: stub _loadSongs so
    // connectedCallback doesn't touch localStorage / the Cache API.
    vi.spyOn(MediaParent.prototype as any, '_loadSongs').mockResolvedValue(undefined);

    element = new MediaParent();
    document.body.appendChild(element);

    // Override songs to have 3+ tracks so Up/Down/Enter tests have
    // something to navigate.
    (element as any).songs = [
      { songKey: '1', title: 'Tango' },
      { songKey: '2', title: 'Waltz' },
      { songKey: '3', title: 'Foxtrot' },
    ];
    (element as any).groups = [];
    (element as any).currentFilter = 'tracks';

    // Enable the keyboard-nav branch.
    (element as any).isDesktop = true;
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  // ---- helpers ----

  function getSearchInput():
    | (HTMLElement & { focus: () => void; blur: () => void; select: () => void })
    | null {
    return element.shadowRoot?.querySelector('t-input.search-input') as
      | (HTMLElement & { focus: () => void; blur: () => void; select: () => void })
      | null;
  }

  function dispatchKeydownOnTInput(key: string): KeyboardEvent {
    const tInput = getSearchInput();
    if (!tInput) {
      throw new Error('Expected t-input.search-input in shadow root');
    }
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    tInput.dispatchEvent(event);
    return event;
  }

  // ---- tests ----

  it('Escape clears searchQuery and blurs the input', async () => {
    await element.updateComplete;
    (element as any).searchQuery = 'foo';
    await element.updateComplete;

    const tInput = getSearchInput();
    if (!tInput) throw new Error('Expected t-input.search-input in shadow root');
    const nativeInput = tInput.shadowRoot?.querySelector('input') as HTMLInputElement | null;
    if (!nativeInput) {
      throw new Error('Expected inner native input in t-input shadow root');
    }
    const blurSpy = vi.spyOn(nativeInput, 'blur');

    tInput.focus();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect((element as any).searchQuery).toBe('');
    expect(blurSpy).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('Escape with an empty query still blurs (and leaves query empty)', async () => {
    await element.updateComplete;
    (element as any).searchQuery = '';
    await element.updateComplete;

    const tInput = getSearchInput();
    if (!tInput) throw new Error('Expected t-input.search-input in shadow root');
    const nativeInput = tInput.shadowRoot?.querySelector('input') as HTMLInputElement | null;
    if (!nativeInput) {
      throw new Error('Expected inner native input in t-input shadow root');
    }
    const blurSpy = vi.spyOn(nativeInput, 'blur');

    tInput.focus();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect((element as any).searchQuery).toBe('');
    expect(blurSpy).toHaveBeenCalled();
  });

  it('ArrowDown increments highlightedIndex by 1', async () => {
    await element.updateComplete;
    (element as any).searchQuery = '';
    (element as any).highlightedIndex = 0;
    await element.updateComplete;

    dispatchKeydownOnTInput('ArrowDown');
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect((element as any).highlightedIndex).toBe(1);
  });

  it('ArrowUp decrements highlightedIndex by 1', async () => {
    await element.updateComplete;
    (element as any).searchQuery = '';
    (element as any).highlightedIndex = 2;
    await element.updateComplete;

    dispatchKeydownOnTInput('ArrowUp');
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect((element as any).highlightedIndex).toBe(1);
  });

  it('ArrowUp at index 0 stays at 0 (clamped)', async () => {
    await element.updateComplete;
    (element as any).searchQuery = '';
    (element as any).highlightedIndex = 0;
    await element.updateComplete;

    dispatchKeydownOnTInput('ArrowUp');
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect((element as any).highlightedIndex).toBe(0);
  });

  it('ArrowDown at the last index stays (clamped)', async () => {
    await element.updateComplete;
    (element as any).searchQuery = '';
    (element as any).highlightedIndex = 2;
    await element.updateComplete;

    dispatchKeydownOnTInput('ArrowDown');
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect((element as any).highlightedIndex).toBe(2);
  });

  it('Enter dispatches a media-selected event with the highlighted track songKey', async () => {
    await element.updateComplete;
    // Override the beforeEach fixture with titles already in alphabetical order
    // so the default title-ascending sort doesn't reorder them. With this
    // fixture, visibleTracks[1] === Bravo (songKey '2').
    (element as any).songs = [
      { title: 'Alpha', songKey: '1' },
      { title: 'Bravo', songKey: '2' },
      { title: 'Charlie', songKey: '3' },
    ];
    (element as any).searchQuery = '';
    (element as any).highlightedIndex = 1;
    await element.updateComplete;

    const spy = vi.fn();
    element.addEventListener('media-selected', spy);

    dispatchKeydownOnTInput('Enter');
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].detail.songKey).toBe('2');
  });

  it('Enter on an empty filtered list is a no-op', async () => {
    await element.updateComplete;
    (element as any).searchQuery = 'zzz';
    (element as any).highlightedIndex = -1;
    await element.updateComplete;

    const spy = vi.fn();
    element.addEventListener('media-selected', spy);

    dispatchKeydownOnTInput('Enter');
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect(spy).not.toHaveBeenCalled();
  });

  it('Enter with an active search filter dispatches the highlighted VISIBLE track (not the raw track at the same index)', async () => {
    await element.updateComplete;

    // Override songs: only 'Tango' matches the 'tan' query. With the
    // title-ascending default sort the visible list is [Tango] (songKey 'd'),
    // but the raw list still starts with Apple (songKey 'a').
    (element as any).songs = [
      { title: 'Apple', songKey: 'a' },
      { title: 'Banana', songKey: 'b' },
      { title: 'Cherry', songKey: 'c' },
      { title: 'Tango', songKey: 'd' },
    ];
    (element as any).searchQuery = 'tan';
    (element as any).highlightedIndex = 0;
    await element.updateComplete;

    const spy = vi.fn();
    element.addEventListener('media-selected', spy);

    dispatchKeydownOnTInput('Enter');
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    // The highlighted index points at the 1 visible track, 'Tango'.
    // Buggy code does `this.songs[this.highlightedIndex]` → Apple ('a').
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].detail.songKey).toBe('d');
  });

  it('ArrowDown with an active search filter does not exceed the visible list length', async () => {
    await element.updateComplete;

    // Same fixture: only 'Tango' matches 'tan' so visibleTracks.length === 1.
    (element as any).songs = [
      { title: 'Apple', songKey: 'a' },
      { title: 'Banana', songKey: 'b' },
      { title: 'Cherry', songKey: 'c' },
      { title: 'Tango', songKey: 'd' },
    ];
    (element as any).searchQuery = 'tan';
    (element as any).highlightedIndex = 0;
    await element.updateComplete;

    // Hammer ArrowDown past the visible list length. The index must stay
    // clamped at visibleTracks.length - 1 === 0. Buggy code clamps against
    // this.songs.length - 1 === 3.
    for (let i = 0; i < 5; i++) {
      dispatchKeydownOnTInput('ArrowDown');
      await element.updateComplete;
      await new Promise((r) => setTimeout(r, 0));
    }

    expect((element as any).highlightedIndex).toBe(0);
  });

  it('highlightedIndex is forwarded to <t-track-list>', async () => {
    // Focus the search input first so the focused-path is exercised; the
    // render method forwards -1 to <t-track-list> when the input is not
    // focused (see iteration-6 spec).
    const tInput = await getSearchInput();
    if (!tInput) throw new Error('Expected t-input.search-input in shadow root');
    tInput.focus();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    (element as any).highlightedIndex = 1;
    await element.updateComplete;

    const tTrackList = element.shadowRoot?.querySelector('t-track-list') as any;
    expect(tTrackList).toBeTruthy();
    expect(tTrackList.highlightedIndex).toBe(1);
  });

  it('highlightedIndex resets to 0 when searchQuery changes and there are matches', async () => {
    await element.updateComplete;
    (element as any).searchQuery = '';
    (element as any).highlightedIndex = 0;
    (element as any).highlightedIndex = 2;
    await element.updateComplete;

    (element as any).searchQuery = 't';
    await element.updateComplete;

    expect((element as any).highlightedIndex).toBe(0);
  });

  it('highlightedIndex resets to -1 when the new query yields zero matches', async () => {
    await element.updateComplete;
    (element as any).searchQuery = 'zzz';
    await element.updateComplete;

    expect((element as any).highlightedIndex).toBe(-1);
  });

  it('ArrowUp / ArrowDown are no-ops when isDesktop is false, but Enter still selects', async () => {
    (element as any).isDesktop = false;
    (element as any).searchQuery = '';
    (element as any).highlightedIndex = 0;
    await element.updateComplete;

    const spy = vi.fn();
    element.addEventListener('media-selected', spy);

    dispatchKeydownOnTInput('ArrowDown');
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    expect((element as any).highlightedIndex).toBe(0);

    dispatchKeydownOnTInput('ArrowUp');
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    expect((element as any).highlightedIndex).toBe(0);

    dispatchKeydownOnTInput('Enter');
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('Esc is also a no-op on mobile (gated on isDesktop)', async () => {
    (element as any).isDesktop = false;
    (element as any).searchQuery = 'foo';
    await element.updateComplete;

    const tInput = getSearchInput();
    if (!tInput) throw new Error('Expected t-input.search-input in shadow root');
    const blurSpy = vi.spyOn(tInput, 'blur');

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect((element as any).searchQuery).toBe('foo');
    expect(blurSpy).not.toHaveBeenCalled();
  });
});

describe('Search focus state and visual indication', () => {
  let element: MediaParent;

  beforeEach(() => {
    // Same baseline as the other describe blocks: stub _loadSongs so
    // connectedCallback doesn't touch localStorage / the Cache API.
    vi.spyOn(MediaParent.prototype as any, '_loadSongs').mockResolvedValue(undefined);

    element = new MediaParent();
    document.body.appendChild(element);

    // 3 tracks already in alphabetical order so the default title-ascending
    // sort doesn't reorder them.
    (element as any).songs = [
      { title: 'Alpha', songKey: '1' },
      { title: 'Bravo', songKey: '2' },
      { title: 'Charlie', songKey: '3' },
    ];
    (element as any).groups = [];
    (element as any).currentFilter = 'tracks';

    // Enable the keyboard-nav / focus-watching branch.
    (element as any).isDesktop = true;
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  // ---- helpers ----

  function getSearchInput():
    | (HTMLElement & { focus: () => void; blur: () => void })
    | null {
    return element.shadowRoot?.querySelector('t-input.search-input') as
      | (HTMLElement & { focus: () => void; blur: () => void })
      | null;
  }

  function getTrackList(): (HTMLElement & { highlightedIndex: number }) | null {
    return element.shadowRoot?.querySelector('t-track-list') as
      | (HTMLElement & { highlightedIndex: number })
      | null;
  }

  // ---- tests ----

  it('isSearchFocused starts as false', async () => {
    await element.updateComplete;

    // The new property must exist and default to false. In the current code
    // it doesn't exist at all, so this assertion fails (undefined !== false).
    expect((element as any).isSearchFocused).toBe(false);
  });

  it('focusing the search input sets isSearchFocused to true', async () => {
    await element.updateComplete;

    const tInput = getSearchInput();
    if (!tInput) {
      throw new Error('Expected t-input.search-input in shadow root');
    }

    tInput.focus();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    // After focus, the parent's @focus listener must set isSearchFocused = true.
    // In the current code there's no listener, so isSearchFocused is undefined
    // and this assertion fails.
    expect((element as any).isSearchFocused).toBe(true);
  });

  it('blurring the search input sets isSearchFocused to false', async () => {
    await element.updateComplete;

    const tInput = getSearchInput();
    if (!tInput) {
      throw new Error('Expected t-input.search-input in shadow root');
    }

    // Focus first, then blur.
    tInput.focus();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    tInput.blur();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    // The @blur handler must reset the focus state. In the current code
    // there's no listener, so isSearchFocused remains undefined.
    expect((element as any).isSearchFocused).toBe(false);
  });

  it('t-track-list receives highlightedIndex = -1 when the search input is not focused', async () => {
    (element as any).highlightedIndex = 1;
    await element.updateComplete;

    const tTrackList = getTrackList();
    expect(tTrackList).toBeTruthy();

    // When the search input is NOT focused, the parent must forward -1 to
    // <t-track-list> (so no item gets the .highlighted class). The current
    // code unconditionally forwards this.highlightedIndex, so this fails.
    expect(tTrackList?.highlightedIndex).toBe(-1);
  });

  it('t-track-list receives the real highlightedIndex when the search input is focused', async () => {
    const tInput = getSearchInput();
    if (!tInput) {
      throw new Error('Expected t-input.search-input in shadow root');
    }

    (element as any).highlightedIndex = 1;
    tInput.focus();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    const tTrackList = getTrackList();
    expect(tTrackList).toBeTruthy();

    // When focused, the real highlightedIndex (1) is forwarded. Also assert
    // the focus state itself was set — this is a strengthening: in the
    // current code there's no focus wiring, so isSearchFocused is undefined
    // and the first assertion below would fail.
    expect((element as any).isSearchFocused).toBe(true);
    expect(tTrackList?.highlightedIndex).toBe(1);
  });

  it('Esc blurs the input → indication disappears', async () => {
    (element as any).highlightedIndex = 1;

    const tInput = getSearchInput();
    if (!tInput) {
      throw new Error('Expected t-input.search-input in shadow root');
    }

    tInput.focus();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    const nativeInput = tInput.shadowRoot?.querySelector('input') as HTMLInputElement | null;
    if (!nativeInput) {
      throw new Error('Expected inner native input in t-input shadow root');
    }
    const blurSpy = vi.spyOn(nativeInput, 'blur');

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    const tTrackList = getTrackList();

    // Existing Esc behavior is preserved: it blurs the input AND clears
    // the search query.
    expect(blurSpy).toHaveBeenCalled();
    expect(element.searchQuery).toBe('');

    // New behavior: with the input now blurred, isSearchFocused must be
    // false AND t-track-list must receive -1 (the indication is gone). In
    // the current code, isSearchFocused is undefined, and the
    // updated() hook resets highlightedIndex to 0 (3 visible tracks with
    // an empty query) — so the t-track-list assertion would also fail.
    expect((element as any).isSearchFocused).toBe(false);
    expect(tTrackList?.highlightedIndex).toBe(-1);
  });

  // ---- regression: Esc MUST actually release DOM focus ----
  //
  // The test above only proves that `tInput.blur()` was *called* (via a spy
  // on the method itself). It does NOT prove that focus actually left the
  // input. In a real browser the bug manifests as: press Ctrl+F → focus
  // moves to the search input → type something → press Esc → the cursor
  // stays in the input. The spy is happy because blur() ran, but the
  // browser's activeElement never changed. This test pins down the
  // observable, user-visible behavior: document.activeElement must NOT
  // be the search input (and must NOT be the inner native <input> that
  // lives inside t-input's shadow root) after Esc is pressed.
  it('Esc actually releases DOM focus (document.activeElement is no longer the search input)', async () => {
    await element.updateComplete;

    const tInput = getSearchInput();
    if (!tInput) {
      throw new Error('Expected t-input.search-input in shadow root');
    }
    const nativeInput = tInput.shadowRoot?.querySelector('input') as
      | HTMLInputElement
      | null;
    if (!nativeInput) {
      throw new Error('Expected inner native input in t-input shadow root');
    }

    // Step 1 — reproduce the Ctrl+F flow: focus the search input.
    // (Ctrl+F → tInput.focus() is wired in the parent; we call it
    // directly to keep the test focused on the Esc regression.)
    tInput.focus();
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    // Sanity check — after focus, the native input MUST be the active
    // element *somewhere* in the focus tree. We check both the shadow
    // root (where happy-dom places the inner input as activeElement)
    // and the host level (where some DOMs place the shadow host).
    // If neither is true, the test setup is broken and the rest of
    // this test would be meaningless.
    const focusedBeforeEsc =
      tInput.shadowRoot?.activeElement === nativeInput ||
      document.activeElement === tInput ||
      document.activeElement === nativeInput;
    expect(focusedBeforeEsc).toBe(true);

    // Capture the pre-Esc focus state for the "it actually changed"
    // assertion below.
    const tInputShadowActiveBefore = tInput.shadowRoot?.activeElement;
    const docActiveBefore = document.activeElement;

    // Step 2 — press Esc on the search input.
    const escEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    window.dispatchEvent(escEvent);
    await element.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    // Step 3 — the actual regression assertions. We check THREE things,
    // any one of which would catch the real-browser bug where the
    // cursor stays in the input:
    //
    //   (a) The t-input host element must not be the document's
    //       active element.
    //   (b) The inner native <input> must not be active in the
    //       shadow root (it should be null/cleared).
    //   (c) document.activeElement must not be the inner native
    //       <input> (catches the case where the shadow host is
    //       skipped entirely and the inner input is exposed at
    //       document level — which some browser/shadow-DOM
    //       configurations do).
    expect(document.activeElement).not.toBe(tInput);
    expect(tInput.shadowRoot?.activeElement).not.toBe(nativeInput);
    expect(document.activeElement).not.toBe(nativeInput);

    // Step 4 — the strongest possible check: focus MUST have actually
    // CHANGED. If the implementation calls blur() but it has no effect
    // (the real-browser bug), the active element will be identical
    // before and after. This assertion catches that directly.
    expect(tInput.shadowRoot?.activeElement).not.toBe(tInputShadowActiveBefore);
    expect(document.activeElement).not.toBe(docActiveBefore);

    // The existing Esc behaviors must still hold.
    expect(element.searchQuery).toBe('');
    expect((element as any).isSearchFocused).toBe(false);
    const tTrackList = getTrackList();
    expect(tTrackList?.highlightedIndex).toBe(-1);
  });
});
