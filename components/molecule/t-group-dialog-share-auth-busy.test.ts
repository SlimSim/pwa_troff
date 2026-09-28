import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GroupDialog } from './t-group-dialog.js';

/**
 * Share popup sign-in button parity with the other sign-in buttons in the app.
 *
 * Reference patterns:
 * - `t-settings-panel.ts` lines 618-624 (signed-out idle: `<t-butt>` with
 *   `<t-icon name="login">` left + "Sign in" text) and lines 619-620 (busy:
 *   `<span class="auth-busy"><t-loading></t-loading>Signing in…</span>`, no
 *   active Sign in button).
 * - `t-media-parent.ts` lines 2171-2179 (same idle/busy pattern).
 *
 * Required:
 * - (A) popup Sign in button contains `<t-icon name="login">` to the left of
 *   "Sign in" text.
 * - (B) clicking it while busy must not re-dispatch: when busy (new
 *   `authBusy` property, settable from v2Script like settingsPanel/songList),
 *   popup shows `<t-loading>` + "Signing in" text and NO clickable Sign in
 *   `<t-butt>`, so a second click cannot dispatch `sign-in-requested`.
 *
 * Type-safe view of the authBusy contract (same pattern as
 * `t-settings-panel-auth-busy.test.ts` line 12): the intersection cast keeps
 * this file valid both before (RED — property undefined at runtime, busy UI
 * absent) and after the property exists. No `any`, no Firebase import.
 */
type GroupDialogAuth = GroupDialog & { authBusy: boolean };

/** Mounts the dialog, then applies props and opens it (so the clone runs). */
async function openDialog(options: {
  group: null;
  signedIn: boolean;
}): Promise<GroupDialog> {
  const element = new GroupDialog();
  document.body.appendChild(element);
  await element.updateComplete;

  element.group = options.group;
  element.signedIn = options.signedIn;
  element.open = true;
  await element.updateComplete;
  return element;
}

/** Clicks the "Add owners" teaser button that opens the share popup. */
function clickAddOwnersTeaser(element: GroupDialog): void {
  const btn = element.shadowRoot?.querySelector(
    't-butt.add-owner-btn'
  ) as HTMLElement | null;
  btn?.click();
}

function sharePopup(element: GroupDialog): HTMLElement | null {
  return element.shadowRoot?.querySelector('.share-popup') as HTMLElement | null;
}

/** All t-butt elements inside the popup whose label contains "sign in". */
function findSignInButtons(popup: HTMLElement): HTMLElement[] {
  return Array.from(popup.querySelectorAll('t-butt')).filter((b) =>
    (b.textContent ?? '').toLowerCase().includes('sign in')
  ) as unknown as HTMLElement[];
}

describe('t-group-dialog share popup sign-in parity (icon + authBusy)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('Test A: new-group signedOut popup Sign in t-butt contains t-icon[name=login] left of text', async () => {
    const element = await openDialog({ group: null, signedIn: false });

    clickAddOwnersTeaser(element);
    await element.updateComplete;

    const popup = sharePopup(element);
    expect(popup, 'share popup must open after clicking Add owners').toBeTruthy();

    const signInBtns = popup ? findSignInButtons(popup) : [];
    expect(
      signInBtns.length,
      'share popup must offer a "Sign in" t-butt'
    ).toBeGreaterThan(0);

    const signInBtn = signInBtns[0];
    const icon = signInBtn.querySelector('t-icon[name="login"]');
    expect(
      icon,
      'popup Sign in t-butt must contain <t-icon name="login"> like t-settings-panel/t-media-parent'
    ).toBeTruthy();

    // Icon must sit to the left of the "Sign in" text.
    const html = signInBtn.innerHTML;
    expect(html.indexOf('login') < html.indexOf('Sign in')).toBe(true);
  });

  it('Test B: busy popup shows t-loading + Signing in text with zero clickable Sign in t-butt; click dispatches no sign-in-requested', async () => {
    const element = (await openDialog({
      group: null,
      signedIn: false,
    })) as GroupDialogAuth;
    element.authBusy = true;
    await element.updateComplete;

    clickAddOwnersTeaser(element);
    await element.updateComplete;

    const popup = sharePopup(element);
    expect(popup, 'share popup must open after clicking Add owners').toBeTruthy();
    if (!popup) return;

    expect(
      popup.querySelector('t-loading'),
      'busy share popup must show <t-loading>'
    ).toBeTruthy();
    expect(popup.textContent ?? '').toMatch(/Signing in/);

    const signInBtns = findSignInButtons(popup);
    expect(
      signInBtns.length,
      'busy share popup must have NO clickable Sign in t-butt so a second click cannot re-dispatch'
    ).toBe(0);

    // A click on the popup area (or the Sign in button, if one wrongly
    // exists) must not dispatch a second sign-in request while busy.
    const seen: CustomEvent[] = [];
    const onSignIn = (event: Event): void => {
      seen.push(event as CustomEvent);
    };
    element.addEventListener('sign-in-requested', onSignIn);
    if (signInBtns.length > 0) {
      signInBtns[0].click();
    } else {
      popup.click();
    }
    await element.updateComplete;
    element.removeEventListener('sign-in-requested', onSignIn);

    expect(
      seen.length,
      'clicking while busy must not dispatch sign-in-requested'
    ).toBe(0);
  });
});
