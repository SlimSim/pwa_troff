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

export { blurHack, escapeRegExp, getFileExtension, removeLocalInfo, fileUrlToStorageFileName };
