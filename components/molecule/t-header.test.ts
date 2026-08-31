import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Header } from './t-header.js';

// `songInfo` does not exist on Header yet — this cast keeps tsc green until the
// production property lands (this is what makes these tests RED).
type HeaderWithSongInfo = Header & { songInfo: string };

const getSongInfo = (el: Header): string => (el as HeaderWithSongInfo).songInfo;
const setSongInfo = (el: Header, value: string): void => {
  (el as HeaderWithSongInfo).songInfo = value;
};

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