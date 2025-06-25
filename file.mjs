// ES6 module version of file.js for testing
// Export key objects and functions for testability

export const fileHandler = {};
export const backendService = {};
export const firebaseWrapper = {};

// Private methods and variables
const nameOfCache = "songCache-v1.0";
const v3Init = { status: 200, statusText: "version-3", responseType: "cors" };

export const crc32Hash = function (r) {
  for (var a, o = [], c = 0; c < 256; c++) {
    a = c;
    for (var f = 0; f < 8; f++) a = 1 & a ? 3988292384 ^ (a >>> 1) : a >>> 1;
    o[c] = a;
  }
  for (var n = -1, t = 0; t < r.length; t++)
    n = (n >>> 8) ^ o[255 & (n ^ r.charCodeAt(t))];
  return (-1 ^ n) >>> 0;
};

export const hashFile = async function (file) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = async function (event) {
      const data = event.target.result;
      const fileHash = await sha256Hash(data);
      resolve(fileHash);
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
};

export const sha256Hash = async function (object) {
  const msgUint8 = new TextEncoder().encode(JSON.stringify(object));
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
};

export const readFileTypeAndExtension = function (file, callbackFunk) {
  var reader = new FileReader();
  reader.addEventListener("load", function (e) {
    const arr = new Uint8Array(e.target.result).subarray(0, 22);
    let extension = "",
      type = "",
      h = "";

    for (var i = 0; i < arr.length; i++) {
      h += arr[i].toString(16).toUpperCase();
    }

    if (
      h.startsWith("494433") ||
      h.startsWith("FFFB") ||
      h.startsWith("FFF3") ||
      h.startsWith("FFF2")
    ) {
      [type, extension] = ["audio/mpeg", "mp3"];
    } else if (h.startsWith("00020667479704D3441")) {
      [type, extension] = ["audio/x-m4a", "m4a"];
    } else if (h.startsWith("52494646") && h.indexOf("57415645") != -1) {
      [type, extension] = ["audio/wav", "wav"];
    } else if (h.startsWith("4F676753")) {
      [type, extension] = ["audio/ogg", "ogg"];
    } else if (h.startsWith("52494646") && h.indexOf("41564920") != -1) {
      [type, extension] = ["video/x-msvideo", "avi"];
    } else if (h.startsWith("464C56")) {
      [type, extension] = ["video/x-flv", "flv"];
    } else if (h.indexOf("667479703367") != -1) {
      [type, extension] = ["video/3gpp", "3gp"];
    } else if (h.indexOf("46674797") != -1) {
      [type, extension] = ["video/quicktime", "mov"];
    } else if (
      h.startsWith("47") ||
      h.startsWith("001BA") ||
      h.startsWith("001B3")
    ) {
      [type, extension] = ["video/mpeg", "mpeg"];
    } else if (h.indexOf("6674797069736F6D") != -1) {
      [type, extension] = ["video/mp4", "mp4"];
    } else if (h.startsWith("1A45DFA3")) {
      [type, extension] = ["video/webm", "webm"];
    } else if (
      h.startsWith("3026B2758E66CF11") ||
      h.startsWith("A6D900AA0062CE6C")
    ) {
      [type, extension] = ["video/x-ms-wmv", "wmv"];
    } else if (h.startsWith("89504E47")) {
      [type, extension] = ["image/png", "png"];
    } else if (h.startsWith("52494646") && h.indexOf("57454250") != -1) {
      [type, extension] = ["image/webp", "webp"];
    } else if (h.startsWith("FFD8FF")) {
      [type, extension] = ["image/jpeg", "jpeg"];
    } else if (h.startsWith("474946383761") || h.startsWith("474946383961")) {
      [type, extension] = ["image/gif", "gif"];
    } else if (h.startsWith("424D")) {
      [type, extension] = ["image/bmp", "bmp"];
    }

    const renamedFile = new File([file], file.name + "." + extension, {
      type: type,
    });
    callbackFunk(renamedFile);
  });
  reader.readAsArrayBuffer(file);
};

export const handleFileWithFileType = function (file, callbackFunk) {
  // Only process image, audio and video files.
  if (
    !(
      file.type.match("image.*") ||
      file.type.match("audio.*") ||
      file.type.match("video.*")
    )
  ) {
    // IO.alert logic omitted for brevity in test module
    return;
  }

  try {
    fileHandler.saveFile(file, callbackFunk);
  } catch (exception) {
    // log.e logic omitted for brevity in test module
  }
};

// Public methods
export const getTroffData = async function (troffDataId, fileName) {
  const db = firebase.firestore();
  const troffDataReference = db.collection("TroffData").doc(troffDataId);

  return troffDataReference.get().then((doc) => {
    if (!doc.exists) {
      throw new Error(`Could not find song "${fileName}", with id "${troffDataId}", on the server, perhaps the URL is wrong or the song has been removed`);
    }
    return doc.data();
  });
};

