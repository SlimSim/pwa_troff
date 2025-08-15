// Utility functions

function escapeRegExp(string) {
  return string
    .replace('"', '\\"') // wierd extra escaping of > \" <
    .replace(/[".*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

function getFileExtension(filename) {
  return filename.substr(filename.lastIndexOf(".") + 1).toLowerCase();
}

const fileUrlToStorageFileName = function (downloadUrl) {
  const urlNoParameters = downloadUrl.split("?")[0];
  const partList = urlNoParameters.split("%2F");

  // return last part, which is the file-name!
  return partList[partList.length - 1];
};

export { escapeRegExp, getFileExtension, fileUrlToStorageFileName };
