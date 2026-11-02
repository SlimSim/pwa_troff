/**
 * Shared state that routes "Download songs online" downloads into the
 * currently-open group.
 *
 * t-media-parent sets/clears the target group key when the online-add mode is
 * entered/exited, and v2Script converts it into a `group-song-added` event
 * after a song finishes downloading — so the file is cached locally first and
 * the share-to-group upload works with it.
 */

let activeGroupKey: string | null = null;

export function setActiveOnlineGroupAdd(groupKey: string | null): void {
  activeGroupKey = groupKey || null;
}

export function getActiveOnlineGroupAdd(): string | null {
  return activeGroupKey;
}

/** Build the `group-song-added` event for a downloaded song, or null when no
 *  group online-add is active (or the songKey is empty). */
export function createGroupSongAddedEvent(songKey: string): CustomEvent | null {
  if (!activeGroupKey || !songKey) return null;
  return new CustomEvent('group-song-added', {
    detail: { groupKey: activeGroupKey, songKey, title: songKey },
    bubbles: true,
    composed: true,
  });
}
