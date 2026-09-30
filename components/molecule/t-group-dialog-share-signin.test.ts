import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GroupDialog } from './t-group-dialog.js';
import type { TroffFirebaseGroupIdentifyer } from '../../types/troff.d.js';

/**
 * Share popup sign-in + local-only group owners discovery.
 *
 * Test A (new-group mode, signed out): the "You have to sign in to share
 * a group!" popup must offer a Sign in button that dispatches a bubbling/
 * composed `sign-in-requested` event (same pattern as t-settings-panel
 * `_handleSignInClick`) WITHOUT closing the main dialog, preserving
 * whatever the user typed.
 *
 * Test B (edit mode, local-only group): editing an existing group with
 * `group != null` but no `firebaseGroupDocId` while signed out must show
 * the same "Share this group with others" + "Add owners" affordance that
 * opens the sign-in popup, instead of rendering nothing.
 */

/** Private members under test — accessed via cast, as in other component tests. */
type GroupDialogInternals = {
  _editName: string;
  _editInfo: string;
  _editColor: string;
  _editIcon: string;
  _editOwners: string[];
  _showSharePopup: boolean;
  _openSharePopup: () => void;
};

const internals = (element: GroupDialog): GroupDialogInternals =>
  element as unknown as GroupDialogInternals;

/** Mounts the dialog, then applies props and opens it (so the clone runs). */
async function openDialog(options: {
  group: TroffFirebaseGroupIdentifyer | null;
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
function clickAddOwnersTeaser(element: GroupDialog): HTMLElement | null {
  const btn = element.shadowRoot?.querySelector(
    't-butt.add-owner-btn'
  ) as HTMLElement | null;
  btn?.click();
  return btn;
}

function sharePopup(element: GroupDialog): HTMLElement | null {
  return element.shadowRoot?.querySelector('.share-popup') as HTMLElement | null;
}

function findSignInButton(popup: HTMLElement): HTMLElement | null {
  const buttons = Array.from(popup.querySelectorAll('t-butt'));
  const match = buttons.find((b) =>
    (b.textContent ?? '').toLowerCase().includes('sign in')
  );
  return (match as unknown as HTMLElement | undefined) ?? null;
}

describe('t-group-dialog share popup sign-in', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it(
    'Test A: new-group mode signed out — popup has a Sign in button that ' +
      'dispatches sign-in-requested without closing the dialog or losing typed input',
    async () => {
      const element = await openDialog({ group: null, signedIn: false });

      // Type something before opening the popup — it must survive sign-in.
      internals(element)._editName = 'My Group';
      internals(element)._editInfo = 'Some info';
      internals(element)._editColor = '#ff0000';
      internals(element)._editIcon = 'music';
      await element.updateComplete;

      // Open the popup the same way a user does.
      const teaser = clickAddOwnersTeaser(element);
      expect(teaser, 'new-group signed-out teaser "Add owners" button must exist').toBeTruthy();
      await element.updateComplete;

      const popup = sharePopup(element);
      expect(popup, 'share popup must open after clicking Add owners').toBeTruthy();
      expect(popup?.textContent ?? '').toContain(
        'You have to sign in to share a group!'
      );

      // THE GAP: today the popup only has an OK button — no Sign in button.
      const signInBtn = popup ? findSignInButton(popup) : null;
      expect(
        signInBtn,
        'share popup must offer a "Sign in" button (dialog must not import ' +
          'Firebase; it dispatches a bubbling/composed sign-in request event)'
      ).toBeTruthy();

      // Clicking Sign in must request auth via event, keeping the dialog open
      // in create mode with the typed values preserved.
      const seen: CustomEvent[] = [];
      const onSignIn = (event: Event): void => {
        seen.push(event as CustomEvent);
      };
      element.addEventListener('sign-in-requested', onSignIn);
      signInBtn?.click();
      await element.updateComplete;
      element.removeEventListener('sign-in-requested', onSignIn);

      expect(
        seen.length,
        'clicking Sign in must dispatch a sign-in request event'
      ).toBe(1);
      expect(seen[0].type).toBe('sign-in-requested');
      expect(seen[0].bubbles).toBe(true);
      expect(seen[0].composed).toBe(true);
      expect(element.open, 'main dialog must stay open after Sign in click').toBe(true);
      expect(element.group, 'dialog must stay in create mode (group still null)').toBeNull();
      expect(internals(element)._editName).toBe('My Group');
      expect(internals(element)._editInfo).toBe('Some info');
      expect(internals(element)._editColor).toBe('#ff0000');
      expect(internals(element)._editIcon).toBe('music');
    }
  );

  it(
    'Test B: edit mode with local-only group signed out — shows "Share this ' +
      'group with others" + Add owners button that opens the same popup',
    async () => {
      const localOnlyGroup: TroffFirebaseGroupIdentifyer = {
        id: 1,
        name: 'x',
        songs: [],
      };
      const element = await openDialog({ group: localOnlyGroup, signedIn: false });

      // THE GAP: today _renderOwnersSection() returns '' for a local-only
      // group while signed out, so users never discover sharing.
      const bodyText = element.shadowRoot?.textContent ?? '';
      expect(
        bodyText,
        'local-only group while signed out must show "Share this group with others"'
      ).toContain('Share this group with others');

      const teaser = clickAddOwnersTeaser(element);
      expect(
        teaser,
        'local-only group while signed out must show an "Add owners" button'
      ).toBeTruthy();
      await element.updateComplete;

      const popup = sharePopup(element);
      expect(
        popup,
        'clicking Add owners on a local-only group must open the sign-in popup'
      ).toBeTruthy();
      expect(popup?.textContent ?? '').toContain(
        'You have to sign in to share a group!'
      );
    }
  );
});
