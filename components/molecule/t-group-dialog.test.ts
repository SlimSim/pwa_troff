import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GroupDialog } from './t-group-dialog.js';

describe('t-group-dialog', () => {
  let element: GroupDialog;

  beforeEach(() => {
    element = new GroupDialog();
    element.open = true;
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  });

  it('renders a delete button with confirm state when editing an existing group', async () => {
    // Set a mock group so it's in "edit" mode and the delete button shows up
    element.group = {
      id: 1,
      name: 'Test Group',
      color: '#000000',
      songs: []
    };
    await element.updateComplete;

    const deleteBtn = element.shadowRoot?.querySelector('t-butt.btn-danger') as HTMLElement;
    expect(deleteBtn).toBeTruthy();
    expect(deleteBtn.getAttribute('title')).toBe('Delete group');
    expect(deleteBtn.hasAttribute('confirm')).toBe(true);
    expect(deleteBtn.getAttribute('confirmText')).toBe('Delete group?');
  });
});
