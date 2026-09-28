import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GroupDialog } from './t-group-dialog.js';

/**
 * Bugfix RED test: share popup must auto-dismiss on successful sign-in.
 *
 * Scenario: creating a new group while signed out, user clicks "Add owners"
 * -> "You have to sign in to share a group!" popup opens. After auth
 * succeeds (v2Script sets signedIn=true + userEmail), the popup must close
 * while the main dialog stays open in create mode with typed values
 * preserved and the owners editor visible.
 */

type GroupDialogInternals = {
  _editName: string;
  _editInfo: string;
  _editColor: string;
  _editIcon: string;
  _editOwners: string[];
  _showSharePopup: boolean;
};

const internals = (element: GroupDialog): GroupDialogInternals =>
  element as unknown as GroupDialogInternals;

describe('t-group-dialog share popup auto-dismiss on sign-in', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('signed-out new-group: sign-in success dismisses popup, keeps dialog open with typed name and owners editor', async () => {
    const element = new GroupDialog();
    document.body.appendChild(element);
    await element.updateComplete;

    element.group = null;
    element.signedIn = false;
    element.open = true;
    await element.updateComplete;

    // Type a name before opening the popup — must survive sign-in.
    internals(element)._editName = 'My New Group';
    await element.updateComplete;

    // Open popup via Add owners teaser the same way a user does.
    const teaser = element.shadowRoot?.querySelector(
      't-butt.add-owner-btn'
    ) as HTMLElement | null;
    expect(teaser, 'new-group signed-out teaser "Add owners" must exist').toBeTruthy();
    teaser?.click();
    await element.updateComplete;

    expect(
      element.shadowRoot?.querySelector('.share-popup'),
      'share popup must open after clicking Add owners'
    ).toBeTruthy();

    // Simulate successful sign-in as v2Script does after auth.
    element.signedIn = true;
    element.userEmail = 'a@b.c';
    await element.updateComplete;

    // Popup must auto-dismiss.
    expect(
      element.shadowRoot?.querySelector('.share-popup'),
      'share popup must auto-dismiss after successful sign-in'
    ).toBeNull();
    expect(
      element.shadowRoot?.textContent ?? '',
      'sign-in prompt text must be gone after sign-in'
    ).not.toContain('You have to sign in');

    // Dialog stays open in create mode with typed name preserved.
    expect(element.open, 'main dialog must stay open after sign-in').toBe(true);
    expect(element.group, 'dialog must stay in create mode (group still null)').toBeNull();
    expect(internals(element)._editName).toBe('My New Group');

    // Owners editor appears.
    expect(
      element.shadowRoot?.textContent ?? '',
      'owners editor must be visible after sign-in'
    ).toContain('Owners (email addresses)');
  });
});
