/**
 * Selective merge for incoming Firebase sync data.
 *
 * When remote data arrives, keep every local field (user prefs like speed/volume
 * are not shared) and overwrite *only* the fields that are synced across users:
 *   - markers (marker edits)
 *   - aStates (remembered states add/remove)
 *   - TROFF_VALUE_tapTempo (tap tempo)
 *   - info (the song note)
 *   - the 8 shared fileData metadata fields (field-wise, see
 *     SHARED_FILE_DATA_FIELDS); every other fileData key stays local
 *
 * localInformation is *always* preserved from local (never uploaded, never clobbered).
 * latestUploadToFirebase is taken from remote so future timestamp checks work.
 *
 * The time comparison (newer / >=) stays in the callers.
 * Upload payload is never changed.
 */

/** The 8 fileData fields shared across clients (field-wise merge whitelist). */
export const SHARED_FILE_DATA_FIELDS = [
  'customName',
  'choreography',
  'choreographer',
  'title',
  'artist',
  'album',
  'genre',
  'tags',
] as const;

export function mergeSyncedSongData(
  localData: Record<string, unknown> | null | undefined,
  remoteData: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = localData ? { ...localData } : {};

  if ('markers' in remoteData) {
    result.markers = remoteData.markers;
  }
  if ('aStates' in remoteData) {
    result.aStates = remoteData.aStates;
  }
  if ('TROFF_VALUE_tapTempo' in remoteData) {
    result.TROFF_VALUE_tapTempo = remoteData.TROFF_VALUE_tapTempo;
  }

  if ('info' in remoteData) {
    result.info = remoteData.info;
  }

  if ('fileData' in remoteData) {
    const localFileData = (localData?.fileData ?? {}) as Record<string, unknown>;
    const remoteFileData = (remoteData.fileData ?? {}) as Record<string, unknown>;
    const mergedFileData: Record<string, unknown> = { ...localFileData };
    for (const field of SHARED_FILE_DATA_FIELDS) {
      if (field in remoteFileData) {
        mergedFileData[field] = remoteFileData[field];
      }
    }
    result.fileData = mergedFileData;
  }

  if ('latestUploadToFirebase' in remoteData) {
    result.latestUploadToFirebase = remoteData.latestUploadToFirebase;
  }

  // always keep local's localInformation (or ensure absent)
  if (localData && 'localInformation' in localData) {
    result.localInformation = localData.localInformation;
  } else if ('localInformation' in result) {
    delete result.localInformation;
  }

  return result;
}
