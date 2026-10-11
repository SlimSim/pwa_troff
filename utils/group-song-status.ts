import type { GroupSongStatus } from '../types/troff.d.js';

export const GROUP_SONG_STATUS_ORDER = ['prio', 'active', 'standard', 'archived'] as const;

export const GROUP_SONG_STATUS_LABELS: Record<GroupSongStatus, string> = {
  prio: 'Prio',
  active: 'Active',
  standard: 'Standard',
  archived: 'Archived',
};

export function normalizeGroupSongStatus(s: unknown): GroupSongStatus {
  if (s === 'prio' || s === 'active' || s === 'standard' || s === 'archived') {
    return s;
  }
  return 'standard';
}

export function isGroupSongStatusCollapsed(status: GroupSongStatus): boolean {
  return status === 'archived';
}

export function groupSongsByStatus<T extends { songKey: string }>(
  tracks: T[],
  statusByKey: Record<string, unknown>
): Record<GroupSongStatus, T[]> {
  const result: Record<GroupSongStatus, T[]> = {
    prio: [],
    active: [],
    standard: [],
    archived: [],
  };
  for (const track of tracks) {
    const status = normalizeGroupSongStatus(statusByKey[track.songKey]);
    result[status].push(track);
  }
  return result;
}

export function getGroupSongStatusCountText(status: GroupSongStatus, count: number): string {
  if (isGroupSongStatusCollapsed(status)) {
    return `Show ${count} archived songs`;
  }
  return `${GROUP_SONG_STATUS_LABELS[status]} (${count})`;
}
