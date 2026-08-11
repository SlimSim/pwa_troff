// Utility functions

import { TroffObjectFirebase, TroffObjectLocal } from 'types/troff.js';
import '../assets/external/jquery-3.6.0.min.js';

function escapeRegExp(string: string): string {
  return string
    .replace('"', '\\"') // wierd extra escaping of > \" <
    .replace(/[".*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function getFileExtension(filename: string): string {
  return filename.substr(filename.lastIndexOf('.') + 1).toLowerCase();
}

const fileUrlToStorageFileName = function (downloadUrl: string): string {
  const urlNoParameters = downloadUrl.split('?')[0];
  const partList = urlNoParameters.split('%2F');

  // return last part, which is the file-name!
  return partList[partList.length - 1];
};

const removeLocalInfo = (markerObject: TroffObjectLocal): TroffObjectFirebase => {
  const { localInformation, ...payload } = markerObject;
  return payload;
};

const blurHack = () => {
  document.getElementById('blur-hack')?.focus({ preventScroll: true });
};

/**
 * Safely decodes a URI component, falling back to decodeURI and then the original string
 * if the input contains invalid percent-encoding.
 */
export function safeDecodeURIComponent(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    try {
      return decodeURI(str);
    } catch {
      return str;
    }
  }
}

/**
 * Normalizes a song key to its basename (last path segment).
 * Strips any directory prefix (e.g. "font/song.mp3" → "song.mp3")
 * so that path-qualified file names from file pickers never pollute
 * cache/nDB/Firestore keys.
 */
export function toSongKey(name: string): string {
  return safeDecodeURIComponent(name.split(/[\\/]/).pop() || name);
}

/**
 * v2 stores group icons without the Fontello `fa-` prefix (e.g. `lindy-hop`),
 * while v1 applies them as `fa-` prefixed classes. Ensure the prefix exists.
 */
export function toFontelloIcon(icon: string | undefined, fallback: string): string {
  if (icon && !icon.startsWith('fa-')) {
    return `fa-${icon}`;
  }
  return icon || fallback;
}

export { blurHack, escapeRegExp, getFileExtension, removeLocalInfo, fileUrlToStorageFileName };
