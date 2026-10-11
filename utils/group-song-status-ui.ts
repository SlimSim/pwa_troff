import type { GroupSongStatus, TroffFirebaseSongIdentifyer } from '../types/troff.d.js';
import {
  GROUP_SONG_STATUS_ORDER,
  getGroupSongStatusCountText,
  normalizeGroupSongStatus,
} from './group-song-status.js';

export const GROUP_SONG_STATUS_CHANGED_EVENT = 'group-song-status-changed' as const;

export interface GroupSongStatusSection<T> {
  status: GroupSongStatus;
  tracks: T[];
  collapsed: boolean;
  expanderText?: string;
}

export interface GroupSongStatusChangedDetail {
  songKey: string;
  status: GroupSongStatus;
  groupKey: string;
}

export function getGroupSongStatusSections<T extends { songKey: string }>(
  tracks: T[],
  statusByKey: Record<string, unknown>
): Array<GroupSongStatusSection<T>> {
  const buckets: Record<GroupSongStatus, T[]> = {
    prio: [],
    active: [],
    standard: [],
    archived: [],
  };
  for (const track of tracks) {
    buckets[normalizeGroupSongStatus(statusByKey[track.songKey])].push(track);
  }
  return GROUP_SONG_STATUS_ORDER.map((status) => {
    const section: GroupSongStatusSection<T> = {
      status,
      tracks: buckets[status],
      collapsed: status === 'archived',
    };
    if (status === 'archived') {
      section.expanderText = getGroupSongStatusCountText('archived', buckets[status].length);
    }
    return section;
  });
}

export function buildGroupSongStatusChangedDetail(
  songKey: string,
  status: unknown,
  groupKey: string
): GroupSongStatusChangedDetail {
  return { songKey, status: normalizeGroupSongStatus(status), groupKey };
}

export function buildGroupSongStatusChangedEvent(
  songKey: string,
  status: unknown,
  groupKey: string
): CustomEvent<GroupSongStatusChangedDetail> {
  return new CustomEvent<GroupSongStatusChangedDetail>(GROUP_SONG_STATUS_CHANGED_EVENT, {
    detail: buildGroupSongStatusChangedDetail(songKey, status, groupKey),
    bubbles: true,
    composed: true,
  });
}

export function applyGroupSongStatusChange(
  entries: TroffFirebaseSongIdentifyer[],
  songKey: string,
  status: unknown
): TroffFirebaseSongIdentifyer[] {
  const normalized = normalizeGroupSongStatus(status);
  return entries.map((entry) =>
    entry.fullPath === songKey ? { ...entry, status: normalized } : entry
  );
}
