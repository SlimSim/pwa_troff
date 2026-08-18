/**
 * Selective merge for incoming Firebase sync data.
 *
 * When remote data arrives, keep every local field (user prefs like speed/volume
 * are not shared) and overwrite *only* the fields that are synced across users:
 *   - markers (marker edits)
 *   - aStates (remembered states add/remove)
 *   - TROFF_VALUE_tapTempo (tap tempo)
 *
 * localInformation is *always* preserved from local (never uploaded, never clobbered).
 * latestUploadToFirebase is taken from remote so future timestamp checks work.
 *
 * The time comparison (newer / >=) stays in the callers.
 * Upload payload is never changed.
 */

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
