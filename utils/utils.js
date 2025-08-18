// Utility functions

import '../assets/external/jquery-3.6.0.min.js';

function escapeRegExp(string) {
  return string
    .replace('"', '\\"') // wierd extra escaping of > \" <
    .replace(/[".*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function getFileExtension(filename) {
  return filename.substr(filename.lastIndexOf('.') + 1).toLowerCase();
}

const fileUrlToStorageFileName = function (downloadUrl) {
  const urlNoParameters = downloadUrl.split('?')[0];
  const partList = urlNoParameters.split('%2F');

  // return last part, which is the file-name!
  return partList[partList.length - 1];
};

const removeLocalInfo = (markerObject) => {
  const { localInformation, ...payload } = markerObject;
  return payload;
};

const loadExternalHtml = (includes, callback) => {
  if (includes.length === 0) {
    if (callback == null) {
      return;
    }
    return callback();
  }
  const currentElement = includes.eq(-1);
  includes.splice(includes.length - 1, 1);

  const file = $(currentElement).data('include');
  $(currentElement).load(file, function () {
    loadExternalHtml(includes, callback);
  });
};

export {
  escapeRegExp,
  loadExternalHtml,
  getFileExtension,
  removeLocalInfo,
  fileUrlToStorageFileName,
};