export const fetchAndSaveResponse = async function (fileUrl, songKey) {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Fetch failed for ${songKey}: ${response.statusText}`);
  }
  const contentLength = +response.headers.get("Content-Length");
  const reader = response.body.getReader();
  let receivedLength = 0;
  let chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    receivedLength += value.length;
    if (typeof firebaseWrapper.onDownloadProgressUpdate == "function") {
      const progress = (receivedLength / contentLength) * 100;
      firebaseWrapper.onDownloadProgressUpdate(Math.floor(progress));
    }
  }
  const blob = new Blob(chunks);
  return saveResponse(new Response(blob, v3Init), songKey);
};

export const saveResponse = async function (response, url) {
  return caches.open(nameOfCache).then((cache) => {
    return cache.put(url, response);
  });
};

export const saveFile = async function (file, callbackFunk) {
  const url = file.name;
  return saveResponse(new Response(file, v3Init), url).then(() => {
    callbackFunk(url, file);
  });
};

export const getObjectUrlFromResponse = async function (response, songKey) {
  if (response === undefined) {
    throw new Error(`Can not upload the song "${songKey}" because it appears to not exist in the app. Please add the song to Troff and try to upload it again.`);
  }
  return response.blob().then(URL.createObjectURL);
};

export const getObjectUrlFromFile = async function (songKey) {
  return caches.match(songKey).then((cachedResponse) => {
    return getObjectUrlFromResponse(cachedResponse, songKey);
  });
};

export const doesFileExistInCache = async function (url) {
  let response = await caches.match(url);
  return response !== undefined;
};

export const sendFileToFirebase = async function (fileKey, storageDir) {
  // cacheImplementation.isSongV2 logic omitted for brevity in test module
  const cachedResponse = await caches.match(fileKey);
  if (cachedResponse === undefined) {
    throw new Error(`Can not upload the song "${fileKey}" because it appears to not exist in the app. Please add the song to Troff and try to upload it again.`);
  }
  const myBlob = await cachedResponse.blob();
  const file = new File([myBlob], fileKey, { type: myBlob.type });
  const fileHash = await hashFile(file);
  const fileUrl = await firebaseWrapper.uploadFile(fileHash, file, storageDir);
  return [fileUrl, file];
};

export const sendFile = async function (fileKey, oSongTroffInfo, storageDir = "TroffFiles") {
  const [fileUrl, file] = await sendFileToFirebase(fileKey, storageDir);
  const strSongTroffInfo = JSON.stringify(oSongTroffInfo);
  const troffData = {
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    fileUrl: fileUrl,
    troffDataPublic: true,
    troffDataUploadedMillis: new Date().getTime(),
    markerJsonString: strSongTroffInfo,
  };
  troffData.id = crc32Hash(JSON.stringify(troffData));
  return firebaseWrapper.uploadTroffData(troffData).then((retVal) => {
    return {
      id: troffData.id,
      fileUrl: troffData.fileUrl,
      fileName: troffData.fileName,
    };
  });
};

export const handleFiles = async function (files, callbackFunk) {
  let i = 0;
  for (let file; (file = files[i]); i++) {
    if (file.type == "") {
      readFileTypeAndExtension(file, function (fileWithType) {
        handleFileWithFileType(fileWithType, callbackFunk);
      });
      continue;
    }
    handleFileWithFileType(file, callbackFunk);
  }
};

export const uploadFile = async function (fileId, file, storageDir = "TroffFiles") {
  const storageRef = firebase.storage().ref(storageDir);
  const fileRef = storageRef.child(fileId);
  const task = fileRef.put(file);
  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        if (typeof firebaseWrapper.onUploadProgressUpdate == "function") {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          firebaseWrapper.onUploadProgressUpdate(Math.floor(progress));
        }
      },
      (error) => {
        task.snapshot.ref.getDownloadURL().then((downloadURL) => {
          resolve(downloadURL);
        }).catch((x) => {
          reject(new Error(`Can not upload the file to the server. The server says: "${error.code}"`));
        });
      },
      () => {
        task.snapshot.ref.getDownloadURL().then((downloadURL) => {
          resolve(downloadURL);
        });
      }
    );
  });
};

export const uploadTroffData = function (troffData) {
  const db = firebase.firestore();
  return db.collection("TroffData").doc(String(troffData.id)).set(troffData).then((x) => {
    return troffData;
  }).catch((error) => {
    return backendService.getTroffData("" + troffData.id, troffData.fileName).then((troffDataInFirebase) => {
      if (troffDataInFirebase) {
        return troffDataInFirebase;
      }
      throw new Error(`Can not upload the markers and settings to the server. The server says: "${error.message}"`);
    });
  });
};
