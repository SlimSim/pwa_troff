// Utility functions

function escapeRegExp(string) {
  return string
    .replace('"', '\\"') // wierd extra escaping of > \" <
    .replace(/[".*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

function getFileExtension(filename) {
  return filename.substr(filename.lastIndexOf(".") + 1).toLowerCase();
}

export { escapeRegExp, getFileExtension };
