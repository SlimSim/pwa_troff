import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Header } from './t-header.js';
import { Popover } from '../atom/t-popover.js';

// `songInfo` does not exist on Header yet — this cast keeps tsc green until the
// production property lands (this is what makes these tests RED).
type HeaderWithSongInfo = Header & { songInfo: string };

const getSongInfo = (el: Header): string => (el as HeaderWithSongInfo).songInfo;
const setSongInfo = (el: Header, value: string): void => {
  (el as HeaderWithSongInfo).songInfo = value;
};

// `groupNames` does not exist on Header yet — same trick as songInfo above.
type HeaderWithGroups = Header & { groupNames: string[] };

// Cast for typed test access to `selectedGroupName` (declared on Header at
// t-header.ts:189 via `@property({ type: String })`).
type HeaderWithSelectedGroup = Header & { selectedGroupName: string };

type DropdownButtonEl = HTMLElement & { open?: boolean };
type TTextareaEl = HTMLElement & { value?: string };

describe('t-header song info dropdown', () => {
  let element: Header;

  beforeEach(() => {
    element = new Header();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  it('songInfo property defaults to empty string', async () => {
    await element.updateComplete;
    expect(getSongInfo(element)).toBe('');
  });

  it('renders an info dropdown trigger containing a t-icon[name="info"]', async () => {
    await element.updateComplete;

    const dropdownBtn = element.shadowRoot?.querySelector('t-dropdown-button') as HTMLElement | null;
    expect(dropdownBtn).toBeTruthy();

    // Slot content is light DOM of the t-dropdown-button, so querying its
    // children directly works.
    const infoIcon = dropdownBtn!.querySelector('t-icon[name="info"]');
    expect(infoIcon).toBeTruthy();
  });

  it('clicking the info trigger opens the dropdown', async () => {
    await element.updateComplete;

    const dropdownBtn = element.shadowRoot?.querySelector('t-dropdown-button') as DropdownButtonEl | null;
    expect(dropdownBtn).toBeTruthy();

    const buttonWrapper = dropdownBtn!.shadowRoot?.querySelector('.button-wrapper') as HTMLElement | null;
    expect(buttonWrapper).toBeTruthy();
    buttonWrapper!.click();
    await element.updateComplete;

    expect(dropdownBtn!.open).toBe(true);
  });

  it('clicking the info trigger does NOT dispatch header-expand nor expand the header', async () => {
    await element.updateComplete;

    const expandSpy = vi.fn();
    element.addEventListener('header-expand', expandSpy);

    const dropdownBtn = element.shadowRoot?.querySelector('t-dropdown-button') as DropdownButtonEl | null;
    expect(dropdownBtn).toBeTruthy();

    const buttonWrapper = dropdownBtn!.shadowRoot?.querySelector('.button-wrapper') as HTMLElement | null;
    expect(buttonWrapper).toBeTruthy();
    buttonWrapper!.click();
    await element.updateComplete;

    expect(expandSpy).not.toHaveBeenCalled();
    expect(element.expanded).toBe(false);
  });

  it('reflects songInfo into the dropdown textarea value', async () => {
    setSongInfo(element, 'my info text');
    await element.updateComplete;

    const dropdownBtn = element.shadowRoot?.querySelector('t-dropdown-button') as DropdownButtonEl | null;
    expect(dropdownBtn).toBeTruthy();

    // Open the dropdown so the info content is visible/interactable.
    const buttonWrapper = dropdownBtn!.shadowRoot?.querySelector('.button-wrapper') as HTMLElement | null;
    expect(buttonWrapper).toBeTruthy();
    buttonWrapper!.click();
    await element.updateComplete;

    const textarea = element.shadowRoot?.querySelector('t-textarea') as TTextareaEl | null;
    expect(textarea).toBeTruthy();
    expect(textarea!.value).toBe('my info text');
  });

  it('typing in the textarea updates songInfo', async () => {
    await element.updateComplete;

    const textarea = element.shadowRoot?.querySelector('t-textarea') as TTextareaEl | null;
    expect(textarea).toBeTruthy();

    // t-textarea re-dispatches native input as CustomEvent('input') with
    // detail.value — simulate exactly that.
    textarea!.dispatchEvent(
      new CustomEvent('input', {
        detail: { value: 'edited info' },
        bubbles: true,
        composed: true,
      })
    );
    await element.updateComplete;

    expect(getSongInfo(element)).toBe('edited info');
  });

  it('keeps typed text when typing like a real user (native input event on the inner textarea)', async () => {
    // Arrange: header with some pre-existing info, dropdown open
    setSongInfo(element, 'hello');
    await element.updateComplete;

    const dropdownBtn = element.shadowRoot?.querySelector('t-dropdown-button') as DropdownButtonEl | null;
    expect(dropdownBtn).toBeTruthy();
    const buttonWrapper = dropdownBtn!.shadowRoot?.querySelector('.button-wrapper') as HTMLElement | null;
    buttonWrapper!.click();
    await element.updateComplete;

    const textarea = element.shadowRoot?.querySelector('t-textarea') as TTextareaEl | null;
    expect(textarea).toBeTruthy();
    const native = textarea!.shadowRoot?.querySelector('textarea') as HTMLTextAreaElement | null;
    expect(native).toBeTruthy();

    // Act: simulate a real keystroke — set the native value and dispatch the
    // native input event (bubbles + composed, exactly what the browser fires).
    native!.value = 'hello world';
    native!.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await element.updateComplete;

    // Assert: text is NOT wiped. The header's songInfo must keep the typed value
    // AND the visible native textarea must still show it.
    expect(getSongInfo(element)).toBe('hello world');
    expect(native!.value).toBe('hello world');
  });

  it('typing in the textarea dispatches song-info-saved with the typed info (autosave)', async () => {
    await element.updateComplete;

    const savedSpy = vi.fn();
    element.addEventListener('song-info-saved', savedSpy);

    const textarea = element.shadowRoot?.querySelector('t-textarea') as TTextareaEl | null;
    expect(textarea).toBeTruthy();

    // Simulate a real keystroke: set the inner native textarea value and fire
    // the native composed input event (same flow as a browser keystroke).
    const native = textarea!.shadowRoot?.querySelector('textarea') as HTMLTextAreaElement | null;
    expect(native).toBeTruthy();
    native!.value = 'autosaved info';
    native!.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await element.updateComplete;

    // Autosave: song-info-saved must have been dispatched with the typed value.
    expect(savedSpy).toHaveBeenCalledTimes(1);
    const event = savedSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.info).toBe('autosaved info');
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
  });

  it('dropdown has no Save button (autosave replaces it)', async () => {
    await element.updateComplete;

    const dropdownBtn = element.shadowRoot?.querySelector('t-dropdown-button') as HTMLElement | null;
    expect(dropdownBtn).toBeTruthy();

    const dropdownContainer = dropdownBtn!.querySelector('[slot="dropdown"]') as HTMLElement | null;
    expect(dropdownContainer).toBeTruthy();

    // The dropdown should only contain the textarea — no save control.
    expect(dropdownContainer!.querySelector('t-butt')).toBeNull();
    expect(dropdownContainer!.querySelector('button')).toBeNull();
    expect(dropdownContainer!.querySelector('t-textarea')).toBeTruthy();
  });

  it('clicking the header container outside the dropdown still dispatches header-expand', async () => {
    await element.updateComplete;

    const expandSpy = vi.fn();
    element.addEventListener('header-expand', expandSpy);

    const container = element.shadowRoot?.querySelector('.header-container') as HTMLElement | null;
    expect(container).toBeTruthy();

    container!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await element.updateComplete;

    expect(expandSpy).toHaveBeenCalledTimes(1);
    expect(element.expanded).toBe(true);
  });

  // --- Notification indicator tests ---

  it('shows notification indicator when songInfo has content', async () => {
    setSongInfo(element, 'some note');
    await element.updateComplete;

    const dropdownBtn = element.shadowRoot?.querySelector('t-dropdown-button') as HTMLElement | null;
    expect(dropdownBtn).toBeTruthy();
    expect(dropdownBtn!.classList.contains('has-info')).toBe(true);
  });

  it('does not show notification indicator when songInfo is empty', async () => {
    await element.updateComplete;

    const dropdownBtn = element.shadowRoot?.querySelector('t-dropdown-button') as HTMLElement | null;
    expect(dropdownBtn).toBeTruthy();
    expect(dropdownBtn!.classList.contains('has-info')).toBe(false);
  });

  it('removes notification indicator when songInfo is cleared', async () => {
    setSongInfo(element, 'some note');
    await element.updateComplete;

    const dropdownBtn = element.shadowRoot?.querySelector('t-dropdown-button') as HTMLElement | null;
    expect(dropdownBtn).toBeTruthy();
    expect(dropdownBtn!.classList.contains('has-info')).toBe(true);

    setSongInfo(element, '');
    await element.updateComplete;

    expect(dropdownBtn!.classList.contains('has-info')).toBe(false);
  });

  it('does not show indicator for whitespace-only songInfo', async () => {
    setSongInfo(element, '   ');
    await element.updateComplete;

    const dropdownBtn = element.shadowRoot?.querySelector('t-dropdown-button') as HTMLElement | null;
    expect(dropdownBtn).toBeTruthy();
    expect(dropdownBtn!.classList.contains('has-info')).toBe(false);
  });
});

describe('t-header shared songlist indicator', () => {
  let element: Header;

  beforeEach(() => {
    element = new Header();
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
    vi.restoreAllMocks();
  });

  const setGroupNames = (value: string[]): void => {
    (element as HeaderWithGroups).groupNames = value;
  };

  const getPopover = (): Popover | null =>
    element.shadowRoot?.querySelector('t-popover.groups-popover') ?? null;

  const getInfoSection = (): HTMLElement | null =>
    element.shadowRoot?.querySelector('.info-section') ?? null;

  const getSelectedGroupName = (): string =>
    (element as HeaderWithSelectedGroup).selectedGroupName;

  // Assigned as a plain property, exactly as updateHeaderGroupsWithCurrentSong
  // does in production (and it must be reactive, because that function sets it
  // from outside the component).
  const setSelectedGroupName = (value: string): void => {
    (element as HeaderWithSelectedGroup).selectedGroupName = value;
  };

  it('groupNames property defaults to an empty array', async () => {
    await element.updateComplete;
    expect((element as HeaderWithGroups).groupNames).toEqual([]);
  });

  it('renders no indicator when groupNames is empty, but keeps the info dropdown inside .info-section', async () => {
    await element.updateComplete;

    expect(getPopover(), 'no t-popover.groups-popover when there are no groups').toBeNull();
    expect(element.shadowRoot?.querySelector('.groups-indicator')).toBeNull();

    // The song-info dropdown moves into (and must stay inside) .info-section.
    const infoSection = getInfoSection();
    expect(infoSection, '.info-section wrapper must exist').toBeTruthy();
    expect(infoSection!.querySelector('t-dropdown-button.info-dropdown')).toBeTruthy();
  });

  it('selectedGroupName property defaults to an empty string', async () => {
    await element.updateComplete;
    expect(getSelectedGroupName()).toBe('');
  });

  it('renders the popover for ONE group when no group is selected (selectedGroupName stays empty)', async () => {
    setGroupNames(['Band']);
    setSelectedGroupName('');
    await element.updateComplete;

    expect(getPopover(), 'popover must render while no group is selected').toBeTruthy();
  });

  it('renders NO popover when there is exactly ONE group and it IS the selected group', async () => {
    setGroupNames(['Band']);
    setSelectedGroupName('Band');
    await element.updateComplete;

    expect(getPopover(), 'the selected group must not be advertised as "shared"').toBeNull();
    expect(element.shadowRoot?.querySelector('.groups-indicator')).toBeNull();

    // …but the info-dropdown still renders inside .info-section.
    const infoSection = getInfoSection();
    expect(infoSection, '.info-section wrapper must exist').toBeTruthy();
    expect(infoSection!.querySelector('t-dropdown-button.info-dropdown')).toBeTruthy();
  });

  it('renders the popover for ONE group when a DIFFERENT group is selected', async () => {
    setGroupNames(['Band']);
    setSelectedGroupName('Other Group');
    await element.updateComplete;

    expect(getSelectedGroupName()).toBe('Other Group');
    expect(getPopover(), 'popover must render when the selected group differs').toBeTruthy();
    expect(element.shadowRoot?.querySelector('.groups-indicator')).toBeTruthy();
  });

  it('renders the popover when TWO groups include the selected group (count stays 2)', async () => {
    setGroupNames(['Group A', 'Group B']);
    setSelectedGroupName('Group A');
    await element.updateComplete;

    expect(getSelectedGroupName()).toBe('Group A');
    const popover = getPopover();
    expect(popover, 'two or more groups always show the indicator').toBeTruthy();
    expect(popover!.querySelector('.groups-count')?.textContent).toBe('2');
  });

  it('hides the popover when selectedGroupName changes to the group name after it was rendered', async () => {
    setGroupNames(['Band']);
    await element.updateComplete;
    expect(getPopover(), 'starts rendered while nothing is selected').toBeTruthy();

    setSelectedGroupName('Band');
    await element.updateComplete;

    expect(getPopover(), 'popover must disappear once its only group is selected').toBeNull();
    expect(element.shadowRoot?.querySelector('.groups-indicator')).toBeNull();
    // …and the info-dropdown still renders inside .info-section.
    expect(getInfoSection()!.querySelector('t-dropdown-button.info-dropdown')).toBeTruthy();
  });

  it('renders the indicator with count, users icon, exact title and exact body for ONE group', async () => {
    setGroupNames(['Solo Group']);
    await element.updateComplete;

    const popover = getPopover();
    expect(popover, 't-popover.groups-popover must render when a song is shared').toBeTruthy();

    // Stacked above the info-dropdown: rendered BEFORE it inside .info-section.
    const infoSection = getInfoSection();
    expect(infoSection).toBeTruthy();
    expect(infoSection!.children[0], 'indicator must render before the dropdown').toBe(popover);
    expect(infoSection!.querySelector('t-dropdown-button.info-dropdown')).toBeTruthy();

    const trigger = popover!.querySelector('t-butt.groups-indicator') as HTMLElement | null;
    expect(trigger, 'the popover trigger must be t-butt.groups-indicator').toBeTruthy();
    expect(trigger!.getAttribute('title')).toBe('Shared in 1 songlist');
    expect(trigger!.querySelector('t-icon[name="users"]'), 'users icon in trigger').toBeTruthy();
    expect(popover!.querySelector('.groups-count')?.textContent).toBe('1');
    expect(popover!.body).toBe('This song belongs to 1 shared songlist:\nSolo Group');
  });

  it('uses plural forms for TWO groups (exact title and body)', async () => {
    setGroupNames(['Group A', 'Group B']);
    await element.updateComplete;

    const popover = getPopover();
    expect(popover).toBeTruthy();

    const trigger = popover!.querySelector('t-butt.groups-indicator') as HTMLElement | null;
    expect(trigger).toBeTruthy();
    expect(trigger!.getAttribute('title')).toBe('Shared in 2 songlists');
    expect(popover!.querySelector('.groups-count')?.textContent).toBe('2');
    expect(popover!.body).toBe('This song belongs to 2 shared songlists:\nGroup A\nGroup B');
  });

  it('renders count, icon, plural title and body for THREE groups', async () => {
    setGroupNames(['Group A', 'Group B', 'Group C']);
    await element.updateComplete;

    const popover = getPopover();
    expect(popover).toBeTruthy();

    const trigger = popover!.querySelector('t-butt.groups-indicator') as HTMLElement | null;
    expect(trigger).toBeTruthy();
    expect(trigger!.getAttribute('title')).toBe('Shared in 3 songlists');
    expect(trigger!.querySelector('t-icon[name="users"]')).toBeTruthy();
    expect(popover!.querySelector('.groups-count')?.textContent).toBe('3');
    expect(popover!.body).toBe(
      'This song belongs to 3 shared songlists:\nGroup A\nGroup B\nGroup C'
    );
  });

  it('removes the indicator when groupNames is cleared again', async () => {
    setGroupNames(['Band']);
    await element.updateComplete;
    expect(getPopover()).toBeTruthy();

    setGroupNames([]);
    await element.updateComplete;

    expect(getPopover(), 'popover must disappear when the song leaves all groups').toBeNull();
    expect(element.shadowRoot?.querySelector('.groups-indicator')).toBeNull();
    // …and the info-dropdown still renders inside .info-section.
    expect(getInfoSection()!.querySelector('t-dropdown-button.info-dropdown')).toBeTruthy();
  });

  it('clicking the groups indicator opens the popover WITHOUT expanding the header', async () => {
    setGroupNames(['Group A', 'Group B']);
    await element.updateComplete;

    const expandSpy = vi.fn();
    element.addEventListener('header-expand', expandSpy);

    const popover = getPopover();
    expect(popover).toBeTruthy();

    // happy-dom does not include <slot> nodes in composedPath, so a click on
    // the slotted light-DOM button never reaches the popover's trigger
    // listener (same limitation documented in t-marker.test.ts). Drive the
    // popover's .trigger-wrapper instead — the exact element a user click on
    // t-butt.groups-indicator bubbles through in a real browser. Its
    // stopPropagation is what keeps the click from reaching the header's
    // .header-container @click handler (which would expand the header).
    const triggerWrapper = popover!.shadowRoot?.querySelector('.trigger-wrapper') as HTMLElement | null;
    expect(triggerWrapper, 'popover trigger wrapper must exist').toBeTruthy();

    // Find the button via the header's shadow (slotted content is not visible via
    // querySelector inside the popover's shadow wrapper in happy-dom, matching
    // the documented pattern in t-marker.test.ts).
    const triggerBtn = element.shadowRoot?.querySelector('t-butt.groups-indicator') as HTMLElement | null;
    expect(triggerBtn, 'the indicator must be the popover trigger').toBeTruthy();

    triggerWrapper!.click();
    await popover!.updateComplete;
    await element.updateComplete;

    expect(popover!.open, 'popover must open').toBe(true);
    expect(expandSpy, 'no header-expand event from the indicator').not.toHaveBeenCalled();
    expect(element.expanded, 'header must stay collapsed').toBe(false);
  });
});