/* eslint eqeqeq: "off" */
// UI-related functions

import { User } from 'firebase/auth';
import { nDB } from '../assets/internal/db.js';
import { SongToGroup } from '../scriptASimple.js';

const setUiToSignIn = (user: User): void => {
  $('#userName').text(user.displayName || user.email || 'Unknown');
  $('.hide-on-sign-out').removeClass('hidden');
  $('.hide-on-sign-in').addClass('hidden');
  nDB.set('TROFF_FIREBASE_PREVIOUS_SIGNED_IN', true);
};

const setUiToNotSignIn = (): void => {
  $('.hide-on-sign-out').addClass('hidden');
  $('.hide-on-sign-in').removeClass('hidden');
  nDB.set('TROFF_FIREBASE_PREVIOUS_SIGNED_IN', false);
};

function updateGroupNotification(songKey: string): void {
  const nrGroups = SongToGroup.getNrOfGroupsThisSongIsIn(songKey);
  if (nrGroups == 0) {
    $('#currentGroupsParent').addClass('hidden');
    $('.groupIndicationDiv').removeClass('groupIndication');
    return;
  }
  $('#currentGroupsParent').removeClass('hidden');

  $('.groupIndicationDiv').addClass('groupIndication');

  $('.currentNrGroups').text(nrGroups);

  const groups = SongToGroup.getSongGroupList(songKey);

  if (groups == null) {
    return;
  }

  const groupNames: string[] = groups.map((group) => {
    return $('#songListList').find(`[data-firebase-group-doc-id="${group.groupDocId}"]`).text();
  });

  $('#currentNrGroupsPluralS').toggleClass('hidden', nrGroups == 1);

  $('#currentGroups').empty();
  groupNames.forEach((name) => {
    $('#currentGroups').append($('<li>').addClass('pt-2').text(name));
  });
}

export { setUiToSignIn, setUiToNotSignIn, updateGroupNotification };
